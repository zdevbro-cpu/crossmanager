const { Pool } = require('pg');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '.env.local');
require('dotenv').config({ path: envPath });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function test() {
  const query = `
    SELECT d.id, d.name, v.file_content 
    FROM documents d
    JOIN document_versions v ON d.id = v.document_id
    WHERE d.type IN ('XLSX', 'XLS')
    LIMIT 1
  `;
  const res = await pool.query(query);
  if (res.rows.length === 0) {
    console.log('No Excel files found in DB');
    return;
  }

  const row = res.rows[0];
  console.log(`Testing file: ${row.name} (ID: ${row.id})`);
  const buffer = Buffer.from(row.file_content, 'base64');
  
  try {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    console.log('Workbook read success');
    console.log('Sheets:', workbook.SheetNames);
    
    workbook.SheetNames.forEach(name => {
      const sheet = workbook.Sheets[name];
      const html = xlsx.utils.sheet_to_html(sheet);
      console.log(`Sheet "${name}" converted to HTML (length: ${html.length})`);
    });
    console.log('All sheets processed successfully');
  } catch (err) {
    console.error('Error during xlsx process:', err);
  } finally {
    pool.end();
  }
}

test();
