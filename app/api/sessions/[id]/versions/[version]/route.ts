import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth'
import { prisma } from '@/lib/prisma'
import {
  getVersion,
  restoreVersion,
  compareVersions,
} from '@/lib/versioning/version-manager'
import { compareSegments } from '@/lib/versioning/diff-engine'
import { z } from 'zod'

const restoreSchema = z.object({
  reason: z.string().optional(),
})

// GET /api/sessions/[id]/versions/[version] - Get specific version or compare
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: sessionId, version } = await params
    const versionNumber = parseInt(version)

    if (isNaN(versionNumber)) {
      return NextResponse.json({ error: 'Invalid version number' }, { status: 400 })
    }

    // Verify session ownership
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check if compare parameter is provided
    const searchParams = request.nextUrl.searchParams
    const compareWith = searchParams.get('compare')

    if (compareWith) {
      const compareVersion = parseInt(compareWith)
      if (isNaN(compareVersion)) {
        return NextResponse.json(
          { error: 'Invalid compare version number' },
          { status: 400 }
        )
      }

      // Compare two versions
      const comparison = await compareVersions({
        sessionId,
        fromVersion: compareVersion,
        toVersion: versionNumber,
      })

      // Get detailed segment comparison
      const segmentDiff = compareSegments(
        comparison.fromVersion.segments,
        comparison.toVersion.segments
      )

      return NextResponse.json({
        ...comparison,
        segmentDiff,
      })
    }

    // Get single version
    const version = await getVersion({
      sessionId,
      version: versionNumber,
    })

    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    return NextResponse.json(version)
  } catch (error) {
    console.error('Error fetching version:', error)
    return NextResponse.json(
      { error: 'Failed to fetch version' },
      { status: 500 }
    )
  }
}

// POST /api/sessions/[id]/versions/[version] - Restore version
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: sessionId, version } = await params
    const versionNumber = parseInt(version)

    if (isNaN(versionNumber)) {
      return NextResponse.json({ error: 'Invalid version number' }, { status: 400 })
    }

    // Verify session ownership
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const validatedData = restoreSchema.parse(body)

    // Restore version
    const restoredVersion = await restoreVersion({
      sessionId,
      version: versionNumber,
      userId: user.id,
      reason: validatedData.reason,
    })

    return NextResponse.json(restoredVersion)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error restoring version:', error)
    return NextResponse.json(
      { error: 'Failed to restore version' },
      { status: 500 }
    )
  }
}
