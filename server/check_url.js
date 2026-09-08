const http = require('http');

const url = 'http://localhost:3005/api/documents/b50c3b14-209d-410c-acaa-18aa668c14e8/view';

http.get(url, (res) => {
    console.log('StatusCode:', res.statusCode);
    console.log('Headers:', res.headers);
    res.resume(); // consume response to free memory
}).on('error', (e) => {
    console.error('Error:', e.message);
});
