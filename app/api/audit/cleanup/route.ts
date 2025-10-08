import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cleanupOldLogs } from '@/lib/audit/logger';

/**
 * POST /api/audit/cleanup
 * Cleanup old audit logs based on retention policy
 * This endpoint should be called by a cron job
 */
export async function POST(request: NextRequest) {
  try {
    // Verify this is an internal/cron request
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get retention days from query params or use default (90 days)
    const { searchParams } = request.nextUrl;
    const retentionDays = parseInt(searchParams.get('retentionDays') || '90', 10);

    if (retentionDays < 1 || retentionDays > 3650) {
      return NextResponse.json(
        { error: 'Retention days must be between 1 and 3650' },
        { status: 400 }
      );
    }

    // Run cleanup
    await cleanupOldLogs(retentionDays);

    return NextResponse.json({
      success: true,
      message: `Cleaned up audit logs older than ${retentionDays} days`,
      retentionDays,
    });
  } catch (error) {
    console.error('Error cleaning up audit logs:', error);
    return NextResponse.json({ error: 'Failed to cleanup audit logs' }, { status: 500 });
  }
}

/**
 * GET /api/audit/cleanup
 * Get cleanup statistics (for admin/monitoring)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication and admin status
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get total count of logs
    const { count: totalLogs } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true });

    // Get count of logs with retention holds
    const { count: heldLogs } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .not('retention_until', 'is', null);

    // Get count of logs older than 90 days (default retention)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { count: oldLogs } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', ninetyDaysAgo.toISOString())
      .is('retention_until', null);

    return NextResponse.json({
      totalLogs: totalLogs || 0,
      logsWithRetentionHold: heldLogs || 0,
      logsEligibleForCleanup: oldLogs || 0,
      retentionPolicy: {
        defaultDays: 90,
        description: 'Logs are kept for 90 days unless retention hold is set',
      },
    });
  } catch (error) {
    console.error('Error fetching cleanup statistics:', error);
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 });
  }
}
