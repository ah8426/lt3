// Test database schema after migrations
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDatabaseSchema() {
  try {
    console.log('Testing database schema after migrations...\n');

    // Test 1: Check sessions table columns using raw query
    console.log('1. Checking sessions table columns...');
    const sessionsColumns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'sessions'
      ORDER BY ordinal_position;
    `;

    const sessionColumnNames = sessionsColumns.map(c => c.column_name);
    console.log(`   Found ${sessionColumnNames.length} columns:`, sessionColumnNames.join(', '));

    // Check for key columns
    const requiredSessionColumns = [
      'id', 'user_id', 'matter_id', 'title', 'status', 'created_at',
      'description', 'started_at', 'share_token', 'total_cost',
      'audio_storage_path', 'transcript_data'
    ];

    const missingColumns = requiredSessionColumns.filter(col => !sessionColumnNames.includes(col));
    if (missingColumns.length > 0) {
      console.log(`   ❌ Missing columns: ${missingColumns.join(', ')}`);
    } else {
      console.log(`   ✓ All required columns present`);
    }

    // Test 2: Check profiles table columns
    console.log('\n2. Checking profiles table columns...');
    const profilesColumns = await prisma.$queryRaw`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
      ORDER BY ordinal_position;
    `;

    const profileColumnNames = profilesColumns.map(c => c.column_name);
    console.log(`   Found ${profileColumnNames.length} columns`);

    const requiredProfileColumns = [
      'id', 'email', 'subscription_tier', 'subscription_status',
      'stripe_customer_id', 'stripe_subscription_id'
    ];

    const missingProfileColumns = requiredProfileColumns.filter(col => !profileColumnNames.includes(col));
    if (missingProfileColumns.length > 0) {
      console.log(`   ❌ Missing columns: ${missingProfileColumns.join(', ')}`);
    } else {
      console.log(`   ✓ All required subscription columns present`);
    }

    // Test 3: Check new tables exist
    console.log('\n3. Checking new tables...');
    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    const tableNames = tables.map(t => t.table_name);
    console.log(`   Found ${tableNames.length} tables:`, tableNames.join(', '));

    const requiredTables = [
      'sessions', 'profiles', 'matters', 'transcription_segments',
      'subscription_plans', 'invoices', 'usage_metrics', 'chat_messages',
      'citations', 'export_jobs', 'document_templates', 'generated_documents',
      'billable_time', 'feature_flags', 'system_logs', 'transcript_access_logs'
    ];

    const missingTables = requiredTables.filter(tbl => !tableNames.includes(tbl));
    if (missingTables.length > 0) {
      console.log(`   ❌ Missing tables: ${missingTables.join(', ')}`);
    } else {
      console.log(`   ✓ All required tables present`);
    }

    // Test 4: Try to query with Prisma (using correct mapping)
    console.log('\n4. Testing Prisma client queries...');
    const userCount = await prisma.user.count();
    console.log(`   ✓ User count: ${userCount}`);

    const sessionCount = await prisma.session.count();
    console.log(`   ✓ Session count: ${sessionCount}`);

    console.log('\n✅ Database schema verification complete!');

  } catch (error) {
    console.error('\n❌ Schema verification failed:');
    console.error(error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabaseSchema();
