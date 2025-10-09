import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  getSpeakers,
  createSpeaker,
  getAllSpeakerStats,
  autoDetectSpeakers,
  type SpeakerRole,
} from '@/lib/speakers/manager'
import { z } from 'zod'

const createSpeakerSchema = z.object({
  speakerNumber: z.number().int().min(0),
  name: z.string().optional(),
  role: z
    .enum([
      'attorney',
      'client',
      'witness',
      'expert',
      'judge',
      'court_reporter',
      'interpreter',
      'other',
    ])
    .optional(),
  organization: z.string().optional(),
})

/**
 * GET /api/sessions/[id]/speakers
 * List all speakers in a session with optional statistics
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: sessionId } = await params
    const { searchParams } = new URL(request.url)
    const includeStats = searchParams.get('stats') === 'true'
    const autoDetect = searchParams.get('autoDetect') === 'true'

    // Verify user owns the session
    const { data: session } = await supabase
      .from('sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single()

    if (!session || session.user_id !== user.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Auto-detect speakers if requested
    if (autoDetect) {
      await autoDetectSpeakers(sessionId, user.id)
    }

    // Get speakers
    const speakers = await getSpeakers(sessionId)

    // Get statistics if requested
    if (includeStats) {
      const stats = await getAllSpeakerStats(sessionId)
      return NextResponse.json({
        speakers,
        stats,
      })
    }

    return NextResponse.json({ speakers })
  } catch (error) {
    console.error('Failed to fetch speakers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch speakers' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/sessions/[id]/speakers
 * Create a new speaker
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: sessionId } = await params

    // Verify user owns the session
    const { data: session } = await supabase
      .from('sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single()

    if (!session || session.user_id !== user.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validated = createSpeakerSchema.parse(body)

    // Create speaker
    const speaker = await createSpeaker({
      sessionId,
      speakerNumber: validated.speakerNumber,
      name: validated.name,
      role: validated.role as SpeakerRole | undefined,
      organization: validated.organization,
      userId: user.id,
    })

    return NextResponse.json({ speaker }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      )
    }

    console.error('Failed to create speaker:', error)
    return NextResponse.json(
      { error: 'Failed to create speaker' },
      { status: 500 }
    )
  }
}
