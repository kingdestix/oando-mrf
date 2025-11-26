// backend/utils/email.js
// Email notification system using Nodemailer

const nodemailer = require('nodemailer');

let transporter = null;
let emailConfigured = false;

// Try to create email transporter
try {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    emailConfigured = true;
  }
} catch (error) {
  console.log('⚠️  Email service initialization skipped');
}

/**
 * Send email notification
 */
async function sendEmail({ to, subject, html }) {
  // If email not configured, silently skip
  if (!emailConfigured || !transporter) {
    console.log('📧 Email skipped (not configured):', { to, subject });
    return { success: false, skipped: true };
  }

  try {
    const info = await transporter.sendMail({
      from: `"Oando MRF System" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html
    });

    console.log('✅ Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Email failed (continuing anyway):', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Verify email configuration
 */
async function verifyEmailConfig() {
  if (!emailConfigured || !transporter) {
    console.log('⚠️  Email notifications disabled (SMTP not configured)');
    return false;
  }

  try {
    await transporter.verify();
    console.log('✅ Email server connected');
    return true;
  } catch (error) {
    console.error('⚠️  Email server connection failed (will skip emails):', error.message);
    emailConfigured = false; // Disable emails if verification fails
    return false;
  }
}

module.exports = {
  sendEmail,
  verifyEmailConfig
};