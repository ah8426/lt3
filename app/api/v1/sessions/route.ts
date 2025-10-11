import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAction } from '@/lib/audit/logger';
import { AuditAction, AuditResource } from '@/types/audit';
import { SessionRepository } from '@/lib/repositories/session-repository';
import { handleAPIError, createSuccessResponse, createErrorResponse } from '@/lib/api/error-handler';
import { z } from 'zod';

export const runtime = 'nodejs';

// Validation schemas
const CreateSessionSchema = z.object({
  id: z.string().optional(),
  matter_id: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  transcript: z.string().optional(),
  duration_ms: z.number().optional(),
  status: z.string().optional(),
  segments: z.array(z.object({
    text: z.string(),
    speaker: z.number().optional(),
    confidence: z.number().optional(),
    start_time: z.number(),
    end_time: z.number(),
    is_final: z.boolean().optional(),
  })).optional(),
});

const UpdateSessionSchema = z.object({
  title: z.string().min(1).optional(),
  matter_id: z.string().optional(),
  status: z.string().optional(),
  transcript: z.string().optional(),
});

const SessionQuerySchema = z.object({
  matterId: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * POST /api/v1/sessions
 * Create or update a session
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const sessionRepo = new SessionRepository();

  // Authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED');
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

      // Validate required fields
      if (!title) {
        return createErrorResponse('Title is required', 400, 'VALIDATION_ERROR');
      }

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

      // Parse segments if provided
      let segments = undefined;
      if (segmentsJson) {
        segments = JSON.parse(segmentsJson);
      }

      // Create session using repository
      const session = await sessionRepo.create({
        id: sessionId,
        user_id: user.id,
        matter_id: matterId ?? undefined,
        title,
        transcript,
        audio_url: audioUrl,
        duration_ms: durationMs,
        status,
        segments,
      });

      // Log session creation
      await logAction({
        userId: user.id,
        action: AuditAction.SESSION_CREATE,
        resource: AuditResource.SESSION,
        resourceId: sessionId,
        metadata: {
          title,
          status,
          hasAudio: !!audioFile,
        },
      });

      return createSuccessResponse({ session });
    }

    // Handle JSON data (auto-save without audio)
    const body = await request.json();
    
    // Validate request body
    const validationResult = CreateSessionSchema.safeParse(body);
    if (!validationResult.success) {
      return createErrorResponse('Validation failed', 400, 'VALIDATION_ERROR', validationResult.error.errors);
    }

    const {
      id: sessionId,
      matter_id: matterId,
      title,
      transcript,
      duration_ms: durationMs,
      status,
      segments,
    } = validationResult.data;

    // Create session using repository
    const session = await sessionRepo.create({
      id: sessionId,
      user_id: user.id,
      matter_id: matterId,
      title,
      transcript,
      duration_ms: durationMs,
      status,
      segments,
    });

    // Log session creation
    await logAction({
      userId: user.id,
      action: AuditAction.SESSION_CREATE,
      resource: AuditResource.SESSION,
      resourceId: sessionId,
      metadata: {
        title,
        status,
      },
    });

    return createSuccessResponse({ session });
  } catch (error) {
    return handleAPIError(error);
  }
}

/**
 * GET /api/v1/sessions
 * List user's sessions
 */
export async function GET(request: NextRequest) {
  const sessionRepo = new SessionRepository();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED');
  }

  try {
    const url = new URL(request.url);
    const queryParams = {
      matterId: url.searchParams.get('matterId'),
      status: url.searchParams.get('status'),
      limit: url.searchParams.get('limit'),
      offset: url.searchParams.get('offset'),
    };

    // Validate query parameters
    const validationResult = SessionQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      return createErrorResponse('Invalid query parameters', 400, 'VALIDATION_ERROR', validationResult.error.errors);
    }

    const { matterId, status, limit, offset } = validationResult.data;

    // Use repository for optimized query
    const result = await sessionRepo.findMany(user.id, {
      matterId,
      status,
      limit,
      offset,
    });

    return createSuccessResponse(result);
  } catch (error) {
    return handleAPIError(error);
  }
}
