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

const personnelData = [
    // 경영자 2명
    { name: '김대표', role: 'CEO', qualifications: ['건설기술인', '안전보건관리자'], security_clearance: 'S등급', status: 'AVAILABLE' },
    { name: '박이사', role: 'EXECUTIVE', qualifications: ['건축기사', '안전관리자'], security_clearance: 'S등급', status: 'AVAILABLE' },

    // PM 3명
    { name: '이PM', role: 'PM', qualifications: ['건설안전기사', 'PMP'], security_clearance: 'A등급', status: 'AVAILABLE' },
    { name: '최PM', role: 'PM', qualifications: ['산업안전기사', '건축기사'], security_clearance: 'A등급', status: 'AVAILABLE' },
    { name: '정PM', role: 'PM', qualifications: ['건설안전기사'], security_clearance: 'A등급', status: 'AVAILABLE' },

    // PL 3명
    { name: '강PL', role: 'PL', qualifications: ['건설기계기사', '안전관리자'], security_clearance: 'B등급', status: 'AVAILABLE' },
    { name: '조PL', role: 'PL', qualifications: ['산업안전기사'], security_clearance: 'B등급', status: 'AVAILABLE' },
    { name: '윤PL', role: 'PL', qualifications: ['건축기사'], security_clearance: 'B등급', status: 'AVAILABLE' },
];

// 현장 근무자 20명 생성
const firstNames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'];
const roles = ['OPERATOR', 'WORKER'];
const quals = ['굴삭기운전기능사', '지게차운전기능사', '용접기능사', '철근기능사', '비계기능사', '없음'];

for (let i = 1; i <= 20; i++) {
    const role = i <= 5 ? 'OPERATOR' : 'WORKER'; // 5 operators, 15 workers
    const name = `${firstNames[i % 10]}작업${i}`;
    const qual = quals[i % quals.length];

    personnelData.push({
        name: name,
        role: role,
        qualifications: qual === '없음' ? [] : [qual],
        security_clearance: 'C등급',
        status: 'AVAILABLE'
    });
}

async function seed() {
    const client = await pool.connect();
    try {
        console.log('Connected to DB...');

        // Verify/Create Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS personnel (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL,
                role VARCHAR(50), 
                qualifications TEXT[],
                security_clearance VARCHAR(20),
                status VARCHAR(20) DEFAULT 'AVAILABLE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Clear existing data (optional, but good for seeding)
        // await client.query('DELETE FROM personnel');
        // console.log('Cleared existing personnel data.');

        // Insert Data
        for (const p of personnelData) {
            await client.query(
                `INSERT INTO personnel (name, role, qualifications, security_clearance, status)
                 VALUES ($1, $2, $3, $4, $5)`,
                [p.name, p.role, p.qualifications, p.security_clearance, p.status]
            );
        }

        console.log(`Successfully inserted ${personnelData.length} records.`);

    } catch (err) {
        console.error('Error seeding data:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
