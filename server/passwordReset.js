// Password reset with a 6-digit code sent by email.
//   passwordResets: { userId, email, codeHash, attempts, createdAt, expiresAt }
// One active code per account. Codes expire after 15 minutes, allow 5 guesses,
// and only their hash is stored. Using a code signs the account out everywhere.
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { getDb } from './db.js';
import { sendMail } from './mail.js';
import { checkPassword, createSession, hashPassword, HttpError, normalizeEmail, publicUser } from './auth.js';

const CODE_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 60;
const INVALID_CODE = 'That code is incorrect or has expired. Request a new one.';

function hashCode(email, code) {
  return createHash('sha256').update(`${email}:${code}`).digest();
}

function resetEmail(code) {
  const text = [
    'Someone asked to reset the password for your Studyspace account.',
    '',
    `Your reset code is: ${code}`,
    '',
    `It expires in ${CODE_MINUTES} minutes. If you didn't ask for this, you can ignore this email; your password won't change.`,
  ].join('\n');
  const html = `
    <p>Someone asked to reset the password for your Studyspace account.</p>
    <p>Your reset code is:</p>
    <p style="font-size:28px;font-weight:600;letter-spacing:6px;margin:16px 0">${code}</p>
    <p>It expires in ${CODE_MINUTES} minutes. If you didn't ask for this, you can ignore this email; your password won't change.</p>`;
  return { subject: 'Your Studyspace password reset code', text, html };
}

// Always answers the same way whether or not the account exists, so this can't be used
// to find out which emails have accounts.
export async function requestPasswordReset(rawEmail) {
  const email = normalizeEmail(rawEmail);
  const db = await getDb();
  const user = await db.collection('users').findOne({ email });
  if (!user) return;

  const resets = db.collection('passwordResets');
  const recent = await resets.findOne({
    email,
    createdAt: { $gt: new Date(Date.now() - RESEND_SECONDS * 1000) },
  });
  if (recent) {
    throw new HttpError(429, `A code was just sent. Wait a minute before asking for another.`);
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const now = new Date();
  await resets.deleteMany({ email });
  await resets.insertOne({
    userId: user._id,
    email,
    codeHash: hashCode(email, code),
    attempts: 0,
    createdAt: now,
    expiresAt: new Date(now.getTime() + CODE_MINUTES * 60 * 1000),
  });

  try {
    await sendMail({ to: email, ...resetEmail(code) });
  } catch (error) {
    await resets.deleteMany({ email });
    console.error('Sending reset email failed:', error.message);
    throw new HttpError(502, 'Could not send the reset email. Try again later.');
  }
}

// Checks the code, sets the new password, signs out old sessions and returns a new one.
export async function resetPassword({ email: rawEmail, code, password: rawPassword }) {
  const email = normalizeEmail(rawEmail);
  const password = checkPassword(rawPassword);
  const cleanCode = String(code ?? '').replace(/\D/g, '');
  const db = await getDb();
  const resets = db.collection('passwordResets');

  const reset = await resets.findOne({ email, expiresAt: { $gt: new Date() } });
  if (!reset || reset.attempts >= MAX_ATTEMPTS || cleanCode.length !== 6) {
    if (reset && cleanCode.length === 6) await resets.deleteOne({ _id: reset._id });
    throw new HttpError(400, INVALID_CODE);
  }

  const stored = Buffer.from(reset.codeHash.buffer ?? reset.codeHash);
  if (!timingSafeEqual(hashCode(email, cleanCode), stored)) {
    await resets.updateOne({ _id: reset._id }, { $inc: { attempts: 1 } });
    throw new HttpError(400, INVALID_CODE);
  }

  // Single use: remove it before changing anything else.
  const { deletedCount } = await resets.deleteOne({ _id: reset._id });
  if (deletedCount !== 1) throw new HttpError(400, INVALID_CODE);

  await db
    .collection('users')
    .updateOne({ _id: reset.userId }, { $set: { passwordHash: await hashPassword(password) } });
  await db.collection('sessions').deleteMany({ userId: reset.userId });
  const user = await db.collection('users').findOne({ _id: reset.userId });
  console.log(`Password reset for ${email}`);
  return { token: await createSession(user._id), user: publicUser(user) };
}
