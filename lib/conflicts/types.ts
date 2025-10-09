/**
 * Conflict of Interest Checker Types
 * Shared types for conflict checking functionality
 */

export enum RiskLevel {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ConflictStatus {
  PENDING = 'pending',
  WAIVED = 'waived',
  DECLINED = 'declined',
  SCREENED = 'screened',
  CLEARED = 'cleared',
}

export interface ConflictMatch {
  id: string
  type: 'client' | 'adverse_party' | 'matter' | 'session'
  matterId?: string
  matterTitle?: string
  matterDescription?: string
  clientName?: string
  adverseParty?: string
  sessionTitle?: string
  matchedName: string
  queryName: string
  similarityScore: number
  riskLevel: RiskLevel
  matchedAt: Date
  metadata?: Record<string, any>
}

export interface ConflictCheckParams {
  clientName?: string
  adverseParties?: string[]
  companyNames?: string[]
  matterDescription?: string
  userId: string
  excludeMatterId?: string // Exclude from search (e.g., current matter)
}

export interface ConflictCheckResult {
  conflicts: ConflictMatch[]
  riskLevel: RiskLevel
  totalMatches: number
  highRiskCount: number
  mediumRiskCount: number
  lowRiskCount: number
  recommendation: 'proceed' | 'review' | 'decline'
  summary: string
}
