import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth'
import { prisma } from '@/lib/prisma'
import {
  verifyProof,
  verifyChainOfCustody,
  getVerificationSummary,
} from '@/lib/timestamp/proof-verifier'

// GET /api/timestamp/verify/[id] - Verify timestamp proof
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const proofId = params.id

    // Check if verifying chain of custody for a session
    const searchParams = request.nextUrl.searchParams
    const verifyChain = searchParams.get('chain') === 'true'
    const summary = searchParams.get('summary') === 'true'

    if (summary) {
      // Get verification summary for session
      const sessionId = proofId // In this case, ID is sessionId

      // Verify user owns the session
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { userId: true },
      })

      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        )
      }

      if (session.userId !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      const summaryData = await getVerificationSummary(sessionId)
      return NextResponse.json(summaryData)
    }

    if (verifyChain) {
      // Verify chain of custody for session
      const sessionId = proofId // In this case, ID is sessionId

      // Verify user owns the session
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { userId: true },
      })

      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        )
      }

      if (session.userId !== user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }

      const chainResult = await verifyChainOfCustody({
        sessionId,
        userId: user.id,
      })

      return NextResponse.json(chainResult)
    }

    // Verify single proof
    const proof = await prisma.timestampProof.findUnique({
      where: { id: proofId },
      include: {
        segment: {
          select: {
            id: true,
            text: true,
            session: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    })

    if (!proof) {
      return NextResponse.json({ error: 'Proof not found' }, { status: 404 })
    }

    // Verify ownership
    if (proof.segment?.session.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Verify the proof
    const result = await verifyProof({
      proofId,
      content: proof.segment?.text,
      userId: user.id,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error verifying timestamp proof:', error)
    return NextResponse.json(
      {
        error: 'Failed to verify timestamp proof',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
