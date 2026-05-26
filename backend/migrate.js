const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function runSchema() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Running schema migrations on Neon...');
    await pool.query(schemaSql);
    console.log('Schema migrations completed successfully!');

    await pool.end();
  } catch (error) {
    console.error('Error running schema migrations:', error);
    process.exit(1);
  }
}

runSchema();
