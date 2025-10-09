import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth'
import { prisma } from '@/lib/prisma'
import { generateProof, generateBulkProofs } from '@/lib/timestamp/proof-generator'
import { z } from 'zod'

const singleProofSchema = z.object({
  segmentId: z.string(),
  useMultipleSamples: z.boolean().optional(),
})

const bulkProofSchema = z.object({
  segmentIds: z.array(z.string()).min(1),
  useMultipleSamples: z.boolean().optional(),
})

// POST /api/timestamp/generate - Generate timestamp proof(s)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()

    // Determine if this is a single or bulk operation
    const isBulk = 'segmentIds' in body

    if (isBulk) {
      // Bulk proof generation
      const validatedData = bulkProofSchema.parse(body)

      // Fetch segments and verify ownership
      const segments = await prisma.transcriptSegment.findMany({
        where: {
          id: { in: validatedData.segmentIds },
        },
        include: {
          session: {
            select: {
              userId: true,
              id: true,
            },
          },
        },
      })

      if (segments.length === 0) {
        return NextResponse.json(
          { error: 'No segments found' },
          { status: 404 }
        )
      }

      // Verify all segments belong to user
      const unauthorizedSegment = segments.find(
        (seg: any) => seg.session.userId !== user.id
      )

      if (unauthorizedSegment) {
        return NextResponse.json(
          { error: 'Unauthorized: Not all segments belong to you' },
          { status: 403 }
        )
      }

      // Generate proofs
      const result = await generateBulkProofs({
        segments: segments.map((seg: any) => ({
          id: seg.id,
          content: seg.text,
        })),
        sessionId: segments[0].session.id,
        userId: user.id,
      })

      return NextResponse.json(
        {
          successful: result.successful,
          failed: result.failed,
          totalCount: validatedData.segmentIds.length,
          successCount: result.successful.length,
          failureCount: result.failed.length,
        },
        { status: 201 }
      )
    } else {
      // Single proof generation
      const validatedData = singleProofSchema.parse(body)

      // Fetch segment and verify ownership
      const segment = await prisma.transcriptSegment.findUnique({
        where: { id: validatedData.segmentId },
        include: {
          session: {
            select: {
              userId: true,
              id: true,
            },
          },
        },
      })

      if (!segment) {
        return NextResponse.json(
          { error: 'Segment not found' },
          { status: 404 }
        )
      }

      if (segment.session.userId !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      // Check if proof already exists
      const existingProof = await prisma.timestampProof.findUnique({
        where: { segmentId: validatedData.segmentId },
      })

      if (existingProof) {
        return NextResponse.json(
          {
            error: 'Timestamp proof already exists for this segment',
            existingProof: {
              id: existingProof.id,
              timestamp: existingProof.timestamp,
              isVerified: existingProof.isVerified,
            },
          },
          { status: 409 }
        )
      }

      // Generate proof
      const proof = await generateProof({
        segmentId: validatedData.segmentId,
        sessionId: segment.session.id,
        userId: user.id,
        content: segment.text,
        useMultipleSamples: validatedData.useMultipleSamples,
      })

      return NextResponse.json(proof, { status: 201 })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error generating timestamp proof:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate timestamp proof',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
