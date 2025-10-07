import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

/**
 * POST /api/sessions
 * Create or update a session
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient();

  // Authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const contentType = request.headers.get('content-type');

    // Handle multipart form data (with audio file)
    if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData();

      const sessionId = formData.get('id') as string;
      const matterId = formData.get('matter_id') as string | null;
      const title = formData.get('title') as string;
      const transcript = formData.get('transcript') as string;
      const durationMs = parseInt(formData.get('duration_ms') as string);
      const status = formData.get('status') as string;
      const audioFile = formData.get('audio') as Blob | null;
      const segmentsJson = formData.get('segments') as string | null;

      let audioUrl: string | null = null;

      // Upload audio file if provided
      if (audioFile) {
        const fileName = `sessions/${user.id}/${sessionId}.webm`;
        const buffer = Buffer.from(await audioFile.arrayBuffer());

        const { error: uploadError } = await supabase.storage
          .from('audio-recordings')
          .upload(fileName, buffer, {
            contentType: 'audio/webm',
            upsert: true,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
        } else {
          audioUrl = fileName;
        }
      }

      // Upsert session
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .upsert(
          {
            id: sessionId,
            user_id: user.id,
            matter_id: matterId,
            title,
            transcript,
            audio_url: audioUrl,
            duration_ms: durationMs,
            status,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'id',
          }
        )
        .select()
        .single();

      if (sessionError) {
        return NextResponse.json(
          { error: sessionError.message },
          { status: 500 }
        );
      }

      // Save segments if provided
      if (segmentsJson) {
        const segments = JSON.parse(segmentsJson);

        // Delete existing segments
        await supabase
          .from('transcription_segments')
          .delete()
          .eq('session_id', sessionId);

        // Insert new segments
        if (segments.length > 0) {
          const { error: segmentsError } = await supabase
            .from('transcription_segments')
            .insert(
              segments.map((segment: any) => ({
                session_id: sessionId,
                text: segment.text,
                speaker: segment.speaker,
                confidence: segment.confidence,
                start_time: segment.start_time,
                end_time: segment.end_time,
                is_final: segment.is_final,
              }))
            );

          if (segmentsError) {
            console.error('Segments error:', segmentsError);
          }
        }
      }

      return NextResponse.json({ session });
    }

    // Handle JSON data (auto-save without audio)
    const body = await request.json();

    const {
      id: sessionId,
      matter_id: matterId,
      title,
      transcript,
      duration_ms: durationMs,
      status,
      segments,
    } = body;

    // Upsert session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .upsert(
        {
          id: sessionId,
          user_id: user.id,
          matter_id: matterId,
          title,
          transcript,
          duration_ms: durationMs,
          status,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'id',
        }
      )
      .select()
      .single();

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 500 });
    }

    // Save segments if provided
    if (segments && segments.length > 0) {
      // Delete existing segments
      await supabase
        .from('transcription_segments')
        .delete()
        .eq('session_id', sessionId);

      // Insert new segments
      const { error: segmentsError } = await supabase
        .from('transcription_segments')
        .insert(
          segments.map((segment: any) => ({
            session_id: sessionId,
            text: segment.text,
            speaker: segment.speaker,
            confidence: segment.confidence,
            start_time: segment.start_time,
            end_time: segment.end_time,
            is_final: segment.is_final,
          }))
        );

      if (segmentsError) {
        console.error('Segments error:', segmentsError);
      }
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create session',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sessions
 * List user's sessions
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const matterId = url.searchParams.get('matterId');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('sessions')
      .select(
        `
        *,
        matter:matters(id, name, client_name),
        _count:transcription_segments(count)
      `,
        { count: 'exact' }
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (matterId) {
      query = query.eq('matter_id', matterId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: sessions, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      sessions: sessions || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('List sessions error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to list sessions',
      },
      { status: 500 }
    );
  }
}
