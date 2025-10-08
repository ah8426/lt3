import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth'
import { prisma } from '@/lib/prisma'
import { createVersion, getVersionHistory } from '@/lib/versioning/version-manager'
import { z } from 'zod'

const createVersionSchema = z.object({
  changeType: z.enum([
    'manual_save',
    'auto_save',
    'segment_edit',
    'segment_add',
    'segment_delete',
    'restore',
    'pre_export',
    'pre_share',
  ]),
  changeReason: z.string().optional(),
  segmentIds: z.array(z.string()).optional(),
})

// GET /api/sessions/[id]/versions - Get version history
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const sessionId = params.id

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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get version history
    const { versions, total } = await getVersionHistory({
      sessionId,
      limit,
      offset,
    })

    return NextResponse.json({
      versions,
      total,
      hasMore: offset + versions.length < total,
    })
  } catch (error) {
    console.error('Error fetching version history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch version history' },
      { status: 500 }
    )
  }
}

// POST /api/sessions/[id]/versions - Create new version
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const sessionId = params.id

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

    // Parse and validate request body
    const body = await request.json()
    const validatedData = createVersionSchema.parse(body)

    // Create version
    const version = await createVersion({
      sessionId,
      userId: user.id,
      changeType: validatedData.changeType,
      changeReason: validatedData.changeReason,
      segmentIds: validatedData.segmentIds,
    })

    return NextResponse.json(version, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error creating version:', error)
    return NextResponse.json(
      { error: 'Failed to create version' },
      { status: 500 }
    )
  }
}
