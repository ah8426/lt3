// Test database connection
// Usage: node test-database.js

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n=================================================');
console.log('DATABASE CONNECTION STRING GENERATOR');
console.log('=================================================\n');

rl.question('Enter your Supabase database password: ', (password) => {
  console.log('\n=================================================');
  console.log('CONNECTION STRINGS GENERATED');
  console.log('=================================================\n');

  console.log('Copy these to your .env.local file:\n');

  const encodedPassword = encodeURIComponent(password);

  console.log('DATABASE_URL="postgresql://postgres.nmllrewdfkpuhchkeogh:' + encodedPassword + '@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"\n');

  console.log('DIRECT_URL="postgresql://postgres.nmllrewdfkpuhchkeogh:' + encodedPassword + '@aws-0-us-west-1.pooler.supabase.com:5432/postgres"\n');

  console.log('=================================================');
  console.log('NOTE: Password has been URL-encoded automatically');
  console.log('=================================================\n');

  rl.close();
});
