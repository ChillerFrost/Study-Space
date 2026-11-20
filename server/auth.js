// Accounts, password hashing and login sessions, stored in MongoDB.
//   users:    { _id, email, passwordHash, createdAt }
//   notes:    { userId, email, id, title, content, createdAt, updatedAt }  (one per note)
//   sessions: { tokenHash, userId, createdAt, expiresAt }
// Passwords are hashed with scrypt (built into Node). Session tokens are random and only
// their SHA-256 hash is stored, so a database leak doesn't hand out working logins.
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { getDb } from './db.js';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const SESSION_DAYS = 30;
export const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function normalizeEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    throw new HttpError(400, 'Enter a valid email address');
  }
  return email;
}

export function checkPassword(value) {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (value.length > MAX_PASSWORD_LENGTH) throw new HttpError(400, 'Password is too long');
  return value;
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, salt, expected] = String(stored).split('$');
  if (scheme !== 'scrypt' || !salt || !expected) return false;
  const expectedKey = Buffer.from(expected, 'base64');
  const key = await scryptAsync(password, Buffer.from(salt, 'base64'), expectedKey.length);
  return timingSafeEqual(key, expectedKey);
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId) {
  const db = await getDb();
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  await db.collection('sessions').insertOne({
    tokenHash: hashToken(token),
    userId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000),
  });
  return token;
}

function bearerToken(req) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') ?? '');
  return match ? match[1] : null;
}

export async function deleteSession(req) {
  const token = bearerToken(req);
  if (!token) return;
  const db = await getDb();
  await db.collection('sessions').deleteOne({ tokenHash: hashToken(token) });
}

// The signed-in user for this request, or a 401.
export async function requireUser(req) {
  const token = bearerToken(req);
  if (!token) throw new HttpError(401, 'Sign in to use cloud saves');
  const db = await getDb();
  const session = await db
    .collection('sessions')
    .findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
  const user = session && (await db.collection('users').findOne({ _id: session.userId }));
  if (!user) throw new HttpError(401, 'Your session has expired. Sign in again.');
  return user;
}

export function publicUser(user) {
  return { email: user.email, createdAt: user.createdAt };
}
