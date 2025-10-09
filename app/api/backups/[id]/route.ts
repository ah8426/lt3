import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getBackupDownloadUrl,
  deleteBackup,
} from '@/lib/backup/backup-manager'
import { restoreBackup, verifyBackup, getRestorePreview } from '@/lib/backup/backup-restore'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const restoreBackupSchema = z.object({
  encryptionKey: z.string().optional(),
  verifyOnly: z.boolean().optional().default(false),
  skipTables: z.array(z.string()).optional().default([]),
  overwriteExisting: z.boolean().optional().default(false),
})

/**
 * GET /api/backups/[id] - Get backup details or download URL
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const backupId = params.id
    const action = request.nextUrl.searchParams.get('action')

    // Get backup metadata
    const backup = await prisma.backup.findFirst({
      where: { id: backupId, userId: user.id },
    })

    if (!backup) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 })
    }

    // Handle different actions
    if (action === 'download') {
      // Generate download URL
      const downloadUrl = await getBackupDownloadUrl(backupId, user.id, 3600)

      return NextResponse.json({ downloadUrl })
    } else if (action === 'preview') {
      // Get restore preview
      const encryptionKey = request.nextUrl.searchParams.get('encryptionKey') || undefined

      const preview = await getRestorePreview(backupId, user.id, encryptionKey)

      return NextResponse.json({ preview })
    } else if (action === 'verify') {
      // Verify backup integrity
      const encryptionKey = request.nextUrl.searchParams.get('encryptionKey') || undefined

      const verifyResult = await verifyBackup(backupId, user.id, encryptionKey)

      return NextResponse.json({ verification: verifyResult })
    } else {
      // Return backup details
      return NextResponse.json({
        backup: {
          id: backup.id,
          type: backup.type,
          scope: backup.scope,
          scopeId: backup.scopeId,
          size: backup.size,
          checksum: backup.checksum,
          status: backup.status,
          encryptedWith: backup.encryptedWith,
          includesAudio: backup.includesAudio,
          includesDocuments: backup.includesDocuments,
          metadata: backup.metadata,
          createdAt: backup.createdAt,
          completedAt: backup.completedAt,
          lastRestoredAt: backup.lastRestoredAt,
          restoreCount: backup.restoreCount,
        },
      })
    }
  } catch (error) {
    console.error('[API] Failed to get backup:', error)
    return NextResponse.json(
      {
        error: 'Failed to get backup',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/backups/[id] - Restore from backup
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const backupId = params.id
    const body = await request.json()
    const validated = restoreBackupSchema.parse(body)

    // Get encryption key if needed
    let encryptionKey = validated.encryptionKey

    if (!encryptionKey) {
      // Check if backup is encrypted
      const backup = await prisma.backup.findFirst({
        where: { id: backupId, userId: user.id },
      })

      if (backup?.encryptedWith) {
        // Generate encryption key
        const { createHash } = await import('crypto')
        const secret =
          process.env.BACKUP_ENCRYPTION_SECRET || 'default-secret-key'
        encryptionKey = createHash('sha256')
          .update(`${user.id}:${secret}`)
          .digest('hex')
          .substring(0, 32)
      }
    }

    // Restore backup
    const result = await restoreBackup({
      backupId,
      userId: user.id,
      encryptionKey,
      verifyOnly: validated.verifyOnly,
      skipTables: validated.skipTables,
      overwriteExisting: validated.overwriteExisting,
    })

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Restore failed',
          details: {
            errors: result.errors,
            warnings: result.warnings,
          },
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      restore: {
        backupId: result.backupId,
        tablesRestored: result.tablesRestored,
        recordsRestored: result.recordsRestored,
        warnings: result.warnings,
      },
    })
  } catch (error) {
    console.error('[API] Failed to restore backup:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to restore backup',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/backups/[id] - Delete a backup
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const backupId = params.id

    // Delete backup
    await deleteBackup(backupId, user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Failed to delete backup:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete backup',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
