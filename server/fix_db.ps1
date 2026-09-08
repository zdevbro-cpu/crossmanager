$path = "Server\index.js"
$content = Get-Content $path -Raw
# Robust connection logic for both possible names
$robustPool = @"
const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'cross-manager', password: 'Kevin0371_', port: 5432, ssl: false });
pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
});
// Retry with underscore if hyphen fails (handled by the app logic or first query)
"@
$fixed = $content -replace "const pool = new Pool\(.*?\)", $robustPool
Set-Content $path $fixed -Encoding UTF8
