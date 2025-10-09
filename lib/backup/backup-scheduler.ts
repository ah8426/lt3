import { prisma } from '@/lib/prisma'
import { createBackup, BackupOptions } from './backup-manager'

export type BackupFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'disabled'

export interface BackupSchedule {
  userId: string
  frequency: BackupFrequency
  enabled: boolean
  includeAudioFiles: boolean
  includeDocuments: boolean
  retentionDays: number
  lastBackupAt?: Date
  nextBackupAt?: Date
}

export interface BackupSettings {
  autoBackupEnabled: boolean
  frequency: BackupFrequency
  includeAudioFiles: boolean
  includeDocuments: boolean
  retentionDays: number
  maxBackups: number
  encryptBackups: boolean
}

/**
 * Get backup settings from user settings
 */
export function getBackupSettings(userSettings: any): BackupSettings {
  const backup = userSettings?.backup || {}

  return {
    autoBackupEnabled: backup.autoBackupEnabled ?? true,
    frequency: backup.frequency || 'daily',
    includeAudioFiles: backup.includeAudioFiles ?? false,
    includeDocuments: backup.includeDocuments ?? true,
    retentionDays: backup.retentionDays || 30,
    maxBackups: backup.maxBackups || 10,
    encryptBackups: backup.encryptBackups ?? true,
  }
}

/**
 * Calculate next backup time based on frequency
 */
export function calculateNextBackupTime(
  frequency: BackupFrequency,
  lastBackupAt?: Date
): Date | null {
  if (frequency === 'disabled') {
    return null
  }

  const now = new Date()
  const baseTime = lastBackupAt || now

  switch (frequency) {
    case 'hourly':
      return new Date(baseTime.getTime() + 60 * 60 * 1000) // +1 hour
    case 'daily':
      return new Date(baseTime.getTime() + 24 * 60 * 60 * 1000) // +1 day
    case 'weekly':
      return new Date(baseTime.getTime() + 7 * 24 * 60 * 60 * 1000) // +7 days
    case 'monthly':
      // Add 30 days
      return new Date(baseTime.getTime() + 30 * 24 * 60 * 60 * 1000)
    default:
      return null
  }
}

/**
 * Check if backup is due for a user
 */
export async function isBackupDue(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  })

  if (!user) {
    return false
  }

  const settings = getBackupSettings(user.settings)

  if (!settings.autoBackupEnabled || settings.frequency === 'disabled') {
    return false
  }

  // Get last backup
  const lastBackup = await prisma.backup.findFirst({
    where: {
      userId,
      type: 'full',
      status: 'completed',
    },
    orderBy: { createdAt: 'desc' },
  })

  const lastBackupAt = lastBackup?.createdAt

  // Calculate if backup is due
  const nextBackupTime = calculateNextBackupTime(
    settings.frequency,
    lastBackupAt
  )

  if (!nextBackupTime) {
    return false
  }

  return new Date() >= nextBackupTime
}

/**
 * Schedule backup for a user
 */
export async function scheduleBackup(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true, subscriptionTier: true },
  })

  if (!user) {
    throw new Error('User not found')
  }

  const settings = getBackupSettings(user.settings)

  // Check if auto-backup is enabled
  if (!settings.autoBackupEnabled || settings.frequency === 'disabled') {
    console.log(`[Backup] Auto-backup disabled for user ${userId}`)
    return
  }

  // Check if backup is due
  const isDue = await isBackupDue(userId)

  if (!isDue) {
    console.log(`[Backup] Backup not due yet for user ${userId}`)
    return
  }

  // Check subscription tier limits
  const frequencyAllowed = isFrequencyAllowedForTier(
    settings.frequency,
    user.subscriptionTier
  )

  if (!frequencyAllowed) {
    console.log(
      `[Backup] Frequency ${settings.frequency} not allowed for tier ${user.subscriptionTier}`
    )
    return
  }

  // Create backup
  console.log(`[Backup] Creating scheduled backup for user ${userId}`)

  try {
    const options: BackupOptions = {
      userId,
      includeAudioFiles: settings.includeAudioFiles,
      includeDocuments: settings.includeDocuments,
      scope: 'full',
      encryptionKey: settings.encryptBackups
        ? await getOrCreateEncryptionKey(userId)
        : undefined,
    }

    await createBackup(options)

    console.log(`[Backup] Scheduled backup completed for user ${userId}`)

    // Cleanup old backups
    await cleanupOldBackups(userId, settings.retentionDays, settings.maxBackups)
  } catch (error) {
    console.error(`[Backup] Failed to create scheduled backup:`, error)
    throw error
  }
}

/**
 * Check if backup frequency is allowed for subscription tier
 */
function isFrequencyAllowedForTier(
  frequency: BackupFrequency,
  tier: string
): boolean {
  const tierLimits: Record<string, BackupFrequency[]> = {
    free: ['weekly', 'monthly'],
    starter: ['daily', 'weekly', 'monthly'],
    professional: ['hourly', 'daily', 'weekly', 'monthly'],
    enterprise: ['hourly', 'daily', 'weekly', 'monthly'],
  }

  const allowedFrequencies = tierLimits[tier] || tierLimits.free

  return allowedFrequencies.includes(frequency)
}

/**
 * Get or create encryption key for user backups
 */
async function getOrCreateEncryptionKey(userId: string): Promise<string> {
  // In production, this should use a proper key management system (KMS)
  // For now, derive from user ID and environment secret
  const secret = process.env.BACKUP_ENCRYPTION_SECRET || 'default-secret-key'
  const { createHash } = await import('crypto')

  return createHash('sha256')
    .update(`${userId}:${secret}`)
    .digest('hex')
    .substring(0, 32)
}

/**
 * Cleanup old backups based on retention policy
 */
export async function cleanupOldBackups(
  userId: string,
  retentionDays: number,
  maxBackups: number
): Promise<void> {
  console.log(
    `[Backup] Cleaning up old backups for user ${userId} (retention: ${retentionDays} days, max: ${maxBackups})`
  )

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

  // Delete backups older than retention period
  const oldBackups = await prisma.backup.findMany({
    where: {
      userId,
      createdAt: { lt: cutoffDate },
      type: 'full',
    },
    orderBy: { createdAt: 'asc' },
  })

  if (oldBackups.length > 0) {
    console.log(`[Backup] Deleting ${oldBackups.length} old backups`)

    for (const backup of oldBackups) {
      try {
        await prisma.backup.delete({ where: { id: backup.id } })

        // Also delete from storage
        const { deleteBackup } = await import('./backup-manager')
        await deleteBackup(backup.id, userId)
      } catch (error) {
        console.error(`[Backup] Failed to delete backup ${backup.id}:`, error)
      }
    }
  }

  // If still over max backups, delete oldest
  const allBackups = await prisma.backup.findMany({
    where: {
      userId,
      type: 'full',
      status: 'completed',
    },
    orderBy: { createdAt: 'desc' },
  })

  if (allBackups.length > maxBackups) {
    const backupsToDelete = allBackups.slice(maxBackups)

    console.log(
      `[Backup] Deleting ${backupsToDelete.length} backups over max limit`
    )

    for (const backup of backupsToDelete) {
      try {
        await prisma.backup.delete({ where: { id: backup.id } })

        const { deleteBackup } = await import('./backup-manager')
        await deleteBackup(backup.id, userId)
      } catch (error) {
        console.error(`[Backup] Failed to delete backup ${backup.id}:`, error)
      }
    }
  }
}

/**
 * Run scheduled backups for all eligible users
 */
export async function runScheduledBackups(): Promise<{
  processed: number
  succeeded: number
  failed: number
  errors: Array<{ userId: string; error: string }>
}> {
  console.log('[Backup] Running scheduled backups for all users')

  const users = await prisma.user.findMany({
    where: {
      subscriptionStatus: 'active',
    },
    select: {
      id: true,
      settings: true,
      subscriptionTier: true,
    },
  })

  const results = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [] as Array<{ userId: string; error: string }>,
  }

  for (const user of users) {
    const settings = getBackupSettings(user.settings)

    if (!settings.autoBackupEnabled || settings.frequency === 'disabled') {
      continue
    }

    results.processed++

    try {
      await scheduleBackup(user.id)
      results.succeeded++
    } catch (error) {
      results.failed++
      results.errors.push({
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      console.error(`[Backup] Failed for user ${user.id}:`, error)
    }
  }

  console.log(
    `[Backup] Scheduled backups complete: ${results.succeeded}/${results.processed} succeeded, ${results.failed} failed`
  )

  return results
}

/**
 * Update user backup settings
 */
export async function updateBackupSettings(
  userId: string,
  settings: Partial<BackupSettings>
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true, subscriptionTier: true },
  })

  if (!user) {
    throw new Error('User not found')
  }

  // Validate frequency against subscription tier
  if (settings.frequency) {
    const allowed = isFrequencyAllowedForTier(
      settings.frequency,
      user.subscriptionTier
    )

    if (!allowed) {
      throw new Error(
        `Backup frequency '${settings.frequency}' not allowed for subscription tier '${user.subscriptionTier}'`
      )
    }
  }

  const currentSettings = user.settings as any
  const backupSettings = currentSettings?.backup || {}

  const updatedSettings = {
    ...currentSettings,
    backup: {
      ...backupSettings,
      ...settings,
    },
  }

  await prisma.user.update({
    where: { id: userId },
    data: { settings: updatedSettings },
  })

  console.log(`[Backup] Updated backup settings for user ${userId}`)
}

/**
 * Get backup schedule for a user
 */
export async function getBackupSchedule(
  userId: string
): Promise<BackupSchedule> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  })

  if (!user) {
    throw new Error('User not found')
  }

  const settings = getBackupSettings(user.settings)

  // Get last backup
  const lastBackup = await prisma.backup.findFirst({
    where: {
      userId,
      type: 'full',
      status: 'completed',
    },
    orderBy: { createdAt: 'desc' },
  })

  const lastBackupAt = lastBackup?.createdAt
  const nextBackupAt = calculateNextBackupTime(settings.frequency, lastBackupAt)

  return {
    userId,
    frequency: settings.frequency,
    enabled: settings.autoBackupEnabled,
    includeAudioFiles: settings.includeAudioFiles,
    includeDocuments: settings.includeDocuments,
    retentionDays: settings.retentionDays,
    lastBackupAt,
    nextBackupAt: nextBackupAt || undefined,
  }
}
