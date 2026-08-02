const nodemailer = require('nodemailer');

let transporter;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
};

/**
 * Sends a transactional email. Used for password reset, welcome emails,
 * budget alerts, etc. Failures are logged but never crash the request flow
 * (email is best-effort, not critical-path).
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const info = await getTransporter().sendMail({
      from: process.env.EMAIL_FROM || 'Expense AI <no-reply@expenseai.com>',
      to,
      subject,
      text,
      html,
    });
    return info;
  } catch (error) {
    console.error('[Email] Failed to send:', error.message);
    return null;
  }
};

module.exports = sendEmail;
