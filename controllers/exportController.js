const asyncHandler = require('../utils/asyncHandler');
const exportService = require('../services/exportService');

// GET /api/export/transactions?format=csv|excel|pdf&type=all|expense|income&startDate=&endDate=
const exportTransactions = asyncHandler(async (req, res) => {
  const { format = 'csv', type = 'all', startDate, endDate } = req.query;
  const { contentType, extension, buffer } = await exportService.exportTransactions(req.user._id, {
    format,
    type,
    startDate,
    endDate,
  });

  const filename = `expense-ai-transactions-${new Date().toISOString().slice(0, 10)}.${extension}`;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

module.exports = { exportTransactions };
