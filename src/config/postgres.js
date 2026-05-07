const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT) || 5432,
  database: process.env.POSTGRES_DB || 'vitto_lending',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'password',
  ssl: { rejectUnauthorized: false }
});

const connectPostgres = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected');
    await createTables();
  } catch (err) {
    console.error('❌ PostgreSQL connection error:', err.message);
    process.exit(1);
  }
};

const createTables = async () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS decisions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      application_id VARCHAR(255) NOT NULL,
      credit_score INTEGER NOT NULL,
      decision VARCHAR(20) NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED')),
      reason_codes TEXT[] NOT NULL DEFAULT '{}',
      monthly_revenue NUMERIC(15,2),
      loan_amount NUMERIC(15,2),
      tenure_months INTEGER,
      emi_estimate NUMERIC(15,2),
      revenue_to_emi_ratio NUMERIC(10,4),
      loan_to_revenue_ratio NUMERIC(10,4),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      application_id VARCHAR(255) NOT NULL,
      event_type VARCHAR(100) NOT NULL,
      payload JSONB,
      ip_address VARCHAR(50),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  await pool.query(sql);
  console.log('✅ PostgreSQL tables ready');
};

module.exports = { pool, connectPostgres };
