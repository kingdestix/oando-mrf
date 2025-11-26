// backend/utils/email.js
// Email notification system using Nodemailer

const nodemailer = require('nodemailer');

// Create email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER, // Your email
    pass: process.env.SMTP_PASS  // Your email password or app password
  }
});

/**
 * Send email notification
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 */
async function sendEmail({ to, subject, html }) {
  try {
    // Skip sending if SMTP not configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('⚠️  SMTP not configured, skipping email to:', to);
      return { success: false, message: 'SMTP not configured' };
    }

    const info = await transporter.sendMail({
      from: `"Oando MRF System" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html
    });

    console.log('✅ Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email send error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Verify email configuration
 */
async function verifyEmailConfig() {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('⚠️  Email notifications disabled: SMTP credentials not configured');
      return false;
    }

    await transporter.verify();
    console.log('✅ Email server connection verified');
    return true;
  } catch (error) {
    console.error('❌ Email server connection failed:', error.message);
    return false;
  }
}

module.exports = {
  sendEmail,
  verifyEmailConfig
};