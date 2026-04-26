const { Pool } = require('pg');

// Build SSL configuration for Azure PostgreSQL
const sslConfig = process.env.DB_SSL === 'true'
  ? { rejectUnauthorized: false }
  : false;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'booking_service_db',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: sslConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Log pool errors
pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

// Helper: execute a query
const query = (text, params) => {
  return pool.query(text, params);
};

// Helper: get a client from the pool (for transactions)
const getClient = () => {
  return pool.connect();
};

module.exports = { pool, query, getClient };
