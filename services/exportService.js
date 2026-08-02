const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const Expense = require('../models/Expense');
const Income = require('../models/Income');
const ApiError = require('../utils/ApiError');

/**
 * Fetches expenses and/or income for export, applying the same date-range
 * filter to both so a combined export lines up correctly.
 */
const fetchTransactions = async (userId, { type = 'all', startDate, endDate } = {}) => {
  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);

  const baseMatch = { user: userId, ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}) };

  const [expenses, income] =
    type === 'income'
      ? [[], await Income.find(baseMatch).sort('-date').lean()]
      : type === 'expense'
        ? [await Expense.find(baseMatch).sort('-date').lean(), []]
        : await Promise.all([Expense.find(baseMatch).sort('-date').lean(), Income.find(baseMatch).sort('-date').lean()]);

  const rows = [
    ...expenses.map((e) => ({
      date: e.date,
      type: 'Expense',
      title: e.title,
      category: e.category,
      amount: e.amount,
      paymentMethod: e.paymentMethod || '',
      description: e.description || '',
    })),
    ...income.map((i) => ({
      date: i.date,
      type: 'Income',
      title: i.title,
      category: i.category,
      amount: i.amount,
      paymentMethod: i.paymentMethod || '',
      description: i.description || '',
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return rows;
};

const csvEscape = (value) => {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const generateCSV = (rows) => {
  const headers = ['Date', 'Type', 'Title', 'Category', 'Amount', 'Payment Method', 'Description'];
  const lines = [headers.join(',')];

  rows.forEach((r) => {
    lines.push(
      [
        new Date(r.date).toISOString().slice(0, 10),
        r.type,
        r.title,
        r.category,
        r.amount,
        r.paymentMethod,
        r.description,
      ]
        .map(csvEscape)
        .join(',')
    );
  });

  return lines.join('\n');
};

const generateExcelBuffer = async (rows) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Expense AI';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Transactions');
  sheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Type', key: 'type', width: 10 },
    { header: 'Title', key: 'title', width: 28 },
    { header: 'Category', key: 'category', width: 16 },
    { header: 'Amount', key: 'amount', width: 14 },
    { header: 'Payment Method', key: 'paymentMethod', width: 16 },
    { header: 'Description', key: 'description', width: 32 },
  ];
  sheet.getRow(1).font = { bold: true };

  rows.forEach((r) => {
    sheet.addRow({
      date: new Date(r.date).toISOString().slice(0, 10),
      type: r.type,
      title: r.title,
      category: r.category,
      amount: r.amount,
      paymentMethod: r.paymentMethod,
      description: r.description,
    });
  });

  sheet.getColumn('amount').numFmt = '#,##0.00';

  return workbook.xlsx.writeBuffer();
};

const generatePDFBuffer = (rows, { title = 'Transaction History' } = {}) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(title, { align: 'center' });
    doc.moveDown();

    const totalExpense = rows.filter((r) => r.type === 'Expense').reduce((s, r) => s + r.amount, 0);
    const totalIncome = rows.filter((r) => r.type === 'Income').reduce((s, r) => s + r.amount, 0);
    doc.fontSize(10).fillColor('#555').text(`Total Income: ₹${totalIncome}   |   Total Expense: ₹${totalExpense}   |   Net: ₹${totalIncome - totalExpense}`);
    doc.moveDown();
    doc.fillColor('#000');

    const colWidths = [70, 55, 110, 75, 65, 105];
    const headers = ['Date', 'Type', 'Title', 'Category', 'Amount', 'Payment'];
    let y = doc.y;
    const startX = doc.x;

    const drawRow = (values, isHeader = false) => {
      let x = startX;
      doc.fontSize(9).font(isHeader ? 'Helvetica-Bold' : 'Helvetica');
      values.forEach((val, i) => {
        doc.text(String(val ?? ''), x, y, { width: colWidths[i], ellipsis: true });
        x += colWidths[i];
      });
      y += 18;
      if (y > doc.page.height - 60) {
        doc.addPage();
        y = 40;
      }
    };

    drawRow(headers, true);
    doc.moveTo(startX, y - 4).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y - 4).stroke();

    rows.forEach((r) => {
      drawRow([new Date(r.date).toISOString().slice(0, 10), r.type, r.title, r.category, r.amount, r.paymentMethod]);
    });

    doc.end();
  });
};

const exportTransactions = async (userId, { format, type, startDate, endDate }) => {
  const rows = await fetchTransactions(userId, { type, startDate, endDate });

  switch (format) {
    case 'csv':
      return { contentType: 'text/csv', extension: 'csv', buffer: Buffer.from(generateCSV(rows), 'utf-8') };
    case 'excel':
      return {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extension: 'xlsx',
        buffer: await generateExcelBuffer(rows),
      };
    case 'pdf':
      return { contentType: 'application/pdf', extension: 'pdf', buffer: await generatePDFBuffer(rows) };
    default:
      throw ApiError.badRequest('format must be one of: csv, excel, pdf');
  }
};

module.exports = { exportTransactions, fetchTransactions, generateCSV, generateExcelBuffer, generatePDFBuffer };
