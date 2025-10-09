import { prisma } from '@/lib/server/db'
import { logAction } from '@/lib/audit/logger'
import { AuditAction, AuditResource } from '@/types/audit'

export interface Speaker {
  id: string
  sessionId: string
  speakerNumber: number
  name: string
  role?: SpeakerRole
  organization?: string
  firstSpoke: Date
  lastSpoke: Date
  totalDuration: number
  segmentCount: number
  wordCount: number
  metadata?: any
  createdAt: Date
}

export type SpeakerRole =
  | 'attorney'
  | 'client'
  | 'witness'
  | 'expert'
  | 'judge'
  | 'court_reporter'
  | 'interpreter'
  | 'other'

export interface SpeakerStats {
  speakerId: string
  speakerNumber: number
  name?: string
  totalSegments: number
  totalWords: number
  speakingTimeMs: number
  averageConfidence: number
  firstAppearance: Date
  lastAppearance: Date
}

export interface CreateSpeakerParams {
  sessionId: string
  speakerNumber: number
  name?: string
  role?: SpeakerRole
  organization?: string
  userId: string
}

export interface UpdateSpeakerParams {
  speakerId: string
  name?: string
  role?: SpeakerRole
  organization?: string
  userId: string
}

export interface MergeSpeakersParams {
  sessionId: string
  fromSpeakerId: string
  toSpeakerId: string
  userId: string
}

/**
 * Create a new speaker for a session
 */
export async function createSpeaker(params: CreateSpeakerParams): Promise<Speaker> {
  const { sessionId, speakerNumber, name, role, organization, userId } = params

  // Check if speaker number already exists for this session
  const existing = await prisma.speaker.findFirst({
    where: {
      sessionId,
      speakerNumber,
    },
  })

  if (existing) {
    throw new Error(`Speaker ${speakerNumber} already exists for this session`)
  }

  // Create speaker
  const speaker = await prisma.speaker.create({
    data: {
      sessionId,
      speakerNumber,
      name: name || `Speaker ${speakerNumber + 1}`,
      role,
      organization,
      firstSpoke: new Date(),
      lastSpoke: new Date(),
      totalDuration: 0,
      segmentCount: 0,
      wordCount: 0,
    },
  })

  // Log action
  await logAction({
    userId,
    action: AuditAction.SPEAKER_CREATE,
    resource: AuditResource.TRANSCRIPT,
    resourceId: sessionId,
    metadata: {
      speakerId: speaker.id,
      speakerNumber,
      name,
      role,
    },
  })

  return speaker as Speaker
}

/**
 * Update speaker details
 */
export async function updateSpeaker(params: UpdateSpeakerParams): Promise<Speaker> {
  const { speakerId, name, role, organization, userId } = params

  // Get existing speaker
  const existing = await prisma.speaker.findUnique({
    where: { id: speakerId },
  })

  if (!existing) {
    throw new Error('Speaker not found')
  }

  // Update speaker
  const speaker = await prisma.speaker.update({
    where: { id: speakerId },
    data: {
      name,
      role,
      organization,
    },
  })

  // Log action
  await logAction({
    userId,
    action: AuditAction.SPEAKER_UPDATE,
    resource: AuditResource.TRANSCRIPT,
    resourceId: speaker.sessionId,
    metadata: {
      speakerId: speaker.id,
      speakerNumber: speaker.speakerNumber,
      changes: {
        name: name !== existing.name ? { old: existing.name, new: name } : undefined,
        role: role !== existing.role ? { old: existing.role, new: role } : undefined,
        organization:
          organization !== existing.organization
            ? { old: existing.organization, new: organization }
            : undefined,
      },
    },
  })

  return speaker as Speaker
}

/**
 * Merge two speakers (combine segments from one speaker to another)
 */
export async function mergeSpeakers(params: MergeSpeakersParams): Promise<void> {
  const { sessionId, fromSpeakerId, toSpeakerId, userId } = params

  // Get both speakers
  const [fromSpeaker, toSpeaker] = await Promise.all([
    prisma.speaker.findUnique({ where: { id: fromSpeakerId } }),
    prisma.speaker.findUnique({ where: { id: toSpeakerId } }),
  ])

  if (!fromSpeaker || !toSpeaker) {
    throw new Error('One or both speakers not found')
  }

  if (fromSpeaker.sessionId !== sessionId || toSpeaker.sessionId !== sessionId) {
    throw new Error('Speakers must belong to the same session')
  }

  // Update all segments from fromSpeaker to toSpeaker
  await prisma.transcriptSegment.updateMany({
    where: {
      sessionId,
      speakerId: fromSpeakerId,
    },
    data: {
      speakerId: toSpeakerId,
      speakerName: toSpeaker.name,
    },
  })

  // Delete the merged speaker
  await prisma.speaker.delete({
    where: { id: fromSpeakerId },
  })

  // Log action
  await logAction({
    userId,
    action: AuditAction.SPEAKER_MERGE,
    resource: AuditResource.TRANSCRIPT,
    resourceId: sessionId,
    metadata: {
      fromSpeaker: {
        id: fromSpeaker.id,
        number: fromSpeaker.speakerNumber,
        name: fromSpeaker.name,
      },
      toSpeaker: {
        id: toSpeaker.id,
        number: toSpeaker.speakerNumber,
        name: toSpeaker.name,
      },
    },
  })
}

/**
 * Delete a speaker
 */
export async function deleteSpeaker(
  speakerId: string,
  userId: string
): Promise<void> {
  const speaker = await prisma.speaker.findUnique({
    where: { id: speakerId },
  })

  if (!speaker) {
    throw new Error('Speaker not found')
  }

  // Delete speaker (segments will have null speaker)
  await prisma.speaker.delete({
    where: { id: speakerId },
  })

  // Log action
  await logAction({
    userId,
    action: AuditAction.SPEAKER_DELETE,
    resource: AuditResource.TRANSCRIPT,
    resourceId: speaker.sessionId,
    metadata: {
      speakerId: speaker.id,
      speakerNumber: speaker.speakerNumber,
      name: speaker.name,
    },
  })
}

/**
 * Get all speakers for a session
 */
export async function getSpeakers(sessionId: string): Promise<Speaker[]> {
  const speakers = await prisma.speaker.findMany({
    where: { sessionId },
    orderBy: { speakerNumber: 'asc' },
  })
  return speakers as Speaker[]
}

/**
 * Get speaker by number
 */
export async function getSpeakerByNumber(
  sessionId: string,
  speakerNumber: number
): Promise<Speaker | null> {
  const speaker = await prisma.speaker.findFirst({
    where: {
      sessionId,
      speakerNumber,
    },
  })
  return speaker as Speaker | null
}

/**
 * Get or create speaker by number
 */
export async function getOrCreateSpeaker(
  sessionId: string,
  speakerNumber: number,
  userId: string
): Promise<Speaker> {
  let speaker = await getSpeakerByNumber(sessionId, speakerNumber)

  if (!speaker) {
    speaker = await createSpeaker({
      sessionId,
      speakerNumber,
      name: `Speaker ${speakerNumber + 1}`,
      userId,
    })
  }

  return speaker as Speaker
}

/**
 * Get statistics for a speaker
 */
export async function getSpeakerStats(
  sessionId: string,
  speakerNumber: number
): Promise<SpeakerStats | null> {
  // Get speaker
  const speaker = await getSpeakerByNumber(sessionId, speakerNumber)
  if (!speaker) return null

  // Get all segments for this speaker
  const segments = await prisma.transcriptSegment.findMany({
    where: {
      sessionId,
      speakerId: speaker.id,
    },
    orderBy: { startMs: 'asc' },
  })

  if (segments.length === 0) {
    return {
      speakerId: speaker.id,
      speakerNumber,
      name: speaker.name,
      totalSegments: 0,
      totalWords: 0,
      speakingTimeMs: 0,
      averageConfidence: 0,
      firstAppearance: speaker.createdAt,
      lastAppearance: speaker.createdAt,
    }
  }

  // Calculate statistics
  const totalWords = segments.reduce((sum, seg) => {
    return sum + (seg.text?.split(/\s+/).length || 0)
  }, 0)

  const speakingTimeMs = segments.reduce((sum, seg) => {
    return sum + (seg.endTime - seg.startTime)
  }, 0)

  const averageConfidence =
    segments.reduce((sum, seg) => sum + (seg.confidence || 0), 0) / segments.length

  const firstAppearance = segments[0].createdAt
  const lastAppearance = segments[segments.length - 1].createdAt

  return {
    speakerId: speaker.id,
    speakerNumber,
    name: speaker.name,
    totalSegments: segments.length,
    totalWords,
    speakingTimeMs,
    averageConfidence,
    firstAppearance,
    lastAppearance,
  }
}

/**
 * Get statistics for all speakers in a session
 */
export async function getAllSpeakerStats(
  sessionId: string
): Promise<SpeakerStats[]> {
  const speakers = await getSpeakers(sessionId)
  const stats = await Promise.all(
    speakers.map((speaker) => getSpeakerStats(sessionId, speaker.speakerNumber))
  )
  return stats.filter((s): s is SpeakerStats => s !== null)
}

/**
 * Auto-detect and create speakers from segments
 */
export async function autoDetectSpeakers(
  sessionId: string,
  userId: string
): Promise<Speaker[]> {
  // Get all segments with speakers
  const segments = await prisma.transcriptionSegment.findMany({
    where: {
      sessionId,
      speaker: { not: null },
    },
    select: {
      speaker: true,
    },
    distinct: ['speaker'],
    orderBy: { speaker: 'asc' },
  })

  // Get unique speaker numbers
  const speakerNumbers = segments
    .map((s) => s.speaker)
    .filter((n): n is number => n !== null)

  // Create speakers for each unique number
  const speakers: Speaker[] = []
  for (const speakerNumber of speakerNumbers) {
    const speaker = await getOrCreateSpeaker(sessionId, speakerNumber, userId)
    speakers.push(speaker)
  }

  return speakers as Speaker[]
}

/**
 * Generate a color for a speaker based on their number
 */
function generateSpeakerColor(speakerNumber: number): string {
  const colors = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#14B8A6', // teal
    '#F97316', // orange
    '#6366F1', // indigo
    '#84CC16', // lime
  ]

  return colors[speakerNumber % colors.length]
}

/**
 * Format speaking time to human readable format
 */
export function formatSpeakingTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  } else {
    return `${seconds}s`
  }
}

/**
 * Calculate speaking percentage
 */
export function calculateSpeakingPercentage(
  speakerTimeMs: number,
  totalTimeMs: number
): number {
  if (totalTimeMs === 0) return 0
  return Math.round((speakerTimeMs / totalTimeMs) * 100)
}
