// Sends email through a Gmail account (used for password reset codes).
// GMAIL_APP_PASSWORD must be a Google "App Password", not the account's normal password:
// Google Account > Security > 2-Step Verification (must be on) > App passwords.
import 'dotenv/config';
import nodemailer from 'nodemailer';

export class MailNotConfiguredError extends Error {
  constructor() {
    super('Password reset email is not set up (GMAIL_USER and GMAIL_APP_PASSWORD in .env)');
    this.name = 'MailNotConfiguredError';
  }
}

export function mailConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

let transporter = null;

export async function sendMail({ to, subject, text, html }) {
  if (!mailConfigured()) throw new MailNotConfiguredError();
  transporter ??= nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      // Google shows app passwords in groups of four with spaces; the spaces aren't part of it.
      pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, ''),
    },
  });
  await transporter.sendMail({
    from: `"${process.env.MAIL_FROM_NAME || 'Studyspace'}" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
}
