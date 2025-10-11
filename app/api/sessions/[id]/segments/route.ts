import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/auth';
import { prisma } from '@/lib/prisma';
import { logAction } from '@/lib/audit/logger';
import { AuditAction, AuditResource } from '@/types/audit';
import { SessionRepository } from '@/lib/repositories/session-repository';

export const runtime = 'nodejs';

const sessionRepo = new SessionRepository();

/**
 * GET /api/sessions/[id]/segments
 * Fetch transcript segments for a session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: sessionId } = await params;

    // Use repository method
    const segments = await sessionRepo.getSegments(sessionId, user.id);

    return NextResponse.json({ segments });
  } catch (error: any) {
    console.error('Get segments error:', error);

    if (error.statusCode === 404) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

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
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: sessionId } = await params;
    const body = await request.json();

    const { text, speaker, confidence, start_time, end_time, is_final } = body;

    // Validate required fields
    if (!text || start_time === undefined || end_time === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: text, start_time, end_time' },
        { status: 400 }
      );
    }

    // Verify session exists and belongs to user
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
      select: {
        id: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Create segment using Prisma
    const segment = await prisma.transcriptSegment.create({
      data: {
        sessionId,
        text,
        speakerId: null, // Set via speaker_id if provided
        speakerName: speaker ?? null, // Use speaker as name temporarily
        confidence: confidence ?? null,
        startMs: Math.round(start_time),
        endMs: Math.round(end_time),
        isFinal: is_final ?? false,
        provider: null,
      },
    });

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
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: sessionId } = await params;
    const body = await request.json();

    const { segment_id, text, speaker, confidence, start_time, end_time, is_final, original_text } =
      body;

    if (!segment_id) {
      return NextResponse.json(
        { error: 'Missing required field: segment_id' },
        { status: 400 }
      );
    }

    // Verify session exists and belongs to user
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
      select: {
        id: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Build update object with correct field names
    const updates: any = {};

    if (text !== undefined) {
      updates.text = text;
      updates.isEdited = true;
      updates.editedBy = user.id;
    }
    if (speaker !== undefined) updates.speakerName = speaker;
    if (confidence !== undefined) updates.confidence = confidence;
    if (start_time !== undefined) updates.startMs = Math.round(start_time);
    if (end_time !== undefined) updates.endMs = Math.round(end_time);
    if (is_final !== undefined) updates.isFinal = is_final;

    // Update segment using Prisma
    const segment = await prisma.transcriptSegment.update({
      where: {
        id: segment_id,
        sessionId,
      },
      data: {
        ...updates,
      },
    });

    // Log segment update (includes text changes in metadata)
    await logAction({
      userId: user.id,
      action: AuditAction.SEGMENT_UPDATE,
      resource: AuditResource.SEGMENT,
      resourceId: segment_id,
      metadata: {
        sessionId,
        updatedFields: Object.keys(updates),
      },
    });

    return NextResponse.json({ segment });
  } catch (error: any) {
    console.error('Update segment error:', error);

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

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
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: sessionId } = await params;
    const url = new URL(request.url);
    const segmentId = url.searchParams.get('segment_id');

    if (!segmentId) {
      return NextResponse.json(
        { error: 'Missing required parameter: segment_id' },
        { status: 400 }
      );
    }

    // Verify session exists and belongs to user
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
      select: {
        id: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Delete segment using Prisma
    await prisma.transcriptSegment.delete({
      where: {
        id: segmentId,
        sessionId,
      },
    });

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
  } catch (error: any) {
    console.error('Delete segment error:', error);

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete segment',
      },
      { status: 500 }
    );
  }
}
