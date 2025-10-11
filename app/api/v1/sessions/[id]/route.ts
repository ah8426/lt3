import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAction } from '@/lib/audit/logger';
import { AuditAction, AuditResource } from '@/types/audit';
import { SessionRepository } from '@/lib/repositories/session-repository';
import { handleAPIError, createSuccessResponse, createErrorResponse } from '@/lib/api/error-handler';
import { z } from 'zod';

export const runtime = 'nodejs';

// Validation schemas
const UpdateSessionSchema = z.object({
  title: z.string().min(1).optional(),
  matter_id: z.string().optional(),
  status: z.string().optional(),
  transcript: z.string().optional(),
});

/**
 * GET /api/v1/sessions/[id]
 * Get a specific session with optimized query
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    const sessionId = params.id;

    // Use repository for optimized query
    const session = await sessionRepo.findById(sessionId, user.id);

    if (!session) {
      return createErrorResponse('Session not found', 404, 'NOT_FOUND');
    }

    return createSuccessResponse({ session });
  } catch (error) {
    return handleAPIError(error);
  }
}

/**
 * PATCH /api/v1/sessions/[id]
 * Update a session
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    const sessionId = params.id;
    const body = await request.json();

    // Validate request body
    const validationResult = UpdateSessionSchema.safeParse(body);
    if (!validationResult.success) {
      return createErrorResponse('Validation failed', 400, 'VALIDATION_ERROR', validationResult.error.errors);
    }

    // Update session using repository
    const session = await sessionRepo.update(sessionId, user.id, validationResult.data);

    // Log session update
    await logAction({
      userId: user.id,
      action: AuditAction.SESSION_UPDATE,
      resource: AuditResource.SESSION,
      resourceId: sessionId,
      metadata: {
        updates: Object.keys(validationResult.data),
      },
    });

    return createSuccessResponse({ session });
  } catch (error) {
    return handleAPIError(error);
  }
}

/**
 * DELETE /api/v1/sessions/[id]
 * Delete a session
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    const sessionId = params.id;

    // Delete session using repository
    await sessionRepo.delete(sessionId, user.id);

    // Log session deletion
    await logAction({
      userId: user.id,
      action: AuditAction.SESSION_DELETE,
      resource: AuditResource.SESSION,
      resourceId: sessionId,
    });

    return createSuccessResponse({ message: 'Session deleted successfully' });
  } catch (error) {
    return handleAPIError(error);
  }
}
