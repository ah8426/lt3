// Re-export Supabase types
export type { Database } from './supabase'

// User types
export interface User {
  id: string
  email: string
  fullName?: string
  provider: string
  providerId: string
  firmId?: string
  roles: string[]
  subscriptionTier: string
  subscriptionStatus: string
  settings: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
}

// Session types
export interface Session {
  id: string
  matterId: string
  userId: string
  status: string
  title?: string
  description?: string
  startedAt: Date
  endedAt?: Date
  durationMs?: number
  audioStoragePath?: string
  transcriptData?: unknown
  totalCost: number
  asrProvider?: string
  aiProvider?: string
}

// Matter types
export interface Matter {
  id: string
  name: string
  clientName: string
  adverseParty?: string
  jurisdiction?: string
  courtType?: string
  caseNumber?: string
  status: string
  userId: string
  createdAt: Date
  updatedAt: Date
}
