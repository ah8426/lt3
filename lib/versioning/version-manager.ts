import { prisma } from '@/lib/prisma'
import { logAction } from '@/lib/audit/logger'
import { AuditAction, AuditResource } from '@/types/audit'

export interface VersionMetadata {
  changeType: 'manual_save' | 'auto_save' | 'segment_edit' | 'segment_add' | 'segment_delete' | 'restore' | 'pre_export' | 'pre_share'
  changedBy: string
  changeReason?: string
  segmentIds?: string[]
  totalSegments?: number
  totalCharacters?: number
}

export interface VersionData {
  id: string
  sessionId: string
  version: number
  segments: any[]
  changeType: string
  changedBy: string
  changeReason?: string
  diffSummary?: {
    added: number
    removed: number
    modified: number
  }
  createdAt: Date
}

/**
 * Create a new version snapshot of the transcript
 */
export async function createVersion(params: {
  sessionId: string
  userId: string
  changeType: VersionMetadata['changeType']
  changeReason?: string
  segmentIds?: string[]
}): Promise<VersionData> {
  const { sessionId, userId, changeType, changeReason, segmentIds } = params

  // Get current segments
  const segments = await prisma.transcriptSegment.findMany({
    where: { sessionId },
    orderBy: { startMs: 'asc' },
    select: {
      id: true,
      startMs: true,
      endMs: true,
      text: true,
      speakerId: true,
      speakerName: true,
      confidence: true,
      provider: true,
      isFinal: true,
      isEdited: true,
      editedBy: true,
    },
  })

  // Get next version number
  const lastVersion = await prisma.transcriptVersion.findFirst({
    where: { sessionId },
    orderBy: { version: 'desc' },
  })

  const nextVersion = (lastVersion?.version ?? 0) + 1

  // Calculate metadata
  const totalCharacters = segments.reduce((sum, seg) => sum + seg.text.length, 0)

  // Create version
  const version = await prisma.transcriptVersion.create({
    data: {
      sessionId,
      version: nextVersion,
      segments: segments,
      changeType,
      changedBy: userId,
      changeReason,
      diffSummary: segmentIds
        ? {
            added: 0,
            removed: 0,
            modified: segmentIds.length,
          }
        : undefined,
    },
  })

  // Log audit trail
  await logAction({
    userId,
    action: AuditAction.VERSION_CREATE,
    resource: AuditResource.TRANSCRIPT,
    resourceId: sessionId,
    metadata: {
      version: nextVersion,
      changeType,
      changeReason,
      segmentCount: segments.length,
      totalCharacters,
    },
  })

  return {
    id: version.id,
    sessionId: version.sessionId,
    version: version.version,
    segments: version.segments as any[],
    changeType: version.changeType,
    changedBy: version.changedBy,
    changeReason: version.changeReason ?? undefined,
    diffSummary: version.diffSummary as any,
    createdAt: version.createdAt,
  }
}

/**
 * Get version history for a session
 */
export async function getVersionHistory(params: {
  sessionId: string
  limit?: number
  offset?: number
}): Promise<{ versions: VersionData[]; total: number }> {
  const { sessionId, limit = 50, offset = 0 } = params

  const [versions, total] = await Promise.all([
    prisma.transcriptVersion.findMany({
      where: { sessionId },
      orderBy: { version: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.transcriptVersion.count({
      where: { sessionId },
    }),
  ])

  return {
    versions: versions.map((v) => ({
      id: v.id,
      sessionId: v.sessionId,
      version: v.version,
      segments: v.segments as any[],
      changeType: v.changeType,
      changedBy: v.changedBy,
      changeReason: v.changeReason ?? undefined,
      diffSummary: v.diffSummary as any,
      createdAt: v.createdAt,
    })),
    total,
  }
}

/**
 * Get a specific version
 */
export async function getVersion(params: {
  sessionId: string
  version: number
}): Promise<VersionData | null> {
  const { sessionId, version } = params

  const versionData = await prisma.transcriptVersion.findUnique({
    where: {
      sessionId_version: {
        sessionId,
        version,
      },
    },
  })

  if (!versionData) {
    return null
  }

  return {
    id: versionData.id,
    sessionId: versionData.sessionId,
    version: versionData.version,
    segments: versionData.segments as any[],
    changeType: versionData.changeType,
    changedBy: versionData.changedBy,
    changeReason: versionData.changeReason ?? undefined,
    diffSummary: versionData.diffSummary as any,
    createdAt: versionData.createdAt,
  }
}

/**
 * Compare two versions and generate diff summary
 */
export async function compareVersions(params: {
  sessionId: string
  fromVersion: number
  toVersion: number
}): Promise<{
  fromVersion: VersionData
  toVersion: VersionData
  diff: {
    added: number
    removed: number
    modified: number
    details: Array<{
      type: 'added' | 'removed' | 'modified'
      segmentId?: string
      oldText?: string
      newText?: string
      startMs?: number
    }>
  }
}> {
  const { sessionId, fromVersion, toVersion } = params

  const [from, to] = await Promise.all([
    getVersion({ sessionId, version: fromVersion }),
    getVersion({ sessionId, version: toVersion }),
  ])

  if (!from || !to) {
    throw new Error('Version not found')
  }

  // Create maps for comparison
  const fromSegments = new Map(from.segments.map((s: any) => [s.id, s]))
  const toSegments = new Map(to.segments.map((s: any) => [s.id, s]))

  const diff = {
    added: 0,
    removed: 0,
    modified: 0,
    details: [] as Array<{
      type: 'added' | 'removed' | 'modified'
      segmentId?: string
      oldText?: string
      newText?: string
      startMs?: number
    }>,
  }

  // Check for removed and modified segments
  fromSegments.forEach((oldSeg: any, id: string) => {
    const newSeg = toSegments.get(id)
    if (!newSeg) {
      diff.removed++
      diff.details.push({
        type: 'removed',
        segmentId: id,
        oldText: oldSeg.text,
        startMs: oldSeg.startMs,
      })
    } else if (oldSeg.text !== newSeg.text) {
      diff.modified++
      diff.details.push({
        type: 'modified',
        segmentId: id,
        oldText: oldSeg.text,
        newText: newSeg.text,
        startMs: newSeg.startMs,
      })
    }
  })

  // Check for added segments
  toSegments.forEach((newSeg: any, id: string) => {
    if (!fromSegments.has(id)) {
      diff.added++
      diff.details.push({
        type: 'added',
        segmentId: id,
        newText: newSeg.text,
        startMs: newSeg.startMs,
      })
    }
  })

  return {
    fromVersion: from,
    toVersion: to,
    diff,
  }
}

/**
 * Restore a previous version
 */
export async function restoreVersion(params: {
  sessionId: string
  version: number
  userId: string
  reason?: string
}): Promise<VersionData> {
  const { sessionId, version, userId, reason } = params

  // Get the version to restore
  const versionToRestore = await getVersion({ sessionId, version })

  if (!versionToRestore) {
    throw new Error('Version not found')
  }

  // Create a new version before restoring (backup current state)
  await createVersion({
    sessionId,
    userId,
    changeType: 'manual_save',
    changeReason: `Before restore to version ${version}`,
  })

  // Delete current segments
  await prisma.transcriptSegment.deleteMany({
    where: { sessionId },
  })

  // Restore segments from version
  const segments = versionToRestore.segments as any[]
  await prisma.transcriptSegment.createMany({
    data: segments.map((seg: any) => ({
      ...seg,
      isEdited: true,
      editedBy: userId,
    })),
  })

  // Create new version for the restore
  const restoredVersion = await createVersion({
    sessionId,
    userId,
    changeType: 'restore',
    changeReason: reason || `Restored from version ${version}`,
  })

  // Log audit trail
  await logAction({
    userId,
    action: AuditAction.VERSION_RESTORE,
    resource: AuditResource.TRANSCRIPT,
    resourceId: sessionId,
    metadata: {
      restoredFromVersion: version,
      newVersion: restoredVersion.version,
      reason,
    },
  })

  return restoredVersion
}

/**
 * Auto-save version if conditions are met
 */
export async function autoSaveVersion(params: {
  sessionId: string
  userId: string
}): Promise<VersionData | null> {
  const { sessionId, userId } = params

  // Check last version time
  const lastVersion = await prisma.transcriptVersion.findFirst({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
  })

  // Only auto-save if last version is older than 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
  if (lastVersion && lastVersion.createdAt > fiveMinutesAgo) {
    return null
  }

  return createVersion({
    sessionId,
    userId,
    changeType: 'auto_save',
    changeReason: 'Automatic version save',
  })
}
