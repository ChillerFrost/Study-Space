// MongoDB connection for cloud accounts and cloud-saved notes.
// MONGODB_URI may contain <username>/<password> (or Atlas's <db_username>/<db_password>)
// placeholders; they are filled from MONGODB_USERNAME and MONGODB_PASSWORD.
import 'dotenv/config';
import { MongoClient } from 'mongodb';

export class DatabaseNotConfiguredError extends Error {
  constructor(message = 'Missing MONGODB_URI in .env') {
    super(message);
    this.name = 'DatabaseNotConfiguredError';
  }
}

export function databaseConfigured() {
  return Boolean(process.env.MONGODB_URI);
}

function connection() {
  const username = process.env.MONGODB_USERNAME ?? '';
  const password = process.env.MONGODB_PASSWORD ?? '';
  const uri = process.env.MONGODB_URI.replace(/<(db_)?username>/g, encodeURIComponent(username)).replace(
    /<(db_)?password>/g,
    encodeURIComponent(password),
  );
  // A URI without credentials in it uses the separate username/password variables.
  const hasCredentials = /^mongodb(\+srv)?:\/\/[^/]*@/.test(uri);
  const options = { serverSelectionTimeoutMS: 8000 };
  if (!hasCredentials && username && password) options.auth = { username, password };
  return { uri, options };
}

let dbPromise = null;

// MONGODB_DB wins; otherwise the database named in the URI path; otherwise "studyspace".
function databaseName(uri) {
  const fromUri = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?/]+)/.exec(uri)?.[1];
  return process.env.MONGODB_DB || (fromUri && decodeURIComponent(fromUri)) || 'studyspace';
}

async function connect() {
  const { uri, options } = connection();
  const client = await new MongoClient(uri, options).connect();
  const db = client.db(databaseName(uri));
  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('notes').createIndex({ userId: 1, id: 1 }, { unique: true }),
    db.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true }),
    // MongoDB deletes expired sessions on its own.
    db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
  console.log(`Connected to MongoDB database "${db.databaseName}"`);
  return db;
}

export async function getDb() {
  if (!databaseConfigured()) throw new DatabaseNotConfiguredError();
  if (!dbPromise) {
    dbPromise = connect().catch((error) => {
      dbPromise = null; // Try again on the next request instead of caching the failure.
      console.error('MongoDB connection failed:', error.message);
      throw new DatabaseNotConfiguredError('Could not connect to MongoDB. Check MONGODB_URI in .env.');
    });
  }
  return dbPromise;
}
