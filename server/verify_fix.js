const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3005/api';

async function runTest() {
    console.log('--- TEST START ---');

    // 1. Create a dummy file
    const testFilePath = path.join(__dirname, 'test_doc.txt');
    fs.writeFileSync(testFilePath, 'This is a test content');
    console.log('[1] Created dummy file: test_doc.txt');

    try {
        // 0. Get Valid Project ID
        console.log('[0] Fetching projects to get a valid ID...');
        const projRes = await axios.get(`${API_URL}/projects`);
        const projects = projRes.data;
        if (!projects || projects.length === 0) {
            throw new Error('No projects found to test with.');
        }
        const projectId = projects[0].id;
        console.log(`[PASS] Using Project ID: ${projectId}`);

        // 2. Upload Document
        const form = new FormData();
        form.append('file', fs.createReadStream(testFilePath));
        form.append('projectId', projectId);
        form.append('category', 'TEST');
        form.append('type', 'Report');
        form.append('name', 'Original Name');

        console.log('[2] Uploading document...');
        const uploadRes = await axios.post(`${API_URL}/documents/upload`, form, {
            headers: { ...form.getHeaders() }
        });

        if (uploadRes.status !== 201) throw new Error(`Upload failed: ${uploadRes.status}`);
        const docId = uploadRes.data.documentId;
        console.log(`[PASS] Document uploaded. ID: ${docId}`);

        // 3. Test Renaming (PATCH)
        const newName = 'Renamed Document ' + Date.now();
        console.log(`[3] Attempting to rename to: "${newName}"...`);
        const patchRes = await axios.patch(`${API_URL}/documents/${docId}`, {
            name: newName
        });

        if (patchRes.status !== 200) throw new Error(`Rename failed: ${patchRes.status}`);
        console.log('[PASS] Rename request successful.');

        // 4. Verify Rename & File Path (GET)
        console.log('[4] Fetching document details to verify...');
        const getRes = await axios.get(`${API_URL}/documents/${docId}`);
        const docData = getRes.data;

        // Check Name
        if (docData.name === newName) {
            console.log(`[PASS] Name verified: "${docData.name}"`);
        } else {
            console.error(`[FAIL] Name mismatch! Expected "${newName}", got "${docData.name}"`);
        }

        // Check File Path
        if (docData.file_path || (docData.versions && docData.versions[0] && docData.versions[0].file_path)) {
            // In my previous fix, I joined file_path from version table to document result
            const filePath = docData.file_path || docData.versions[0].file_path;
            console.log(`[PASS] File path found: ${filePath}`);

            // 5. Test File Access (Download)
            // Frontend Logic: if path is 'uploads/filename', url is 'http://localhost:3005/uploads/filename'
            // My fix in api.ts handles stripping /api.
            let fileUrl = `${API_URL.replace('/api', '')}/${filePath}`;
            // If filePath already has uploads/ (which it does based on my read of routes code), and url is root/uploads/...

            // Double check the route logic:
            // const filePath = `uploads/${file.filename}`
            // So URL should be http://localhost:3005/uploads/filename

            console.log(`[5] Testing file access at: ${fileUrl}`);
            try {
                const fileRes = await axios.get(fileUrl);
                if (fileRes.status === 200) {
                    console.log('[PASS] File is accessible (200 OK)');
                } else {
                    console.error('[FAIL] File access returned ' + fileRes.status);
                }
            } catch (fileErr) {
                console.error('[FAIL] File access failed: ' + fileErr.message);
            }

        } else {
            console.error('[FAIL] No file_path returned in GET response!');
            console.log('Full Doc Data:', JSON.stringify(docData, null, 2));
        }

    } catch (err) {
        console.error('[CRITICAL FAIL]', err.message);
        if (err.response) {
            console.error('Response data:', err.response.data);
        }
    } finally {
        // Cleanup
        if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
        console.log('--- TEST END ---');
    }
}

runTest();
