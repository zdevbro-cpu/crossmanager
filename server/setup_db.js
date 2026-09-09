const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: { rejectUnauthorized: false }
});

const sql = `
-- Drop existing
DROP TABLE IF EXISTS contract_items CASCADE;
DROP TABLE IF EXISTS contracts CASCADE;

-- Recreate Contracts
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID, -- REFERENCES projects(id) ON DELETE CASCADE,
    code VARCHAR(50) UNIQUE,
    type VARCHAR(20),
    category VARCHAR(20),
    name VARCHAR(255),
    total_amount DECIMAL(15, 2) DEFAULT 0,
    cost_direct DECIMAL(15, 2) DEFAULT 0,
    cost_indirect DECIMAL(15, 2) DEFAULT 0,
    risk_fee DECIMAL(15, 2) DEFAULT 0,
    margin DECIMAL(15, 2) DEFAULT 0,
    indirect_rate DECIMAL(5, 2) DEFAULT 0,
    risk_rate DECIMAL(5, 2) DEFAULT 0,
    margin_rate DECIMAL(5, 2) DEFAULT 0,
    attachment JSONB,
    regulation_config JSONB,
    client_manager VARCHAR(100),
    our_manager VARCHAR(100),
    contract_date DATE,
    start_date DATE,
    end_date DATE,
    terms_payment TEXT,
    terms_penalty TEXT,
    status VARCHAR(20) DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recreate Contract Items
CREATE TABLE contract_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
    group_name VARCHAR(50),
    name VARCHAR(100),
    spec VARCHAR(100),
    quantity DECIMAL(12, 2) DEFAULT 0,
    unit VARCHAR(20),
    unit_price DECIMAL(15, 2) DEFAULT 0,
    amount DECIMAL(15, 2) DEFAULT 0,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

async function setup() {
    try {
        console.log('Resetting Contracts tables...');
        await pool.query(sql);
        console.log('Contracts tables reset successfully.');
    } catch (err) {
        console.error('Error resetting tables:', err);
    } finally {
        await pool.end();
    }
}

setup();
