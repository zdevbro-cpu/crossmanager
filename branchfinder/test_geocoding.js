import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

// Trim keys to remove potential whitespace from copy-paste
const rawClientId = process.env.VITE_NAVER_MAP_CLIENT_ID || '';
const rawClientSecret = process.env.VITE_NAVER_MAP_CLIENT_SECRET || '';

const clientId = rawClientId.trim();
const clientSecret = rawClientSecret.trim();

console.log('--- Checking Credentials Detail ---');
console.log(`Client ID:     '${clientId.substring(0, 3)}...${clientId.substring(clientId.length - 2)}' (Length: ${clientId.length})`);
console.log(`Client Secret: '${clientSecret.substring(0, 3)}...${clientSecret.substring(clientSecret.length - 2)}' (Length: ${clientSecret.length})`);

// Warn if whitespace was removed
if (rawClientId.length !== clientId.length || rawClientSecret.length !== clientSecret.length) {
    console.warn('⚠️  WARNING: Found differences after trimming whitespace from keys. This was likely the issue!');
}

if (!clientId || !clientSecret) {
    console.error('ERROR: Credentials missing or empty in .env');
    process.exit(1);
}

const testAddresses = [
    '경기도 화성시 동탄대로',
    '동탄'
];

async function checkAddress(addr) {
    console.log(`\n--- Testing Address: "${addr}" ---`);
    const url = `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(addr)}`;

    // Log the exact headers used (masking secret)
    console.log('Request URL:', url);
    console.log('Headers:', {
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': 'MASKED'
    });

    try {
        const response = await fetch(url, {
            headers: {
                'X-NCP-APIGW-API-KEY-ID': clientId,
                'X-NCP-APIGW-API-KEY': clientSecret,
                // Add Origin header to match Web Service URL configuration
                'Origin': 'http://localhost:3000'
            },
        });

        console.log(`Response Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const text = await response.text();
            console.error('Error Body:', text);
            // Check specifically for common Naver error codes
            try {
                const errJson = JSON.parse(text);
                if (errJson.error && errJson.error.errorCode === '210') {
                    console.error('\n*** DIAGNOSIS: 210 Permission Denied ***');
                    console.error('This strictly means the "Geocoding" service is NOT enabled for the Application ID: ' + clientId);
                    console.error('Please double check the Console > AI·NAVER API > Application > "Edit" screen.');
                }
            } catch (e) { }
            return;
        }

        const data = await response.json();
        const addressCount = data.addresses ? data.addresses.length : 0;
        console.log(`Result: Success! Found ${addressCount} addresses.`);
        if (addressCount > 0) {
            console.log('First match:', data.addresses[0].roadAddress);
        } else {
            console.log('No matches found (Empty result).');
        }

    } catch (e) {
        console.error('Exception during fetch:', e.message);
    }
}

async function run() {
    for (const addr of testAddresses) {
        await checkAddress(addr);
    }
}

run();
