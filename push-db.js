require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function pushToAzure() {
  console.log(`Connecting to Azure DB: ${process.env.DB_HOST}`);
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false } // Required for Azure
  });

  try {
    console.log("1. Reading schema.sql...");
    const schemaSql = fs.readFileSync(path.join(__dirname, 'database', 'schema.sql'), 'utf8');

    console.log("2. Pushing schema to Azure...");
    await pool.query(schemaSql);
    console.log("✅ Schema created successfully!");

    console.log("3. Reading seed.sql...");
    const seedSql = fs.readFileSync(path.join(__dirname, 'database', 'seed.sql'), 'utf8');

    console.log("4. Pushing seed data to Azure...");
    await pool.query(seedSql);
    console.log("✅ Seed data inserted successfully!");

  } catch (err) {
    console.error("❌ Error pushing database:", err.message);
  } finally {
    await pool.end();
  }
}

pushToAzure();
