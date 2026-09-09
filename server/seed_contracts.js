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

const sampleRegulationConfigs = [
    { name: '삼성', requirements: [{ id: '1', label: '안전 서약서', checked: false }, { id: '2', label: '보안 각서', checked: true }] },
    { name: 'LG', requirements: [{ id: '1', label: '작업 허가서', checked: false }] },
    { name: 'SK', requirements: [{ id: '1', label: '안전 교육 이수증', checked: false }, { id: '2', label: '특수 건강 검진표', checked: true }] },
    { name: '기타', requirements: [] }
];

const contractTypes = ['EST', 'CONTRACT', 'CHANGE'];
const categories = ['NEW', 'ADD', 'CHANGE', 'REDUCE'];
const statuses = ['DRAFT', 'REVIEW', 'SUBMITTED', 'SIGNED', 'REJECTED'];

// Helper to generate random date within range
function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString().slice(0, 10);
}

async function seed() {
    const client = await pool.connect();
    try {
        console.log('Connecting to DB...');


        // 1. Fetch Projects to link to
        const { rows: projects } = await client.query('SELECT id, name FROM projects LIMIT 5');

        if (projects.length === 0) {
            console.log('No projects found. Please create projects first.');
            return;
        }

        console.log(`Found ${projects.length} projects. Generating 10 contracts...`);

        for (let i = 0; i < 10; i++) {
            const project = projects[i % projects.length];
            const type = contractTypes[Math.floor(Math.random() * contractTypes.length)];
            const code = `${type === 'CONTRACT' ? 'CON' : 'EST'}-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
            const category = categories[Math.floor(Math.random() * categories.length)];
            const name = `${project.name} - ${i + 1}차 ${type === 'EST' ? '견적' : '계약'}`;
            const regConfig = sampleRegulationConfigs[Math.floor(Math.random() * sampleRegulationConfigs.length)];

            // Costs
            const direct = Math.floor(Math.random() * 50000000) + 10000000; // 10m ~ 60m
            const iRate = 15;
            const rRate = 10;
            const mRate = 15;

            const indirect = Math.round(direct * (iRate / 100));
            const risk = Math.round(direct * (rRate / 100));
            const margin = Math.round(direct * (mRate / 100));
            const total = direct + indirect + risk + margin;

            const contractDate = randomDate(new Date(2024, 0, 1), new Date());
            const startDate = contractDate;
            const endDate = randomDate(new Date(startDate), new Date(2025, 11, 31));

            // Insert Contract
            const insertQuery = `
                INSERT INTO contracts (
                    project_id, code, type, category, name, 
                    total_amount, cost_direct, cost_indirect, risk_fee, margin,
                    indirect_rate, risk_rate, margin_rate,
                    regulation_config, client_manager, our_manager,
                    contract_date, start_date, end_date,
                    status
                ) VALUES (
                    $1, $2, $3, $4, $5, 
                    $6, $7, $8, $9, $10,
                    $11, $12, $13,
                    $14, $15, $16,
                    $17, $18, $19,
                    $20
                ) RETURNING id
             `;

            const { rows: [newContract] } = await client.query(insertQuery, [
                project.id, code, type, category, name,
                total, direct, indirect, risk, margin,
                iRate, rRate, mRate,
                JSON.stringify(regConfig), '김담당', '이매니저',
                contractDate, startDate, endDate,
                statuses[Math.floor(Math.random() * statuses.length)]
            ]);

            // Insert Random Items (1-3 items)
            const itemCount = Math.floor(Math.random() * 3) + 1;
            for (let j = 0; j < itemCount; j++) {
                const qty = Math.floor(Math.random() * 10) + 1;
                const unitPrice = Math.round(direct / itemCount / qty);
                const amt = qty * unitPrice;

                await client.query(`
                    INSERT INTO contract_items (
                        contract_id, group_name, name, spec, 
                        quantity, unit, unit_price, amount
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 `, [newContract.id, '철거공사', `구조물 철거 ${j + 1}`, 'Standard', qty, '식', unitPrice, amt]);
            }

            console.log(`Created Contract: ${code} (${name})`);
        }

        console.log('Seed completed successfully.');

    } catch (err) {
        console.error('Seed errors:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
