/**
 * Conflict of Interest Checker
 *
 * Searches for potential conflicts across matters, clients, and adverse parties
 */

import { prisma } from '@/lib/prisma'
import {
  fuzzyMatch,
  fuzzyMatchMultiple,
  normalizeName,
  extractEntities,
  calculateTextSimilarity,
} from './name-matcher'
import type { AuditAction, AuditResource } from '@/lib/audit/logger'
import { logAction } from '@/lib/audit/logger'

// Re-export types from separate file to avoid server-only imports in client components
export type {
  ConflictMatch,
  ConflictCheckParams,
  ConflictCheckResult,
} from './types'
export { RiskLevel, ConflictStatus } from './types'

import type { ConflictMatch, ConflictCheckParams, ConflictCheckResult } from './types'
import { RiskLevel, ConflictStatus } from './types'

/**
 * Calculate risk level based on similarity score and context
 */
function calculateRiskLevel(
  similarityScore: number,
  matchType: string
): RiskLevel {
  // Direct client match is always high risk
  if (matchType === 'client') {
    if (similarityScore >= 0.95) return RiskLevel.CRITICAL
    if (similarityScore >= 0.85) return RiskLevel.HIGH
    if (similarityScore >= 0.75) return RiskLevel.MEDIUM
    return RiskLevel.LOW
  }

  // Adverse party match is high risk
  if (matchType === 'adverse_party') {
    if (similarityScore >= 0.9) return RiskLevel.HIGH
    if (similarityScore >= 0.8) return RiskLevel.MEDIUM
    return RiskLevel.LOW
  }

  // Matter description similarity
  if (matchType === 'matter') {
    if (similarityScore >= 0.9) return RiskLevel.MEDIUM
    if (similarityScore >= 0.8) return RiskLevel.LOW
    return RiskLevel.NONE
  }

  // Default
  if (similarityScore >= 0.9) return RiskLevel.MEDIUM
  if (similarityScore >= 0.75) return RiskLevel.LOW
  return RiskLevel.NONE
}

/**
 * Get overall risk level from multiple matches
 */
function getOverallRiskLevel(conflicts: ConflictMatch[]): RiskLevel {
  if (conflicts.length === 0) return RiskLevel.NONE

  const hasCritical = conflicts.some((c) => c.riskLevel === RiskLevel.CRITICAL)
  const hasHigh = conflicts.some((c) => c.riskLevel === RiskLevel.HIGH)
  const hasMedium = conflicts.some((c) => c.riskLevel === RiskLevel.MEDIUM)

  if (hasCritical) return RiskLevel.CRITICAL
  if (hasHigh) return RiskLevel.HIGH
  if (hasMedium) return RiskLevel.MEDIUM
  if (conflicts.some((c) => c.riskLevel === RiskLevel.LOW)) return RiskLevel.LOW

  return RiskLevel.NONE
}

/**
 * Search for conflicts against client name
 */
async function searchClientConflicts(
  clientName: string,
  userId: string,
  excludeMatterId?: string
): Promise<ConflictMatch[]> {
  const conflicts: ConflictMatch[] = []

  // Get all matters for this user
  const matters = await prisma.matter.findMany({
    where: {
      userId,
      id: excludeMatterId ? { not: excludeMatterId } : undefined,
    },
    select: {
      id: true,
      clientName: true,
      adverseParty: true,
      description: true,
      title: true,
      createdAt: true,
    },
  })

  // Check against existing client names
  matters.forEach((matter) => {
    if (!matter.clientName) return

    const match = fuzzyMatch(clientName, matter.clientName, 0.7)
    if (match.matches) {
      const riskLevel = calculateRiskLevel(match.score, 'client')
      if (riskLevel !== RiskLevel.NONE) {
        conflicts.push({
          id: `client-${matter.id}`,
          type: 'client',
          matterId: matter.id,
          matterTitle: matter.title,
          matterDescription: matter.description || undefined,
          clientName: matter.clientName,
          matchedName: matter.clientName,
          queryName: clientName,
          similarityScore: match.score,
          riskLevel,
          matchedAt: matter.createdAt,
        })
      }
    }
  })

  // Check if client name matches any adverse parties (HIGH RISK)
  matters.forEach((matter) => {
    if (!matter.adverseParty) return

    const match = fuzzyMatch(clientName, matter.adverseParty, 0.7)
    if (match.matches) {
      conflicts.push({
        id: `adverse-client-${matter.id}`,
        type: 'adverse_party',
        matterId: matter.id,
        matterTitle: matter.title,
        matterDescription: matter.description || undefined,
        adverseParty: matter.adverseParty,
        matchedName: matter.adverseParty,
        queryName: clientName,
        similarityScore: match.score,
        riskLevel: RiskLevel.CRITICAL, // Client matching adverse party is critical
        matchedAt: matter.createdAt,
      })
    }
  })

  return conflicts
}

/**
 * Search for conflicts against adverse parties
 */
async function searchAdversePartyConflicts(
  adverseParties: string[],
  userId: string,
  excludeMatterId?: string
): Promise<ConflictMatch[]> {
  const conflicts: ConflictMatch[] = []

  const matters = await prisma.matter.findMany({
    where: {
      userId,
      id: excludeMatterId ? { not: excludeMatterId } : undefined,
    },
    select: {
      id: true,
      clientName: true,
      adverseParty: true,
      description: true,
      title: true,
      createdAt: true,
    },
  })

  adverseParties.forEach((adverseParty) => {
    // Check against existing clients (CRITICAL)
    matters.forEach((matter) => {
      if (!matter.clientName) return

      const match = fuzzyMatch(adverseParty, matter.clientName, 0.7)
      if (match.matches) {
        conflicts.push({
          id: `adverse-vs-client-${matter.id}-${adverseParty}`,
          type: 'client',
          matterId: matter.id,
          matterTitle: matter.title,
          matterDescription: matter.description || undefined,
          clientName: matter.clientName,
          matchedName: matter.clientName,
          queryName: adverseParty,
          similarityScore: match.score,
          riskLevel: RiskLevel.CRITICAL, // Adverse party matching client is critical
          matchedAt: matter.createdAt,
        })
      }
    })

    // Check against existing adverse parties
    matters.forEach((matter) => {
      if (!matter.adverseParty) return

      const match = fuzzyMatch(adverseParty, matter.adverseParty, 0.7)
      if (match.matches) {
        const riskLevel = calculateRiskLevel(match.score, 'adverse_party')
        if (riskLevel !== RiskLevel.NONE) {
          conflicts.push({
            id: `adverse-${matter.id}-${adverseParty}`,
            type: 'adverse_party',
            matterId: matter.id,
            matterTitle: matter.title,
            matterDescription: matter.description || undefined,
            adverseParty: matter.adverseParty,
            matchedName: matter.adverseParty,
            queryName: adverseParty,
            similarityScore: match.score,
            riskLevel,
            matchedAt: matter.createdAt,
          })
        }
      }
    })
  })

  return conflicts
}

/**
 * Search for conflicts in matter descriptions
 */
async function searchMatterDescriptionConflicts(
  description: string,
  userId: string,
  excludeMatterId?: string
): Promise<ConflictMatch[]> {
  const conflicts: ConflictMatch[] = []

  // Extract entities from description
  const entities = extractEntities(description)

  const matters = await prisma.matter.findMany({
    where: {
      userId,
      id: excludeMatterId ? { not: excludeMatterId } : undefined,
      description: { not: null },
    },
    select: {
      id: true,
      title: true,
      description: true,
      clientName: true,
      createdAt: true,
    },
  })

  matters.forEach((matter) => {
    if (!matter.description) return

    // Calculate text similarity
    const similarity = calculateTextSimilarity(description, matter.description)

    if (similarity >= 0.7) {
      const riskLevel = calculateRiskLevel(similarity, 'matter')
      if (riskLevel !== RiskLevel.NONE) {
        conflicts.push({
          id: `matter-${matter.id}`,
          type: 'matter',
          matterId: matter.id,
          matterTitle: matter.title,
          matterDescription: matter.description,
          clientName: matter.clientName || undefined,
          matchedName: matter.title,
          queryName: 'Matter Description',
          similarityScore: similarity,
          riskLevel,
          matchedAt: matter.createdAt,
        })
      }
    }

    // Check entities against client names
    entities.forEach((entity) => {
      if (matter.clientName) {
        const match = fuzzyMatch(entity.text, matter.clientName, 0.75)
        if (match.matches) {
          const riskLevel = calculateRiskLevel(match.score, 'client')
          if (riskLevel !== RiskLevel.NONE) {
            conflicts.push({
              id: `entity-client-${matter.id}-${entity.text}`,
              type: 'client',
              matterId: matter.id,
              matterTitle: matter.title,
              matterDescription: matter.description,
              clientName: matter.clientName,
              matchedName: matter.clientName,
              queryName: entity.text,
              similarityScore: match.score,
              riskLevel,
              matchedAt: matter.createdAt,
              metadata: {
                entityType: entity.type,
                entityConfidence: entity.confidence,
              },
            })
          }
        }
      }
    })
  })

  return conflicts
}

/**
 * Main conflict check function
 */
export async function checkConflicts(
  params: ConflictCheckParams
): Promise<ConflictCheckResult> {
  const {
    clientName,
    adverseParties = [],
    companyNames = [],
    matterDescription,
    userId,
    excludeMatterId,
  } = params

  let allConflicts: ConflictMatch[] = []

  // Search client conflicts
  if (clientName) {
    const clientConflicts = await searchClientConflicts(
      clientName,
      userId,
      excludeMatterId
    )
    allConflicts.push(...clientConflicts)
  }

  // Search adverse party conflicts
  if (adverseParties.length > 0) {
    const adverseConflicts = await searchAdversePartyConflicts(
      adverseParties,
      userId,
      excludeMatterId
    )
    allConflicts.push(...adverseConflicts)
  }

  // Search company name conflicts
  if (companyNames.length > 0) {
    const companyConflicts = await searchAdversePartyConflicts(
      companyNames,
      userId,
      excludeMatterId
    )
    allConflicts.push(...companyConflicts)
  }

  // Search matter description conflicts
  if (matterDescription) {
    const descriptionConflicts = await searchMatterDescriptionConflicts(
      matterDescription,
      userId,
      excludeMatterId
    )
    allConflicts.push(...descriptionConflicts)
  }

  // Deduplicate conflicts by ID
  const uniqueConflicts = allConflicts.reduce((acc, conflict) => {
    if (!acc.find((c) => c.id === conflict.id)) {
      acc.push(conflict)
    }
    return acc
  }, [] as ConflictMatch[])

  // Sort by risk level and similarity score
  const sortedConflicts = uniqueConflicts.sort((a, b) => {
    const riskOrder = {
      [RiskLevel.CRITICAL]: 5,
      [RiskLevel.HIGH]: 4,
      [RiskLevel.MEDIUM]: 3,
      [RiskLevel.LOW]: 2,
      [RiskLevel.NONE]: 1,
    }
    const riskDiff = riskOrder[b.riskLevel] - riskOrder[a.riskLevel]
    if (riskDiff !== 0) return riskDiff
    return b.similarityScore - a.similarityScore
  })

  // Calculate statistics
  const riskCounts = {
    critical: sortedConflicts.filter((c) => c.riskLevel === RiskLevel.CRITICAL).length,
    high: sortedConflicts.filter((c) => c.riskLevel === RiskLevel.HIGH).length,
    medium: sortedConflicts.filter((c) => c.riskLevel === RiskLevel.MEDIUM).length,
    low: sortedConflicts.filter((c) => c.riskLevel === RiskLevel.LOW).length,
  }

  const overallRisk = getOverallRiskLevel(sortedConflicts)

  // Determine recommendation
  let recommendation: 'proceed' | 'review' | 'decline' = 'proceed'
  if (overallRisk === RiskLevel.CRITICAL || riskCounts.critical > 0) {
    recommendation = 'decline'
  } else if (overallRisk === RiskLevel.HIGH || riskCounts.high > 0) {
    recommendation = 'review'
  } else if (overallRisk === RiskLevel.MEDIUM || riskCounts.medium > 0) {
    recommendation = 'review'
  }

  // Generate summary
  let summary = ''
  if (sortedConflicts.length === 0) {
    summary = 'No conflicts detected. Safe to proceed.'
  } else if (recommendation === 'decline') {
    summary = `Critical conflicts detected (${riskCounts.critical} critical, ${riskCounts.high} high risk). Engagement should be declined.`
  } else if (recommendation === 'review') {
    summary = `Potential conflicts detected (${riskCounts.high} high, ${riskCounts.medium} medium risk). Manual review required before proceeding.`
  } else {
    summary = `${sortedConflicts.length} low-risk match(es) found. Review recommended but not required.`
  }

  // Log the conflict check
  await logAction({
    userId,
    action: AuditAction.SESSION_CREATE, // Would need new CONFLICT_CHECK action
    resource: AuditResource.SESSION,
    metadata: {
      conflictCheckPerformed: true,
      totalConflicts: sortedConflicts.length,
      riskLevel: overallRisk,
      recommendation,
      clientName,
      adverseParties,
      companyNames: companyNames.length,
    },
  })

  return {
    conflicts: sortedConflicts,
    riskLevel: overallRisk,
    totalMatches: sortedConflicts.length,
    highRiskCount: riskCounts.critical + riskCounts.high,
    mediumRiskCount: riskCounts.medium,
    lowRiskCount: riskCounts.low,
    recommendation,
    summary,
  }
}

/**
 * Save conflict check result
 */
export async function saveConflictCheck(
  result: ConflictCheckResult,
  params: ConflictCheckParams
): Promise<string> {
  const conflictCheck = await prisma.conflictCheck.create({
    data: {
      userId: params.userId,
      clientName: params.clientName || null,
      adverseParties: params.adverseParties || [],
      companyNames: params.companyNames || [],
      matterDescription: params.matterDescription || null,
      riskLevel: result.riskLevel,
      totalMatches: result.totalMatches,
      highRiskCount: result.highRiskCount,
      mediumRiskCount: result.mediumRiskCount,
      lowRiskCount: result.lowRiskCount,
      recommendation: result.recommendation,
      summary: result.summary,
      conflicts: result.conflicts as any, // JSONB
      status: ConflictStatus.PENDING,
    },
  })

  return conflictCheck.id
}

/**
 * Update conflict resolution
 */
export async function updateConflictResolution(
  conflictCheckId: string,
  status: ConflictStatus,
  notes?: string,
  userId?: string
): Promise<void> {
  await prisma.conflictCheck.update({
    where: { id: conflictCheckId },
    data: {
      status,
      resolutionNotes: notes,
      resolvedAt: new Date(),
      resolvedBy: userId || null,
    },
  })

  if (userId) {
    await logAction({
      userId,
      action: AuditAction.SESSION_UPDATE, // Would need CONFLICT_RESOLVE action
      resource: AuditResource.SESSION,
      resourceId: conflictCheckId,
      metadata: {
        conflictResolution: status,
        notes,
      },
    })
  }
}
