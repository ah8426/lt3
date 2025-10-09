import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import * as tar from 'tar-stream'
import { createHash } from 'crypto'
import { Readable } from 'stream'
import { decryptData } from '@/lib/crypto/encryption'
import { BackupManifest } from './backup-manager'

export interface RestoreOptions {
  backupId: string
  userId: string
  encryptionKey?: string
  verifyOnly?: boolean // Only verify, don't restore
  skipTables?: string[] // Tables to skip during restore
  overwriteExisting?: boolean // Overwrite existing data
}

export interface RestoreResult {
  success: boolean
  backupId: string
  manifest: BackupManifest
  tablesRestored: string[]
  recordsRestored: Record<string, number>
  errors: string[]
  warnings: string[]
}

/**
 * Restore data from a backup
 */
export async function restoreBackup(
  options: RestoreOptions
): Promise<RestoreResult> {
  const {
    backupId,
    userId,
    encryptionKey,
    verifyOnly = false,
    skipTables = [],
    overwriteExisting = false,
  } = options

  console.log(
    `[Restore] Starting restore for backup ${backupId}, verifyOnly: ${verifyOnly}`
  )

  const result: RestoreResult = {
    success: false,
    backupId,
    manifest: {} as BackupManifest,
    tablesRestored: [],
    recordsRestored: {},
    errors: [],
    warnings: [],
  }

  try {
    // Get backup metadata
    const backup = await prisma.backup.findFirst({
      where: { id: backupId, userId },
    })

    if (!backup) {
      throw new Error('Backup not found')
    }

    // Download backup file
    console.log('[Restore] Downloading backup file...')
    const backupBuffer = await downloadBackup(backupId, userId, backup.encryptedWith)

    // Verify checksum
    console.log('[Restore] Verifying checksum...')
    const calculatedChecksum = createHash('sha256')
      .update(backupBuffer)
      .digest('hex')

    if (calculatedChecksum !== backup.checksum) {
      throw new Error(
        `Checksum mismatch: expected ${backup.checksum}, got ${calculatedChecksum}`
      )
    }

    // Decrypt if encrypted
    let processedBuffer = backupBuffer
    if (backup.encryptedWith) {
      if (!encryptionKey) {
        throw new Error('Backup is encrypted but no encryption key provided')
      }
      console.log('[Restore] Decrypting backup...')
      processedBuffer = await decryptBackup(backupBuffer, encryptionKey)
    }

    // Extract tar archive
    console.log('[Restore] Extracting backup archive...')
    const extracted = await extractTarArchive(processedBuffer)

    // Parse manifest
    if (!extracted.has('manifest.json')) {
      throw new Error('Backup manifest not found')
    }

    const manifest: BackupManifest = JSON.parse(
      extracted.get('manifest.json')!.toString()
    )
    result.manifest = manifest

    console.log('[Restore] Manifest loaded:', manifest.recordCounts)

    // Verify manifest integrity
    const manifestChecks = verifyManifest(manifest, extracted)
    result.warnings.push(...manifestChecks.warnings)

    if (manifestChecks.errors.length > 0) {
      result.errors.push(...manifestChecks.errors)
      throw new Error('Manifest verification failed')
    }

    // If verify only, stop here
    if (verifyOnly) {
      console.log('[Restore] Verification complete (verify-only mode)')
      result.success = true
      return result
    }

    // Restore data
    console.log('[Restore] Restoring data...')
    const restoreResult = await restoreData(
      extracted,
      manifest,
      userId,
      skipTables,
      overwriteExisting
    )

    result.tablesRestored = restoreResult.tablesRestored
    result.recordsRestored = restoreResult.recordsRestored
    result.errors.push(...restoreResult.errors)
    result.warnings.push(...restoreResult.warnings)

    if (restoreResult.errors.length > 0) {
      throw new Error('Errors occurred during restore')
    }

    result.success = true
    console.log('[Restore] Restore completed successfully')

    // Update backup status
    await prisma.backup.update({
      where: { id: backupId },
      data: {
        lastRestoredAt: new Date(),
        restoreCount: { increment: 1 },
      },
    })
  } catch (error) {
    result.success = false
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    result.errors.push(errorMessage)
    console.error('[Restore] Restore failed:', error)
  }

  return result
}

/**
 * Download backup from storage
 */
async function downloadBackup(
  backupId: string,
  userId: string,
  isEncrypted?: string | null
): Promise<Buffer> {
  const supabase = await createClient()
  const fileName = `${backupId}.tar${isEncrypted ? '.enc' : ''}`
  const path = `${userId}/${fileName}`

  const { data, error } = await supabase.storage.from('backups').download(path)

  if (error || !data) {
    throw new Error(`Failed to download backup: ${error?.message}`)
  }

  return Buffer.from(await data.arrayBuffer())
}

/**
 * Decrypt backup data
 */
async function decryptBackup(
  data: Buffer,
  encryptionKey: string
): Promise<Buffer> {
  const encryptedData = JSON.parse(data.toString())
  const decrypted = await decryptData(encryptedData, encryptionKey)
  return Buffer.from(decrypted, 'base64')
}

/**
 * Extract tar archive
 */
async function extractTarArchive(
  buffer: Buffer
): Promise<Map<string, Buffer>> {
  const extract = tar.extract()
  const files = new Map<string, Buffer>()

  return new Promise((resolve, reject) => {
    const chunks = new Map<string, Buffer[]>()

    extract.on('entry', (header, stream, next) => {
      const entryChunks: Buffer[] = []

      stream.on('data', (chunk) => {
        entryChunks.push(Buffer.from(chunk))
      })

      stream.on('end', () => {
        files.set(header.name, Buffer.concat(entryChunks))
        next()
      })

      stream.resume()
    })

    extract.on('finish', () => {
      resolve(files)
    })

    extract.on('error', (error) => {
      reject(error)
    })

    // Write buffer to extract stream
    const readable = Readable.from(buffer)
    readable.pipe(extract)
  })
}

/**
 * Verify manifest integrity
 */
function verifyManifest(
  manifest: BackupManifest,
  extracted: Map<string, Buffer>
): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  // Check version compatibility
  if (manifest.version !== '1.0.0') {
    warnings.push(
      `Backup version ${manifest.version} may not be fully compatible with current version`
    )
  }

  // Verify all tables in manifest exist in extracted files
  for (const table of manifest.tables) {
    const fileName = `data/${table}.json`
    if (!extracted.has(fileName)) {
      errors.push(`Missing data file: ${fileName}`)
    }
  }

  // Verify record counts
  for (const [table, expectedCount] of Object.entries(manifest.recordCounts)) {
    const fileName = `data/${table}.json`
    if (extracted.has(fileName)) {
      try {
        const data = JSON.parse(extracted.get(fileName)!.toString())
        const actualCount = Array.isArray(data) ? data.length : 0

        if (actualCount !== expectedCount) {
          warnings.push(
            `Record count mismatch for ${table}: expected ${expectedCount}, got ${actualCount}`
          )
        }
      } catch (error) {
        errors.push(`Failed to parse data file: ${fileName}`)
      }
    }
  }

  return { errors, warnings }
}

/**
 * Restore data to database
 */
async function restoreData(
  extracted: Map<string, Buffer>,
  manifest: BackupManifest,
  userId: string,
  skipTables: string[],
  overwriteExisting: boolean
): Promise<{
  tablesRestored: string[]
  recordsRestored: Record<string, number>
  errors: string[]
  warnings: string[]
}> {
  const tablesRestored: string[] = []
  const recordsRestored: Record<string, number> = {}
  const errors: string[] = []
  const warnings: string[] = []

  // Define restore order (respecting foreign key constraints)
  const restoreOrder = [
    'users',
    'matters',
    'sessions',
    'transcriptSegments',
    'speakers',
    'redactions',
    'timestampProofs',
    'auditLogs',
    'chatMessages',
    'documents',
    'billableTime',
    'conflictChecks',
    'exportJobs',
  ]

  for (const table of restoreOrder) {
    if (skipTables.includes(table)) {
      console.log(`[Restore] Skipping table: ${table}`)
      continue
    }

    const fileName = `data/${table}.json`
    if (!extracted.has(fileName)) {
      continue
    }

    try {
      const data = JSON.parse(extracted.get(fileName)!.toString())

      if (!Array.isArray(data) || data.length === 0) {
        continue
      }

      console.log(`[Restore] Restoring ${data.length} records to ${table}...`)

      const restored = await restoreTable(
        table,
        data,
        userId,
        overwriteExisting
      )

      tablesRestored.push(table)
      recordsRestored[table] = restored.count
      warnings.push(...restored.warnings)
    } catch (error) {
      const message = `Failed to restore ${table}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
      errors.push(message)
      console.error(`[Restore] ${message}`)
    }
  }

  return { tablesRestored, recordsRestored, errors, warnings }
}

/**
 * Restore a single table
 */
async function restoreTable(
  table: string,
  records: any[],
  userId: string,
  overwriteExisting: boolean
): Promise<{ count: number; warnings: string[] }> {
  const warnings: string[] = []
  let count = 0

  // Get Prisma model delegate
  const model = (prisma as any)[table]

  if (!model) {
    throw new Error(`Unknown table: ${table}`)
  }

  // Special handling for users table - only restore current user
  if (table === 'users') {
    const userRecord = records.find((r) => r.id === userId)
    if (userRecord && overwriteExisting) {
      await model.update({
        where: { id: userId },
        data: {
          settings: userRecord.settings,
          fullName: userRecord.fullName,
          avatarUrl: userRecord.avatarUrl,
        },
      })
      count = 1
    }
    return { count, warnings }
  }

  // Restore other records
  for (const record of records) {
    try {
      // Ensure record belongs to current user
      if (record.userId && record.userId !== userId) {
        warnings.push(`Skipping record with wrong userId in ${table}`)
        continue
      }

      if (overwriteExisting) {
        // Upsert record
        await model.upsert({
          where: { id: record.id },
          update: record,
          create: record,
        })
      } else {
        // Only create if doesn't exist
        const existing = await model.findUnique({
          where: { id: record.id },
        })

        if (!existing) {
          await model.create({ data: record })
        } else {
          warnings.push(`Skipping existing record ${record.id} in ${table}`)
          continue
        }
      }

      count++
    } catch (error) {
      warnings.push(
        `Failed to restore record ${record.id} in ${table}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
    }
  }

  return { count, warnings }
}

/**
 * Verify backup integrity without restoring
 */
export async function verifyBackup(
  backupId: string,
  userId: string,
  encryptionKey?: string
): Promise<RestoreResult> {
  return restoreBackup({
    backupId,
    userId,
    encryptionKey,
    verifyOnly: true,
  })
}

/**
 * Get restore preview (what would be restored)
 */
export async function getRestorePreview(
  backupId: string,
  userId: string,
  encryptionKey?: string
): Promise<{
  manifest: BackupManifest
  tables: Array<{
    name: string
    recordCount: number
    existingRecords: number
    newRecords: number
    conflicts: number
  }>
}> {
  // Download and verify backup
  const verifyResult = await verifyBackup(backupId, userId, encryptionKey)

  if (!verifyResult.success) {
    throw new Error(`Backup verification failed: ${verifyResult.errors.join(', ')}`)
  }

  const tables: Array<{
    name: string
    recordCount: number
    existingRecords: number
    newRecords: number
    conflicts: number
  }> = []

  // Check existing records for each table
  for (const [table, recordCount] of Object.entries(
    verifyResult.manifest.recordCounts
  )) {
    const model = (prisma as any)[table]

    if (!model || table === 'users') {
      continue
    }

    // Count existing records
    const existingCount = await model.count({
      where: { userId },
    })

    tables.push({
      name: table,
      recordCount,
      existingRecords: existingCount,
      newRecords: Math.max(0, recordCount - existingCount),
      conflicts: Math.min(recordCount, existingCount),
    })
  }

  return {
    manifest: verifyResult.manifest,
    tables,
  }
}
