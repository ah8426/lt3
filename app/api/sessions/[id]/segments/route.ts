import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAction } from '@/lib/audit/logger';
import { AuditAction, AuditResource } from '@/types/audit';

export const runtime = 'nodejs';

/**
 * GET /api/sessions/[id]/segments
 * Fetch transcript segments for a session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sessionId = params.id;

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get segments
    const { data: segments, error: segmentsError } = await supabase
      .from('transcription_segments')
      .select('*')
      .eq('session_id', sessionId)
      .order('start_time', { ascending: true });

    if (segmentsError) {
      return NextResponse.json(
        { error: segmentsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ segments: segments || [] });
  } catch (error) {
    console.error('Get segments error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get segments',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sessions/[id]/segments
 * Add a new segment to a session
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sessionId = params.id;
    const body = await request.json();

    const { text, speaker, confidence, start_time, end_time, is_final } = body;

    // Validate required fields
    if (!text || start_time === undefined || end_time === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: text, start_time, end_time' },
        { status: 400 }
      );
    }

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Create segment
    const { data: segment, error: createError } = await supabase
      .from('transcription_segments')
      .insert({
        session_id: sessionId,
        text,
        speaker,
        confidence: confidence || null,
        start_time,
        end_time,
        is_final: is_final !== undefined ? is_final : true,
      })
      .select()
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Log segment creation
    await logAction({
      userId: user.id,
      action: AuditAction.SEGMENT_CREATE,
      resource: AuditResource.SEGMENT,
      resourceId: segment.id,
      metadata: {
        sessionId,
        speaker,
      },
    });

    return NextResponse.json({ segment }, { status: 201 });
  } catch (error) {
    console.error('Create segment error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create segment',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sessions/[id]/segments
 * Update a segment
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sessionId = params.id;
    const body = await request.json();

    const { segment_id, text, speaker, confidence, start_time, end_time, is_final } =
      body;

    if (!segment_id) {
      return NextResponse.json(
        { error: 'Missing required field: segment_id' },
        { status: 400 }
      );
    }

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Build update object
    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (text !== undefined) updates.text = text;
    if (speaker !== undefined) updates.speaker = speaker;
    if (confidence !== undefined) updates.confidence = confidence;
    if (start_time !== undefined) updates.start_time = start_time;
    if (end_time !== undefined) updates.end_time = end_time;
    if (is_final !== undefined) updates.is_final = is_final;

    // Update segment
    const { data: segment, error: updateError } = await supabase
      .from('transcription_segments')
      .update(updates)
      .eq('id', segment_id)
      .eq('session_id', sessionId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    // Create edit history entry
    await supabase.from('segment_edit_history').insert({
      segment_id,
      edited_by: user.id,
      previous_text: body.original_text, // Should be passed from client
      new_text: text,
    });

    // Log segment update
    await logAction({
      userId: user.id,
      action: AuditAction.SEGMENT_UPDATE,
      resource: AuditResource.SEGMENT,
      resourceId: segment_id,
      metadata: {
        sessionId,
        updatedFields: Object.keys(updates).filter(k => k !== 'updated_at'),
      },
    });

    return NextResponse.json({ segment });
  } catch (error) {
    console.error('Update segment error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to update segment',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sessions/[id]/segments
 * Delete a segment
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sessionId = params.id;
    const url = new URL(request.url);
    const segmentId = url.searchParams.get('segment_id');

    if (!segmentId) {
      return NextResponse.json(
        { error: 'Missing required parameter: segment_id' },
        { status: 400 }
      );
    }

    // Verify session belongs to user
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Delete segment
    const { error: deleteError } = await supabase
      .from('transcription_segments')
      .delete()
      .eq('id', segmentId)
      .eq('session_id', sessionId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Log segment deletion
    await logAction({
      userId: user.id,
      action: AuditAction.SEGMENT_DELETE,
      resource: AuditResource.SEGMENT,
      resourceId: segmentId,
      metadata: {
        sessionId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete segment error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete segment',
      },
      { status: 500 }
    );
  }
}
