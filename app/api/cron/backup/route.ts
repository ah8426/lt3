import { NextRequest, NextResponse } from 'next/server'
import { runScheduledBackups } from '@/lib/backup/backup-scheduler'

/**
 * POST /api/cron/backup - Run scheduled backups for all eligible users
 *
 * This endpoint should be called by Vercel Cron or similar scheduled job system.
 *
 * Vercel Cron configuration (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/backup",
 *     "schedule": "0 * * * *"  // Every hour
 *   }]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[Cron] Starting scheduled backup job')

    const results = await runScheduledBackups()

    console.log(
      `[Cron] Backup job complete: ${results.succeeded}/${results.processed} succeeded`
    )

    return NextResponse.json({
      success: true,
      results: {
        processed: results.processed,
        succeeded: results.succeeded,
        failed: results.failed,
        errors: results.errors,
      },
    })
  } catch (error) {
    console.error('[Cron] Backup job failed:', error)

    return NextResponse.json(
      {
        error: 'Backup job failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cron/backup - Health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/cron/backup',
    description: 'Scheduled backup cron job',
  })
}
