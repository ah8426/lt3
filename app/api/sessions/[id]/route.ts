import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAction } from '@/lib/audit/logger';
import { AuditAction, AuditResource } from '@/types/audit';

export const runtime = 'nodejs';

/**
 * GET /api/sessions/[id]
 * Get session details with segments
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: sessionId } = await params;

    // Get session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select(
        `
        *,
        matter:matters(id, name, client_name, case_number)
      `
      )
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
      console.error('Segments error:', segmentsError);
    }

    // Get audio URL if exists
    let audioUrl: string | null = null;
    if (session.audio_url) {
      const { data } = await supabase.storage
        .from('audio-recordings')
        .createSignedUrl(session.audio_url, 3600); // 1 hour expiry

      if (data) {
        audioUrl = data.signedUrl;
      }
    }

    return NextResponse.json({
      session: {
        ...session,
        audio_url: audioUrl,
      },
      segments: segments || [],
    });
  } catch (error) {
    console.error('Get session error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get session',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sessions/[id]
 * Update session metadata
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: sessionId } = await params;
    const body = await request.json();

    // Only allow updating certain fields
    const allowedFields = ['title', 'matter_id', 'status', 'transcript'];
    const updates: any = {};

    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    // Update session
    const { data: session, error: updateError } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Log session update
    await logAction({
      userId: user.id,
      action: AuditAction.SESSION_UPDATE,
      resource: AuditResource.SESSION,
      resourceId: sessionId,
      metadata: {
        updatedFields: Object.keys(updates).filter(k => k !== 'updated_at'),
      },
    });

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Update session error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to update session',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sessions/[id]
 * Delete session and associated data
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: sessionId } = await params;

    // Get session to find audio file
    const { data: session } = await supabase
      .from('sessions')
      .select('audio_url')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Delete audio file from storage
    if (session.audio_url) {
      await supabase.storage.from('audio-recordings').remove([session.audio_url]);
    }

    // Delete segments (cascade should handle this, but explicit is better)
    await supabase
      .from('transcription_segments')
      .delete()
      .eq('session_id', sessionId);

    // Delete session
    const { error: deleteError } = await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Log session deletion
    await logAction({
      userId: user.id,
      action: AuditAction.SESSION_DELETE,
      resource: AuditResource.SESSION,
      resourceId: sessionId,
      metadata: {
        hadAudio: !!session.audio_url,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete session error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete session',
      },
      { status: 500 }
    );
  }
}
