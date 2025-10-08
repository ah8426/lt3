// Test database connection and schema after migrations
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDatabaseConnection() {
  try {
    console.log('Testing database connection...\n');

    // Test 1: Check if we can query users/profiles table
    console.log('1. Testing profiles table...');
    const userCount = await prisma.user.count();
    console.log(`   ✓ Found ${userCount} users in profiles table`);

    // Test 2: Check if we can query sessions table with new columns
    console.log('\n2. Testing sessions table with new columns...');
    const sessions = await prisma.session.findMany({
      take: 1,
      select: {
        id: true,
        matterId: true,
        status: true,
        description: true,
        startedAt: true,
        audioStoragePath: true,
        shareToken: true,
        totalCost: true,
      }
    });
    console.log(`   ✓ Sessions table has new columns: ${Object.keys(sessions[0] || {}).join(', ')}`);

    // Test 3: Check if new tables exist
    console.log('\n3. Testing new tables...');
    const subscriptionPlans = await prisma.subscriptionPlan.count();
    console.log(`   ✓ subscription_plans table exists (${subscriptionPlans} records)`);

    const invoices = await prisma.invoice.count();
    console.log(`   ✓ invoices table exists (${invoices} records)`);

    const usageMetrics = await prisma.usageMetrics.count();
    console.log(`   ✓ usage_metrics table exists (${usageMetrics} records)`);

    console.log('\n✅ All database schema tests passed!');
    console.log('The migrations were successfully applied.');

  } catch (error) {
    console.error('\n❌ Database test failed:');
    console.error(error.message);

    if (error.code === 'P2021') {
      console.error('\nThe table does not exist in the database. The migration may not have been applied.');
    } else if (error.code === 'P2010') {
      console.error('\nRaw query failed. Check if the column exists in the database.');
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabaseConnection();
