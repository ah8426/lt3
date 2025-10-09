import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createBackup, listBackups } from '@/lib/backup/backup-manager'
import { getBackupSettings } from '@/lib/backup/backup-scheduler'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const createBackupSchema = z.object({
  scope: z.enum(['full', 'matter', 'session']).default('full'),
  scopeId: z.string().optional(),
  includeAudioFiles: z.boolean().optional(),
  includeDocuments: z.boolean().optional().default(true),
  encrypt: z.boolean().optional().default(true),
})

/**
 * GET /api/backups - List all backups for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || undefined
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const backups = await listBackups(user.id, { type, limit, offset })

    return NextResponse.json({ backups })
  } catch (error) {
    console.error('[API] Failed to list backups:', error)
    return NextResponse.json(
      { error: 'Failed to list backups' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/backups - Create a manual backup
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = createBackupSchema.parse(body)

    // Get user settings
    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: { settings: true },
    })

    if (!userRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const settings = getBackupSettings(userRecord.settings)

    // Get encryption key if needed
    let encryptionKey: string | undefined
    if (validated.encrypt && settings.encryptBackups) {
      const { createHash } = await import('crypto')
      const secret = process.env.BACKUP_ENCRYPTION_SECRET || 'default-secret-key'
      encryptionKey = createHash('sha256')
        .update(`${user.id}:${secret}`)
        .digest('hex')
        .substring(0, 32)
    }

    // Create backup
    const result = await createBackup({
      userId: user.id,
      scope: validated.scope,
      scopeId: validated.scopeId,
      includeAudioFiles:
        validated.includeAudioFiles ?? settings.includeAudioFiles,
      includeDocuments: validated.includeDocuments,
      encryptionKey,
    })

    return NextResponse.json({
      success: true,
      backup: {
        id: result.backupId,
        size: result.size,
        checksum: result.checksum,
        path: result.path,
      },
    })
  } catch (error) {
    console.error('[API] Failed to create backup:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to create backup',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
