import transporter from '../config/nodemailer.js';

export default async function sendEmail(to, subject, text) {
  const mailOptions = {
    from: process.env.SENDER_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✉️ Email sent to ${to}`);
    return true;
  } catch (err) {
    console.error("Error sending email:", err && (err.response || err.message || err));
    return false;
  }
}
