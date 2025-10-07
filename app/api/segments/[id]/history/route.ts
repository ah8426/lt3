import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/segments/[id]/history
 * Fetch edit history for a segment
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const segmentId = params.id

    // Verify segment exists and user has access to it
    const { data: segment, error: segmentError } = await supabase
      .from('transcription_segments')
      .select('session_id, sessions!inner(user_id)')
      .eq('id', segmentId)
      .single()

    if (segmentError || !segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 })
    }

    // Check user owns the session
    if ((segment as any).sessions.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Fetch edit history
    const { data: history, error: historyError } = await supabase
      .from('segment_edit_history')
      .select(
        `
        id,
        previous_text,
        new_text,
        edited_by,
        created_at,
        profiles:edited_by (
          email,
          full_name
        )
      `
      )
      .eq('segment_id', segmentId)
      .order('created_at', { ascending: false })

    if (historyError) {
      return NextResponse.json({ error: historyError.message }, { status: 500 })
    }

    return NextResponse.json({ history: history || [] })
  } catch (error) {
    console.error('Get segment history error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get segment history',
      },
      { status: 500 }
    )
  }
}
