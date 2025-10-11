import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAction } from '@/lib/audit/logger';
import { AuditAction, AuditResource } from '@/types/audit';
import { SessionRepository } from '@/lib/repositories/session-repository';
import { handleAPIError, createSuccessResponse, createErrorResponse } from '@/lib/api/error-handler';
import { z } from 'zod';

export const runtime = 'nodejs';

// Validation schemas
const UpdateSegmentSchema = z.object({
  segment_id: z.string(),
  original_text: z.string().optional(),
  text: z.string().min(1).optional(),
  speaker: z.number().int().min(0).optional(),
  confidence: z.number().min(0).max(1).optional(),
  start_time: z.number().min(0).optional(),
  end_time: z.number().min(0).optional(),
  is_final: z.boolean().optional(),
});

const DeleteSegmentSchema = z.object({
  segment_id: z.string(),
});

/**
 * GET /api/v1/sessions/[id]/segments
 * Get segments for a session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionRepo = new SessionRepository();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED');
  }

  try {
    const { id: sessionId } = await params;

    // Get segments using repository
    const segments = await sessionRepo.getSegments(sessionId, user.id);

    return createSuccessResponse({ segments });
  } catch (error) {
    return handleAPIError(error);
  }
}

/**
 * PATCH /api/v1/sessions/[id]/segments
 * Update a segment
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionRepo = new SessionRepository();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED');
  }

  try {
    const { id: sessionId } = await params;
    const body = await request.json();

    // Validate request body
    const validationResult = UpdateSegmentSchema.safeParse(body);
    if (!validationResult.success) {
      return createErrorResponse('Validation failed', 400, 'VALIDATION_ERROR', validationResult.error.errors);
    }

    const { segment_id, original_text, ...updateData } = validationResult.data;

    // Update segment using repository
    const segment = await sessionRepo.updateSegment(sessionId, segment_id, user.id, updateData);

    // Log segment update
    await logAction({
      userId: user.id,
      action: AuditAction.SEGMENT_UPDATE,
      resource: AuditResource.SEGMENT,
      resourceId: segment_id,
      metadata: {
        sessionId,
        originalText: original_text,
        updates: Object.keys(updateData),
      },
    });

    return createSuccessResponse({ segment });
  } catch (error) {
    return handleAPIError(error);
  }
}

/**
 * DELETE /api/v1/sessions/[id]/segments
 * Delete a segment
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionRepo = new SessionRepository();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED');
  }

  try {
    const { id: sessionId } = await params;
    const url = new URL(request.url);
    const segmentId = url.searchParams.get('segment_id');

    if (!segmentId) {
      return createErrorResponse('segment_id parameter is required', 400, 'VALIDATION_ERROR');
    }

    // Validate segment_id
    const validationResult = DeleteSegmentSchema.safeParse({ segment_id: segmentId });
    if (!validationResult.success) {
      return createErrorResponse('Invalid segment_id', 400, 'VALIDATION_ERROR', validationResult.error.errors);
    }

    // Delete segment using repository
    await sessionRepo.deleteSegment(sessionId, segmentId, user.id);

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

    return createSuccessResponse({ message: 'Segment deleted successfully' });
  } catch (error) {
    return handleAPIError(error);
  }
}
