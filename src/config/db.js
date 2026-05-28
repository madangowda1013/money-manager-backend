const { Pool } = require('pg');
require('dotenv').config({ quiet: true });

const databaseUrl = (process.env.DATABASE_URL || '').trim();
const isLocalDatabase = /localhost|127\.0\.0\.1/i.test(databaseUrl || '');

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isLocalDatabase ? false : { rejectUnauthorized: false }
});

pool.on('connect', () => console.log('Database connected successfully'));
pool.on('error', (err) => console.error('DB error', err));

module.exports = pool;  
