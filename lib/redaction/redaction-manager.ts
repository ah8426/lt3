/**
 * Redaction Manager
 *
 * Handles creation, encryption, and access control for redacted content
 */

import { prisma } from '@/lib/prisma'
import { PIIType } from './pii-detector'
import { AuditAction, AuditResource } from '@/types/audit'
import { logAction } from '@/lib/audit/logger'
import { xchacha20poly1305 } from '@noble/ciphers/chacha'
import { randomBytes } from '@noble/hashes/utils'
import { sha256 } from '@noble/hashes/sha256'

export interface CreateRedactionParams {
  sessionId: string
  segmentId?: string
  originalText: string
  redactedText: string
  piiType: PIIType
  startOffset: number
  endOffset: number
  reason?: string
  legalBasis?: string
  userId: string
  accessControl?: string[] // User IDs who can unredact
}

export interface Redaction {
  id: string
  sessionId: string
  segmentId: string | null
  encryptedOriginal: string
  redactedText: string
  piiType: PIIType
  startOffset: number
  endOffset: number
  reason: string | null
  legalBasis: string | null
  createdBy: string
  createdAt: Date
  accessControl: string[]
}

export interface UnredactParams {
  redactionId: string
  userId: string
  reason: string
}

/**
 * Get encryption key from environment
 * In production, use a proper key management system (AWS KMS, HashiCorp Vault, etc.)
 */
function getEncryptionKey(): Uint8Array {
  const key = process.env.REDACTION_ENCRYPTION_KEY

  if (!key) {
    throw new Error('REDACTION_ENCRYPTION_KEY not configured')
  }

  // Hash the key to ensure it's exactly 32 bytes for XChaCha20-Poly1305
  return sha256(new TextEncoder().encode(key))
}

/**
 * Encrypt original text before storing
 */
export function encryptOriginal(text: string): {
  encrypted: string
  nonce: string
} {
  const key = getEncryptionKey()
  const nonce = randomBytes(24) // XChaCha20-Poly1305 uses 24-byte nonce

  const cipher = xchacha20poly1305(key, nonce)
  const plaintext = new TextEncoder().encode(text)
  const ciphertext = cipher.encrypt(plaintext)

  return {
    encrypted: Buffer.from(ciphertext).toString('base64'),
    nonce: Buffer.from(nonce).toString('base64'),
  }
}

/**
 * Decrypt original text
 */
export function decryptOriginal(encrypted: string, nonce: string): string {
  const key = getEncryptionKey()
  const nonceBytes = Buffer.from(nonce, 'base64')
  const ciphertext = Buffer.from(encrypted, 'base64')

  const cipher = xchacha20poly1305(key, nonceBytes as any)
  const plaintext = cipher.decrypt(ciphertext as any)

  return new TextDecoder().decode(plaintext)
}

/**
 * Check if user has access to unredact
 */
export async function checkAccess(redactionId: string, userId: string): Promise<boolean> {
  const redaction = await prisma.redaction.findUnique({
    where: { id: redactionId },
    select: {
      createdBy: true,
      accessControl: true,
    },
  })

  if (!redaction) {
    return false
  }

  // Creator always has access
  if (redaction.createdBy === userId) {
    return true
  }

  // Check access control list
  const accessList = redaction.accessControl as string[]
  return accessList.includes(userId)
}

/**
 * Create a redaction
 */
export async function createRedaction(
  params: CreateRedactionParams
): Promise<Redaction> {
  const {
    sessionId,
    segmentId,
    originalText,
    redactedText,
    piiType,
    startOffset,
    endOffset,
    reason,
    legalBasis,
    userId,
    accessControl = [],
  } = params

  // Encrypt the original text
  const { encrypted, nonce } = encryptOriginal(originalText)

  // Create redaction in database
  const redaction = await prisma.redaction.create({
    data: {
      sessionId,
      segmentId: segmentId || null,
      encryptedOriginal: encrypted,
      encryptionNonce: nonce,
      redactedText,
      piiType,
      startOffset,
      endOffset,
      reason,
      legalBasis,
      createdBy: userId,
      accessControl: [...accessControl, userId], // Always include creator
    },
  })

  // Log the redaction action
  await logAction({
    userId,
    action: AuditAction.REDACTION_CREATE,
    resource: AuditResource.TRANSCRIPT,
    resourceId: sessionId,
    metadata: {
      redactionId: redaction.id,
      piiType,
      segmentId,
    },
  })

  return {
    id: redaction.id,
    sessionId: redaction.sessionId,
    segmentId: redaction.segmentId,
    encryptedOriginal: redaction.encryptedOriginal,
    redactedText: redaction.redactedText,
    piiType: redaction.piiType as PIIType,
    startOffset: redaction.startOffset,
    endOffset: redaction.endOffset,
    reason: redaction.reason,
    legalBasis: redaction.legalBasis,
    createdBy: redaction.createdBy,
    createdAt: redaction.createdAt,
    accessControl: redaction.accessControl as string[],
  }
}

/**
 * Unredact text (if authorized)
 */
export async function unredact(params: UnredactParams): Promise<string> {
  const { redactionId, userId, reason } = params

  // Check access
  const hasAccess = await checkAccess(redactionId, userId)
  if (!hasAccess) {
    throw new Error('Unauthorized: You do not have permission to unredact this content')
  }

  // Get redaction
  const redaction = await prisma.redaction.findUnique({
    where: { id: redactionId },
    select: {
      encryptedOriginal: true,
      encryptionNonce: true,
      sessionId: true,
      piiType: true,
    },
  })

  if (!redaction) {
    throw new Error('Redaction not found')
  }

  // Decrypt original text
  const originalText = decryptOriginal(
    redaction.encryptedOriginal,
    redaction.encryptionNonce
  )

  // Log the unredaction
  await logAction({
    userId,
    action: AuditAction.REDACTION_UNREDACT,
    resource: AuditResource.TRANSCRIPT,
    resourceId: redaction.sessionId,
    metadata: {
      redactionId,
      piiType: redaction.piiType,
      reason,
    },
  })

  return originalText
}

/**
 * Delete a redaction
 */
export async function deleteRedaction(
  redactionId: string,
  userId: string
): Promise<void> {
  // Get redaction to check ownership
  const redaction = await prisma.redaction.findUnique({
    where: { id: redactionId },
    select: {
      createdBy: true,
      sessionId: true,
      piiType: true,
    },
  })

  if (!redaction) {
    throw new Error('Redaction not found')
  }

  // Only creator can delete
  if (redaction.createdBy !== userId) {
    throw new Error('Unauthorized: Only the creator can delete a redaction')
  }

  // Delete redaction
  await prisma.redaction.delete({
    where: { id: redactionId },
  })

  // Log deletion
  await logAction({
    userId,
    action: AuditAction.REDACTION_DELETE,
    resource: AuditResource.TRANSCRIPT,
    resourceId: redaction.sessionId,
    metadata: {
      redactionId,
      piiType: redaction.piiType,
    },
  })
}

/**
 * Get all redactions for a session
 */
export async function getRedactions(
  sessionId: string,
  options?: {
    segmentId?: string
    piiType?: PIIType
  }
): Promise<Redaction[]> {
  const where: any = { sessionId }

  if (options?.segmentId) {
    where.segmentId = options.segmentId
  }

  if (options?.piiType) {
    where.piiType = options.piiType
  }

  const redactions = await prisma.redaction.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  return redactions.map((r) => ({
    id: r.id,
    sessionId: r.sessionId,
    segmentId: r.segmentId,
    encryptedOriginal: r.encryptedOriginal,
    redactedText: r.redactedText,
    piiType: r.piiType as PIIType,
    startOffset: r.startOffset,
    endOffset: r.endOffset,
    reason: r.reason,
    legalBasis: r.legalBasis,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    accessControl: r.accessControl as string[],
  }))
}

/**
 * Get redaction by ID
 */
export async function getRedaction(redactionId: string): Promise<Redaction | null> {
  const redaction = await prisma.redaction.findUnique({
    where: { id: redactionId },
  })

  if (!redaction) return null

  return {
    id: redaction.id,
    sessionId: redaction.sessionId,
    segmentId: redaction.segmentId,
    encryptedOriginal: redaction.encryptedOriginal,
    redactedText: redaction.redactedText,
    piiType: redaction.piiType as PIIType,
    startOffset: redaction.startOffset,
    endOffset: redaction.endOffset,
    reason: redaction.reason,
    legalBasis: redaction.legalBasis,
    createdBy: redaction.createdBy,
    createdAt: redaction.createdAt,
    accessControl: redaction.accessControl as string[],
  }
}

/**
 * Update redaction access control
 */
export async function updateAccessControl(
  redactionId: string,
  userId: string,
  accessControl: string[]
): Promise<Redaction> {
  // Get redaction to check ownership
  const redaction = await prisma.redaction.findUnique({
    where: { id: redactionId },
    select: { createdBy: true, sessionId: true },
  })

  if (!redaction) {
    throw new Error('Redaction not found')
  }

  // Only creator can update access control
  if (redaction.createdBy !== userId) {
    throw new Error('Unauthorized: Only the creator can update access control')
  }

  // Update access control (always include creator)
  const updated = await prisma.redaction.update({
    where: { id: redactionId },
    data: {
      accessControl: [...new Set([...accessControl, userId])],
    },
  })

  // Log update
  await logAction({
    userId,
    action: AuditAction.REDACTION_UPDATE,
    resource: AuditResource.TRANSCRIPT,
    resourceId: redaction.sessionId,
    metadata: {
      redactionId,
      accessControlUpdated: true,
    },
  })

  return {
    id: updated.id,
    sessionId: updated.sessionId,
    segmentId: updated.segmentId,
    encryptedOriginal: updated.encryptedOriginal,
    redactedText: updated.redactedText,
    piiType: updated.piiType as PIIType,
    startOffset: updated.startOffset,
    endOffset: updated.endOffset,
    reason: updated.reason,
    legalBasis: updated.legalBasis,
    createdBy: updated.createdBy,
    createdAt: updated.createdAt,
    accessControl: updated.accessControl as string[],
  }
}

/**
 * Apply redactions to text
 */
export function applyRedactions(text: string, redactions: Redaction[]): string {
  // Sort redactions by start offset (descending) to apply from end to beginning
  const sorted = [...redactions].sort((a, b) => b.startOffset - a.startOffset)

  let result = text

  for (const redaction of sorted) {
    const before = result.substring(0, redaction.startOffset)
    const after = result.substring(redaction.endOffset)
    result = before + redaction.redactedText + after
  }

  return result
}

/**
 * Get redaction statistics
 */
export async function getRedactionStats(sessionId: string): Promise<{
  total: number
  byType: Record<PIIType, number>
}> {
  const redactions = await prisma.redaction.findMany({
    where: { sessionId },
    select: { piiType: true },
  })

  const byType: Record<string, number> = {}

  redactions.forEach((r) => {
    byType[r.piiType] = (byType[r.piiType] || 0) + 1
  })

  return {
    total: redactions.length,
    byType: byType as Record<PIIType, number>,
  }
}
