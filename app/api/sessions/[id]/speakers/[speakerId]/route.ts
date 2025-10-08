import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  updateSpeaker,
  deleteSpeaker,
  mergeSpeakers,
  getSpeakerStats,
  type SpeakerRole,
} from '@/lib/speakers/manager'
import { z } from 'zod'
import { prisma } from '@/lib/server/db'

const updateSpeakerSchema = z.object({
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
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

const mergeSpeakersSchema = z.object({
  targetSpeakerId: z.string(),
})

/**
 * GET /api/sessions/[id]/speakers/[speakerId]
 * Get speaker details with statistics
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; speakerId: string } }
) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionId = params.id
    const speakerId = params.speakerId

    // Verify user owns the session
    const { data: session } = await supabase
      .from('sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single()

    if (!session || session.user_id !== user.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Get speaker
    const speaker = await prisma.speaker.findUnique({
      where: { id: speakerId },
    })

    if (!speaker || speaker.sessionId !== sessionId) {
      return NextResponse.json({ error: 'Speaker not found' }, { status: 404 })
    }

    // Get statistics
    const stats = await getSpeakerStats(sessionId, speaker.speakerNumber)

    return NextResponse.json({
      speaker,
      stats,
    })
  } catch (error) {
    console.error('Failed to fetch speaker:', error)
    return NextResponse.json(
      { error: 'Failed to fetch speaker' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/sessions/[id]/speakers/[speakerId]
 * Update speaker details
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; speakerId: string } }
) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionId = params.id
    const speakerId = params.speakerId

    // Verify user owns the session
    const { data: session } = await supabase
      .from('sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single()

    if (!session || session.user_id !== user.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Verify speaker belongs to this session
    const existingSpeaker = await prisma.speaker.findUnique({
      where: { id: speakerId },
    })

    if (!existingSpeaker || existingSpeaker.sessionId !== sessionId) {
      return NextResponse.json({ error: 'Speaker not found' }, { status: 404 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validated = updateSpeakerSchema.parse(body)

    // Update speaker
    const speaker = await updateSpeaker({
      speakerId,
      name: validated.name,
      role: validated.role as SpeakerRole | undefined,
      organization: validated.organization,
      color: validated.color,
      userId: user.id,
    })

    return NextResponse.json({ speaker })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Failed to update speaker:', error)
    return NextResponse.json(
      { error: 'Failed to update speaker' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/sessions/[id]/speakers/[speakerId]
 * Delete a speaker
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; speakerId: string } }
) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionId = params.id
    const speakerId = params.speakerId

    // Verify user owns the session
    const { data: session } = await supabase
      .from('sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single()

    if (!session || session.user_id !== user.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Verify speaker belongs to this session
    const existingSpeaker = await prisma.speaker.findUnique({
      where: { id: speakerId },
    })

    if (!existingSpeaker || existingSpeaker.sessionId !== sessionId) {
      return NextResponse.json({ error: 'Speaker not found' }, { status: 404 })
    }

    // Delete speaker
    await deleteSpeaker(speakerId, user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete speaker:', error)
    return NextResponse.json(
      { error: 'Failed to delete speaker' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/sessions/[id]/speakers/[speakerId]/merge
 * Merge this speaker with another speaker
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; speakerId: string } }
) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionId = params.id
    const speakerId = params.speakerId

    // Check if this is a merge request
    const { pathname } = new URL(request.url)
    if (!pathname.endsWith('/merge')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

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
    const validated = mergeSpeakersSchema.parse(body)

    // Merge speakers
    await mergeSpeakers({
      sessionId,
      fromSpeakerId: speakerId,
      toSpeakerId: validated.targetSpeakerId,
      userId: user.id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    console.error('Failed to merge speakers:', error)
    return NextResponse.json(
      { error: 'Failed to merge speakers' },
      { status: 500 }
    )
  }
}
