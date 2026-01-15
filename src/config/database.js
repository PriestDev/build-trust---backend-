import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import iconv from 'iconv-lite';

dotenv.config();

// Workaround: Some MySQL servers report the charset as 'cesu8' (CESU-8),
// which iconv-lite doesn't recognize by name. Map it to UTF-8 so the
// mysql2 handshake doesn't crash with "Encoding not recognized: 'cesu8'".
try {
  if (!iconv.encodingExists('cesu8')) {
    // runtime internal encodings map exists on iconv; add alias
    // @ts-ignore - accessing internal field for compatibility workaround
    iconv.encodings = iconv.encodings || {};
    // alias cesu8 to utf8 codec
    // @ts-ignore
    iconv.encodings['cesu8'] = iconv.encodings['utf8'];
  }
} catch (err) {
  console.warn('Could not apply cesu8 -> utf8 alias in iconv-lite:', err.message);
}

// Build conditional SSL options if requested by environment
let sslOptions;
if (process.env.DB_SSL === 'true') {
  sslOptions = {};
  try {
    if (process.env.DB_SSL_CA) {
      // Support either a path to a PEM file or a base64-encoded PEM string
      const caVal = process.env.DB_SSL_CA.trim();
      if (fs.existsSync(caVal)) {
        sslOptions.ca = fs.readFileSync(caVal);
      } else {
        // assume base64 encoded content
        sslOptions.ca = Buffer.from(caVal, 'base64').toString('utf8');
      }
    }
  } catch (err) {
    console.warn('Warning: could not read DB_SSL_CA:', err.message);
  }
  // By default, enforce authorized certs unless explicitly disabled
  sslOptions.rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'buildtrust',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '1'),
  queueLimit: 100,  // Queue up to 100 requests
  connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000'),
  // NOTE: mysql2 currently warns about unknown connection options passed to Connection
  // so avoid passing `acquireTimeout` here to prevent warnings during tests.
  // Set client charset to avoid server returning unexpected encodings like `cesu8`
  charset: process.env.DB_CHARSET || 'utf8mb4_general_ci',
  // Only set ssl if options were built
  ...(sslOptions ? { ssl: sslOptions } : {}),
  // Reduce idle timeout on Render to free up connections faster
  idleTimeout: 30000,  // 30 seconds before idle connections are closed
});

// Listen for pool errors so we can log and act on them
pool.on && pool.on('error', (err) => {
  console.error('MySQL pool error:', err.code);
});

export default pool;
