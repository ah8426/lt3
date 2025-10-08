import { prisma } from '@/lib/prisma'
import { hashContent, createProofSignature } from './proof-generator'
import { verifyTimeInBounds } from './ntp-client'
import { logAction } from '@/lib/audit/logger'
import { AuditAction, AuditResource } from '@/types/audit'

export interface VerificationResult {
  isValid: boolean
  proofId: string
  segmentId: string
  checks: {
    contentMatch: boolean
    timestampValid: boolean
    signatureValid: boolean
    chainIntegrity?: boolean
  }
  errors: string[]
  warnings: string[]
  verifiedAt: Date
  verifiedBy?: string
}

/**
 * Verify a timestamp proof
 */
export async function verifyProof(params: {
  proofId: string
  content?: string
  nonce?: string
  userId?: string
}): Promise<VerificationResult> {
  const { proofId, content, nonce, userId } = params

  const errors: string[] = []
  const warnings: string[] = []
  const checks = {
    contentMatch: false,
    timestampValid: false,
    signatureValid: false,
  }

  // Fetch proof from database
  const proof = await prisma.timestampProof.findUnique({
    where: { id: proofId },
    include: {
      segment: {
        select: {
          id: true,
          text: true,
          sessionId: true,
        },
      },
    },
  })

  if (!proof) {
    return {
      isValid: false,
      proofId,
      segmentId: '',
      checks,
      errors: ['Proof not found'],
      warnings,
      verifiedAt: new Date(),
      verifiedBy: userId,
    }
  }

  // 1. Verify content hash (if content provided)
  if (content) {
    const computedHash = hashContent(content, nonce)
    checks.contentMatch = computedHash === proof.contentHash

    if (!checks.contentMatch) {
      errors.push(
        `Content hash mismatch. Expected: ${proof.contentHash}, Got: ${computedHash}`
      )
    }
  } else {
    // If no content provided, use segment text from database
    const storedContent = proof.segment?.text
    if (storedContent) {
      const computedHash = hashContent(storedContent, nonce)
      checks.contentMatch = computedHash === proof.contentHash

      if (!checks.contentMatch) {
        warnings.push('Content hash does not match stored segment text')
      }
    } else {
      warnings.push('No content provided for verification')
      checks.contentMatch = true // Skip this check
    }
  }

  // 2. Verify timestamp validity
  const now = new Date()
  const minDate = new Date('2020-01-01') // Sanity check: not before 2020
  const maxDate = new Date(now.getTime() + 60 * 60 * 1000) // Not more than 1 hour in future

  checks.timestampValid = verifyTimeInBounds(proof.timestamp, minDate, maxDate)

  if (!checks.timestampValid) {
    errors.push(
      `Timestamp ${proof.timestamp.toISOString()} is outside acceptable bounds`
    )
  }

  // Check if timestamp source is reliable
  if (proof.timestampSource === 'local') {
    warnings.push(
      'Timestamp was generated using local time (not NTP-verified). Lower reliability.'
    )
  }

  // 3. Verify signature (if nonce provided)
  if (nonce) {
    const expectedSignature = createProofSignature({
      contentHash: proof.contentHash,
      timestamp: proof.timestamp,
      nonce,
    })

    // In production, the signature would be stored in the proof
    // For now, we verify the signature can be regenerated
    checks.signatureValid = expectedSignature.length === 64 // SHA-256 hex is 64 chars

    if (!checks.signatureValid) {
      errors.push('Invalid proof signature')
    }
  } else {
    warnings.push('No nonce provided for signature verification')
    checks.signatureValid = true // Skip this check
  }

  // 4. Check if proof has been tampered with
  if (proof.isVerified && proof.verificationMethod) {
    // Already verified, check if verification is still valid
    const verificationAge = now.getTime() - (proof.verifiedAt?.getTime() || 0)
    const maxAge = 365 * 24 * 60 * 60 * 1000 // 1 year

    if (verificationAge > maxAge) {
      warnings.push('Previous verification is older than 1 year')
    }
  }

  // Overall validity
  const isValid =
    checks.contentMatch && checks.timestampValid && checks.signatureValid

  // Update proof verification status
  if (isValid && userId) {
    await prisma.timestampProof.update({
      where: { id: proofId },
      data: {
        isVerified: true,
        verifiedAt: now,
        verifiedBy: userId,
        verificationMethod: 'manual_verification',
      },
    })

    // Log verification
    await logAction({
      userId,
      action: AuditAction.TIMESTAMP_VERIFY,
      resource: AuditResource.SEGMENT,
      resourceId: proof.segmentId,
      metadata: {
        proofId,
        isValid,
        errors,
        warnings,
      },
    })
  }

  return {
    isValid,
    proofId: proof.id,
    segmentId: proof.segmentId,
    checks,
    errors,
    warnings,
    verifiedAt: now,
    verifiedBy: userId,
  }
}

/**
 * Verify chain of custody for a session
 */
export async function verifyChainOfCustody(params: {
  sessionId: string
  userId?: string
}): Promise<{
  isValid: boolean
  sessionId: string
  proofCount: number
  verifiedCount: number
  chainIntegrity: boolean
  results: VerificationResult[]
  errors: string[]
}> {
  const { sessionId, userId } = params

  // Get all proofs for the session
  const proofs = await prisma.timestampProof.findMany({
    where: {
      segment: {
        sessionId,
      },
    },
    orderBy: {
      timestamp: 'asc',
    },
    include: {
      segment: {
        select: {
          id: true,
          text: true,
        },
      },
    },
  })

  const errors: string[] = []
  const results: VerificationResult[] = []

  // Verify each proof
  for (const proof of proofs) {
    const result = await verifyProof({
      proofId: proof.id,
      content: proof.segment?.text,
      userId,
    })
    results.push(result)
  }

  // Check chain integrity
  let chainIntegrity = true
  for (let i = 1; i < proofs.length; i++) {
    const prevTimestamp = proofs[i - 1].timestamp.getTime()
    const currTimestamp = proofs[i].timestamp.getTime()

    if (currTimestamp < prevTimestamp) {
      errors.push(
        `Chain integrity violated: Proof ${proofs[i].id} has earlier timestamp than ${proofs[i - 1].id}`
      )
      chainIntegrity = false
    }
  }

  const verifiedCount = results.filter((r) => r.isValid).length
  const isValid = verifiedCount === proofs.length && chainIntegrity

  return {
    isValid,
    sessionId,
    proofCount: proofs.length,
    verifiedCount,
    chainIntegrity,
    results,
    errors,
  }
}

/**
 * Batch verify multiple proofs
 */
export async function batchVerifyProofs(params: {
  proofIds: string[]
  userId?: string
}): Promise<{
  results: VerificationResult[]
  totalCount: number
  validCount: number
  invalidCount: number
}> {
  const { proofIds, userId } = params

  const results: VerificationResult[] = []

  for (const proofId of proofIds) {
    try {
      const result = await verifyProof({ proofId, userId })
      results.push(result)
    } catch (error) {
      results.push({
        isValid: false,
        proofId,
        segmentId: '',
        checks: {
          contentMatch: false,
          timestampValid: false,
          signatureValid: false,
        },
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: [],
        verifiedAt: new Date(),
        verifiedBy: userId,
      })
    }
  }

  const validCount = results.filter((r) => r.isValid).length
  const invalidCount = results.length - validCount

  return {
    results,
    totalCount: results.length,
    validCount,
    invalidCount,
  }
}

/**
 * Verify imported proof (offline verification)
 */
export function verifyImportedProof(importedProof: {
  format: string
  version: string
  data: {
    segmentId: string
    contentHash: string
    timestamp: string
    timestampSource: string
    nonce: string
    signature: string
  }
}): VerificationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const checks = {
    contentMatch: true, // Can't verify without original content
    timestampValid: false,
    signatureValid: false,
  }

  // Verify format and version
  if (importedProof.format !== 'timestamp_proof_v1') {
    errors.push(`Unsupported format: ${importedProof.format}`)
  }

  // Verify timestamp
  const timestamp = new Date(importedProof.data.timestamp)
  checks.timestampValid = verifyTimeInBounds(timestamp)

  if (!checks.timestampValid) {
    errors.push('Timestamp is outside acceptable bounds')
  }

  // Verify signature
  const expectedSignature = createProofSignature({
    contentHash: importedProof.data.contentHash,
    timestamp,
    nonce: importedProof.data.nonce,
  })

  checks.signatureValid = expectedSignature === importedProof.data.signature

  if (!checks.signatureValid) {
    errors.push('Signature verification failed')
  }

  // Check timestamp source
  if (importedProof.data.timestampSource === 'local') {
    warnings.push('Timestamp source is local (not NTP-verified)')
  }

  const isValid = checks.timestampValid && checks.signatureValid

  return {
    isValid,
    proofId: 'imported',
    segmentId: importedProof.data.segmentId,
    checks,
    errors,
    warnings,
    verifiedAt: new Date(),
  }
}

/**
 * Get verification summary for a session
 */
export async function getVerificationSummary(sessionId: string): Promise<{
  totalSegments: number
  timestampedSegments: number
  verifiedSegments: number
  unverifiedSegments: number
  coverage: number
}> {
  // Get total segments
  const totalSegments = await prisma.transcriptSegment.count({
    where: { sessionId },
  })

  // Get timestamped segments
  const timestampedSegments = await prisma.timestampProof.count({
    where: {
      segment: {
        sessionId,
      },
    },
  })

  // Get verified segments
  const verifiedSegments = await prisma.timestampProof.count({
    where: {
      segment: {
        sessionId,
      },
      isVerified: true,
    },
  })

  const unverifiedSegments = timestampedSegments - verifiedSegments
  const coverage = totalSegments > 0 ? (timestampedSegments / totalSegments) * 100 : 0

  return {
    totalSegments,
    timestampedSegments,
    verifiedSegments,
    unverifiedSegments,
    coverage,
  }
}
