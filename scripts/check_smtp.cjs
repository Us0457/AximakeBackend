require('dotenv').config();
const nodemailer = require('nodemailer');

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const smtpSecure = (process.env.SMTP_SECURE || 'ssl') === 'ssl' || (process.env.SMTP_SECURE || '').toLowerCase() === 'true';
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
if (!smtpUser || !smtpPass) {
  console.error('SMTP_USER or SMTP_PASS missing in .env');
  process.exit(2);
}
let transporter;
if (smtpHost && smtpPort) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: smtpUser, pass: smtpPass }
  });
} else {
  transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: smtpUser, pass: smtpPass } });
}
transporter.verify((err, success) => {
  if (err) {
    console.error('SMTP verification failed:', err && err.message ? err.message : err);
    process.exit(1);
  }
  console.log('SMTP verified OK');
  process.exit(0);
});
