import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import * as tar from 'tar-stream'
import { createHash } from 'crypto'
import { Readable } from 'stream'
import { encryptData, decryptData } from '@/lib/crypto/encryption'

export interface BackupOptions {
  userId: string
  includeAudioFiles?: boolean
  includeDocuments?: boolean
  scope?: 'full' | 'matter' | 'session'
  scopeId?: string
  encryptionKey?: string
}

export interface BackupMetadata {
  id: string
  userId: string
  type: 'full' | 'matter' | 'session'
  scope: string
  scopeId?: string
  size: number
  checksum: string
  createdAt: Date
  encryptedWith?: string
  includesAudio: boolean
  includesDocuments: boolean
  version: string
}

export interface BackupManifest {
  version: string
  createdAt: string
  userId: string
  type: string
  scope: string
  scopeId?: string
  includesAudio: boolean
  includesDocuments: boolean
  tables: string[]
  recordCounts: Record<string, number>
}

const BACKUP_VERSION = '1.0.0'

/**
 * Create a complete backup of user data
 */
export async function createBackup(options: BackupOptions): Promise<{
  backupId: string
  size: number
  checksum: string
  path: string
}> {
  const {
    userId,
    includeAudioFiles = false,
    includeDocuments = true,
    scope = 'full',
    scopeId,
    encryptionKey,
  } = options

  console.log(`[Backup] Starting backup for user ${userId}, scope: ${scope}`)

  // Fetch all data for backup
  const data = await fetchBackupData(userId, scope, scopeId, includeDocuments)

  // Create manifest
  const manifest: BackupManifest = {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    userId,
    type: scope,
    scope,
    scopeId,
    includesAudio: includeAudioFiles,
    includesDocuments: includeDocuments,
    tables: Object.keys(data),
    recordCounts: Object.fromEntries(
      Object.entries(data).map(([table, records]) => [table, records.length])
    ),
  }

  console.log(`[Backup] Manifest created:`, manifest.recordCounts)

  // Create tar stream
  const pack = tar.pack()
  const chunks: Buffer[] = []

  // Collect tar data
  pack.on('data', (chunk: any) => {
    chunks.push(Buffer.from(chunk))
  })

  // Add manifest
  pack.entry({ name: 'manifest.json' }, JSON.stringify(manifest, null, 2))

  // Add data files
  for (const [table, records] of Object.entries(data)) {
    if (records.length > 0) {
      pack.entry(
        { name: `data/${table}.json` },
        JSON.stringify(records, null, 2)
      )
    }
  }

  // Finalize tar
  pack.finalize()

  // Wait for tar to complete
  await new Promise((resolve) => pack.on('end', resolve))

  // Combine chunks
  let backupBuffer = Buffer.concat(chunks as any)

  // Encrypt if key provided
  if (encryptionKey) {
    console.log(`[Backup] Encrypting backup...`)
    backupBuffer = await encryptBackup(backupBuffer, encryptionKey)
  }

  // Calculate checksum
  const checksum = createHash('sha256').update(backupBuffer as any).digest('hex')
  const size = backupBuffer.length

  console.log(`[Backup] Backup size: ${(size / 1024 / 1024).toFixed(2)} MB`)
  console.log(`[Backup] Checksum: ${checksum}`)

  // Upload to Supabase Storage
  const backupId = await uploadBackup(userId, backupBuffer, manifest, checksum)

  // Save backup metadata to database
  await saveBackupMetadata({
    id: backupId,
    userId,
    type: scope,
    scope,
    scopeId,
    size,
    checksum,
    createdAt: new Date(),
    encryptedWith: encryptionKey ? 'aes-256-gcm' : undefined,
    includesAudio: includeAudioFiles,
    includesDocuments: includeDocuments,
    version: BACKUP_VERSION,
  })

  console.log(`[Backup] Backup complete: ${backupId}`)

  return {
    backupId,
    size,
    checksum,
    path: `backups/${userId}/${backupId}.tar${encryptionKey ? '.enc' : ''}`,
  }
}

/**
 * Fetch all data for backup based on scope
 */
async function fetchBackupData(
  userId: string,
  scope: string,
  scopeId?: string,
  includeDocuments = true
): Promise<Record<string, any[]>> {
  const data: Record<string, any[]> = {}

  // User data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      avatarUrl: true,
      provider: true,
      subscriptionTier: true,
      settings: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  if (user) {
    data.users = [user]
  }

  if (scope === 'full') {
    // Full backup - all user data
    const matters = await prisma.matter.findMany({
      where: { userId },
      include: {
        sessions: {
          include: {
            segments: true,
            speakers: true,
            redactions: true,
            timestampProofs: true,
            chatMessages: true,
          },
        },
        documents: includeDocuments,
        billableTime: true,
      },
    })

    if (matters.length > 0) {
      data.matters = matters.map((m) => ({
        ...m,
        sessions: undefined,
      }))

      // Extract sessions
      const sessions = matters.flatMap((m) => m.sessions)
      if (sessions.length > 0) {
        data.sessions = sessions.map((s) => ({
          ...s,
          transcriptSegments: undefined,
          speakers: undefined,
          redactions: undefined,
          timestampProofs: undefined,
          chatMessages: undefined,
        }))

        data.transcriptSegments = sessions.flatMap((s) => s.segments)
        data.speakers = sessions.flatMap((s) => s.speakers)
        data.redactions = sessions.flatMap((s) => s.redactions)
        data.timestampProofs = sessions.flatMap((s) => s.timestampProofs)
        data.chatMessages = sessions.flatMap((s) => s.chatMessages)
      }

      // Extract documents
      if (includeDocuments) {
        data.documents = matters.flatMap((m) => m.documents || [])
      }

      // Extract billable time
      data.billableTime = matters.flatMap((m) => m.billableTime)
    }

    // Conflict checks
    const conflictChecks = await prisma.conflictCheck.findMany({
      where: { userId },
    })
    if (conflictChecks.length > 0) {
      data.conflictChecks = conflictChecks
    }

    // Export jobs
    const exportJobs = await prisma.exportJob.findMany({
      where: { userId },
    })
    if (exportJobs.length > 0) {
      data.exportJobs = exportJobs
    }
  } else if (scope === 'matter' && scopeId) {
    // Matter-specific backup
    const matter = await prisma.matter.findFirst({
      where: { id: scopeId, userId },
      include: {
        sessions: {
          include: {
            segments: true,
            speakers: true,
            redactions: true,
            timestampProofs: true,
            chatMessages: true,
          },
        },
        documents: includeDocuments,
        billableTime: true,
      },
    })

    if (matter) {
      data.matters = [{ ...matter, sessions: undefined }]

      if (matter.sessions.length > 0) {
        data.sessions = matter.sessions.map((s) => ({
          ...s,
          transcriptSegments: undefined,
          speakers: undefined,
          redactions: undefined,
          timestampProofs: undefined,
          chatMessages: undefined,
        }))

        data.transcriptSegments = matter.sessions.flatMap(
          (s) => s.segments
        )
        data.speakers = matter.sessions.flatMap((s) => s.speakers)
        data.redactions = matter.sessions.flatMap((s) => s.redactions)
        data.timestampProofs = matter.sessions.flatMap((s) => s.timestampProofs)
        data.chatMessages = matter.sessions.flatMap((s) => s.chatMessages)
      }

      if (includeDocuments && matter.documents) {
        data.documents = matter.documents
      }

      if (matter.billableTime.length > 0) {
        data.billableTime = matter.billableTime
      }
    }
  } else if (scope === 'session' && scopeId) {
    // Session-specific backup
    const session = await prisma.session.findFirst({
      where: { id: scopeId, userId },
      include: {
        segments: true,
        speakers: true,
        redactions: true,
        timestampProofs: true,
        chatMessages: true,
        matter: true,
      },
    })

    if (session) {
      data.sessions = [
        {
          ...session,
          transcriptSegments: undefined,
          speakers: undefined,
          redactions: undefined,
          timestampProofs: undefined,
          chatMessages: undefined,
          matter: undefined,
        },
      ]

      if (session.matter) {
        data.matters = [session.matter]
      }

      data.transcriptSegments = session.segments
      data.speakers = session.speakers
      data.redactions = session.redactions
      data.timestampProofs = session.timestampProofs
      data.chatMessages = session.chatMessages
    }
  }

  return data
}

/**
 * Encrypt backup data
 */
async function encryptBackup(
  data: Buffer,
  encryptionKey: string
): Promise<Buffer> {
  const encrypted = await encryptData(data.toString('base64'), encryptionKey)
  return Buffer.from(JSON.stringify(encrypted))
}

/**
 * Upload backup to Supabase Storage
 */
async function uploadBackup(
  userId: string,
  data: Buffer,
  manifest: BackupManifest,
  checksum: string
): Promise<string> {
  const supabase = await createClient()
  const backupId = `backup-${Date.now()}-${checksum.substring(0, 8)}`
  const fileName = `${backupId}.tar${manifest.version ? '.enc' : ''}`
  const path = `${userId}/${fileName}`

  // Upload to Supabase Storage
  const { error } = await supabase.storage
    .from('backups')
    .upload(path, data, {
      contentType: 'application/x-tar',
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    throw new Error(`Failed to upload backup: ${error.message}`)
  }

  return backupId
}

/**
 * Save backup metadata to database
 */
async function saveBackupMetadata(metadata: BackupMetadata): Promise<void> {
  await prisma.backup.create({
    data: {
      id: metadata.id,
      userId: metadata.userId,
      type: metadata.type,
      scope: metadata.scope,
      scopeId: metadata.scopeId,
      size: metadata.size,
      checksum: metadata.checksum,
      status: 'completed',
      encryptedWith: metadata.encryptedWith,
      includesAudio: metadata.includesAudio,
      includesDocuments: metadata.includesDocuments,
      metadata: {
        version: metadata.version,
        createdAt: metadata.createdAt.toISOString(),
      },
      createdAt: metadata.createdAt,
      completedAt: metadata.createdAt,
    },
  })
}

/**
 * List backups for a user
 */
export async function listBackups(
  userId: string,
  options?: {
    type?: string
    limit?: number
    offset?: number
  }
): Promise<BackupMetadata[]> {
  const backups = await prisma.backup.findMany({
    where: {
      userId,
      type: options?.type,
      status: 'completed',
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0,
  })

  return backups.map((b) => ({
    id: b.id,
    userId: b.userId!,
    type: b.type as 'full' | 'matter' | 'session',
    scope: b.scope,
    scopeId: b.scopeId || undefined,
    size: b.size,
    checksum: b.checksum,
    createdAt: b.createdAt,
    encryptedWith: b.encryptedWith || undefined,
    includesAudio: b.includesAudio,
    includesDocuments: b.includesDocuments,
    version: (b.metadata as any)?.version || '1.0.0',
  }))
}

/**
 * Delete a backup
 */
export async function deleteBackup(
  backupId: string,
  userId: string
): Promise<void> {
  // Get backup metadata
  const backup = await prisma.backup.findFirst({
    where: { id: backupId, userId },
  })

  if (!backup) {
    throw new Error('Backup not found')
  }

  // Delete from Supabase Storage
  const supabase = await createClient()
  const fileName = `${backupId}.tar${backup.encryptedWith ? '.enc' : ''}`
  const path = `${userId}/${fileName}`

  const { error } = await supabase.storage.from('backups').remove([path])

  if (error) {
    console.error(`[Backup] Failed to delete from storage: ${error.message}`)
  }

  // Delete from database
  await prisma.backup.delete({
    where: { id: backupId },
  })

  console.log(`[Backup] Deleted backup: ${backupId}`)
}

/**
 * Get backup download URL
 */
export async function getBackupDownloadUrl(
  backupId: string,
  userId: string,
  expiresIn = 3600
): Promise<string> {
  const backup = await prisma.backup.findFirst({
    where: { id: backupId, userId },
  })

  if (!backup) {
    throw new Error('Backup not found')
  }

  const supabase = await createClient()
  const fileName = `${backupId}.tar${backup.encryptedWith ? '.enc' : ''}`
  const path = `${userId}/${fileName}`

  const { data, error } = await supabase.storage
    .from('backups')
    .createSignedUrl(path, expiresIn)

  if (error || !data) {
    throw new Error(`Failed to create download URL: ${error?.message}`)
  }

  return data.signedUrl
}
