const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'index.js');
let content = fs.readFileSync(filePath, 'utf8');

const marker = '// ==================== SWMS APIs ====================';
const endMarker = 'app.listen(PORT, () => {';

const startIndex = content.indexOf(marker);
const endIndex = content.lastIndexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
    console.error('Markers not found!');
    process.exit(1);
}

const newContent = content.substring(0, startIndex) +
    `// ==================== SWMS APIs ====================
require('./swms_routes')(app, pool)

` + content.substring(endIndex);

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully patched index.js');
