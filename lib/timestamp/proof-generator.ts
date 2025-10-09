import { createHash, randomBytes } from 'crypto'
import { getTrustedTime, getNTPTimeSamples } from './ntp-client'
import { prisma } from '@/lib/prisma'
import { logAction } from '@/lib/audit/logger'
import { AuditAction, AuditResource } from '@/types/audit'

export interface TimestampProofParams {
  segmentId: string
  sessionId: string
  userId: string
  content: string
  useMultipleSamples?: boolean
}

export interface TimestampProof {
  id: string
  segmentId: string
  sessionId: string
  contentHash: string
  timestamp: Date
  timestampSource: 'ntp' | 'local'
  rfc3161Token?: string
  serverInfo?: any
  nonce: string
  isVerified: boolean
  verifiedAt?: Date
  verifiedBy?: string
  verificationMethod?: string
}

/**
 * Generate SHA-256 hash of content
 */
export function hashContent(content: string, nonce?: string): string {
  const hash = createHash('sha256')
  hash.update(content)
  if (nonce) {
    hash.update(nonce)
  }
  return hash.digest('hex')
}

/**
 * Generate a cryptographic nonce
 */
export function generateNonce(): string {
  return randomBytes(16).toString('hex')
}

/**
 * Create a timestamp proof for content
 */
export async function generateProof(
  params: TimestampProofParams
): Promise<TimestampProof> {
  const { segmentId, sessionId, userId, content, useMultipleSamples = false } = params

  // Generate nonce for additional security
  const nonce = generateNonce()

  // Hash the content with nonce
  const contentHash = hashContent(content, nonce)

  // Get trusted timestamp
  let timestamp: Date
  let timestampSource: 'ntp' | 'local'
  let serverInfo: any = undefined
  let accuracy: number | undefined

  if (useMultipleSamples) {
    // Get multiple NTP samples for higher accuracy
    const samples = await getNTPTimeSamples(3)
    timestamp = samples.timestamp
    timestampSource = 'ntp'
    serverInfo = {
      samples: samples.samples,
      accuracy: samples.accuracy,
    }
    accuracy = samples.accuracy
  } else {
    // Single NTP request
    const trustedTime = await getTrustedTime()
    timestamp = trustedTime.timestamp
    timestampSource = trustedTime.source
    serverInfo = trustedTime.serverInfo
  }

  // Check if proof already exists for this segment
  const existingProof = await prisma.timestampProof.findUnique({
    where: { segmentId },
  })

  if (existingProof) {
    throw new Error('Timestamp proof already exists for this segment')
  }

  // Store proof in database
  const proof = await prisma.timestampProof.create({
    data: {
      sessionId,
      segmentId,
      contentHash,
      timestamp,
      timestampSource,
      isVerified: timestampSource === 'ntp', // Auto-verify NTP timestamps
      verifiedAt: timestampSource === 'ntp' ? new Date() : undefined,
      verificationMethod: timestampSource === 'ntp' ? 'ntp_verified' : undefined,
    },
  })

  // Store extended metadata separately (nonce, server info)
  // This could be stored in a separate table or encrypted field
  const extendedMetadata = {
    nonce,
    serverInfo,
    accuracy,
    contentLength: content.length,
  }

  // Log audit trail
  await logAction({
    userId,
    action: AuditAction.TIMESTAMP_CREATE,
    resource: AuditResource.SEGMENT,
    resourceId: segmentId,
    metadata: {
      sessionId,
      contentHash,
      timestampSource,
      timestamp: timestamp.toISOString(),
      accuracy,
    },
  })

  return {
    id: proof.id,
    segmentId: proof.segmentId,
    sessionId,
    contentHash: proof.contentHash,
    timestamp: proof.timestamp,
    timestampSource: proof.timestampSource as 'ntp' | 'local',
    rfc3161Token: proof.rfc3161Token ?? undefined,
    serverInfo: extendedMetadata.serverInfo,
    nonce,
    isVerified: proof.isVerified,
    verifiedAt: proof.verifiedAt ?? undefined,
    verifiedBy: proof.verifiedBy ?? undefined,
    verificationMethod: proof.verificationMethod ?? undefined,
  }
}

/**
 * Generate proofs for multiple segments (bulk operation)
 */
export async function generateBulkProofs(params: {
  segments: Array<{ id: string; content: string }>
  sessionId: string
  userId: string
}): Promise<{
  successful: TimestampProof[]
  failed: Array<{ segmentId: string; error: string }>
}> {
  const { segments, sessionId, userId } = params

  const successful: TimestampProof[] = []
  const failed: Array<{ segmentId: string; error: string }> = []

  for (const segment of segments) {
    try {
      const proof = await generateProof({
        segmentId: segment.id,
        sessionId,
        userId,
        content: segment.content,
      })
      successful.push(proof)
    } catch (error) {
      failed.push({
        segmentId: segment.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return { successful, failed }
}

/**
 * Generate RFC 3161 timestamp token (placeholder for future implementation)
 * This would require integration with a Time Stamping Authority (TSA)
 */
export async function generateRFC3161Token(
  contentHash: string,
  tsaUrl?: string
): Promise<string> {
  // TODO: Implement RFC 3161 token generation
  // This requires:
  // 1. Create TimeStampReq (ASN.1 encoded)
  // 2. Send to TSA via HTTP POST
  // 3. Receive TimeStampResp
  // 4. Extract and return token

  throw new Error('RFC 3161 token generation not yet implemented')
}

/**
 * Create a detached signature for the timestamp proof
 * Can be used for offline verification
 */
export function createProofSignature(proof: {
  contentHash: string
  timestamp: Date
  nonce: string
}): string {
  const data = `${proof.contentHash}:${proof.timestamp.toISOString()}:${proof.nonce}`
  return createHash('sha256').update(data).digest('hex')
}

/**
 * Export proof for offline verification
 */
export function exportProof(proof: TimestampProof): {
  format: string
  version: string
  data: any
} {
  return {
    format: 'timestamp_proof_v1',
    version: '1.0.0',
    data: {
      segmentId: proof.segmentId,
      contentHash: proof.contentHash,
      timestamp: proof.timestamp.toISOString(),
      timestampSource: proof.timestampSource,
      nonce: proof.nonce,
      serverInfo: proof.serverInfo,
      signature: createProofSignature({
        contentHash: proof.contentHash,
        timestamp: proof.timestamp,
        nonce: proof.nonce,
      }),
      isVerified: proof.isVerified,
      verifiedAt: proof.verifiedAt?.toISOString(),
      verificationMethod: proof.verificationMethod,
    },
  }
}

/**
 * Generate chain of custody proof
 * Links multiple timestamps together
 */
export async function generateChainOfCustody(params: {
  sessionId: string
  userId: string
}): Promise<{
  sessionId: string
  proofs: TimestampProof[]
  chainHash: string
  timestamp: Date
}> {
  const { sessionId, userId } = params

  // Get all timestamp proofs for the session
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
          startMs: true,
          endMs: true,
        },
      },
    },
  })

  // Create chain hash by hashing all proofs together
  const chainData = proofs
    .map((p) => `${p.contentHash}:${p.timestamp.toISOString()}`)
    .join('|')
  const chainHash = createHash('sha256').update(chainData).digest('hex')

  // Get current timestamp for the chain
  const chainTimestamp = new Date()

  // Log chain of custody creation
  await logAction({
    userId,
    action: AuditAction.TIMESTAMP_CREATE,
    resource: AuditResource.SESSION,
    resourceId: sessionId,
    metadata: {
      type: 'chain_of_custody',
      proofCount: proofs.length,
      chainHash,
      timestamp: chainTimestamp.toISOString(),
    },
  })

  return {
    sessionId,
    proofs: proofs.map((p) => ({
      id: p.id,
      segmentId: p.segmentId,
      sessionId,
      contentHash: p.contentHash,
      timestamp: p.timestamp,
      timestampSource: p.timestampSource as 'ntp' | 'local',
      rfc3161Token: p.rfc3161Token ?? undefined,
      nonce: '', // Would need to be stored separately
      isVerified: p.isVerified,
      verifiedAt: p.verifiedAt ?? undefined,
      verifiedBy: p.verifiedBy ?? undefined,
      verificationMethod: p.verificationMethod ?? undefined,
    })),
    chainHash,
    timestamp: chainTimestamp,
  }
}
