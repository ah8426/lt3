// Generate encryption master key
// Run with: node generate-key.js

const crypto = require('crypto');

// Generate 32 bytes (256 bits) of random data
const key = crypto.randomBytes(32).toString('hex');

console.log('\n=================================================');
console.log('ENCRYPTION MASTER KEY GENERATED');
console.log('=================================================\n');
console.log('Copy this key to your .env.local file:\n');
console.log(`ENCRYPTION_MASTER_KEY=${key}\n`);
console.log('=================================================');
console.log('IMPORTANT: Keep this key secret!');
console.log('- Do NOT commit to git');
console.log('- Use different keys for dev/staging/production');
console.log('- Store production key in secrets manager');
console.log('=================================================\n');
