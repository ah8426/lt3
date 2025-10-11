import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withMiddleware, APIContext } from '@/lib/api/middleware';
import { withCORS } from '@/lib/api/middleware';
import { createSuccessResponse, createErrorResponse, handleAPIError } from '@/lib/api/error-handler';
import { CreateSessionSchema, SessionQuerySchema } from '@/lib/api/schemas';
import { AuditAction, AuditResource } from '@/types/audit';
import { prisma } from '@/lib/prisma';
import { RATE_LIMITS } from '@/lib/api/rate-limit';
import { SessionRepository } from '@/lib/repositories/session-repository';

export const runtime = 'nodejs';

/**
 * GET /api/v2/sessions
 * List sessions with advanced filtering and pagination
 */
export const GET = withCORS(withMiddleware(
  async (req: NextRequest, context: APIContext) => {
    try {
      const url = new URL(req.url);
      const queryParams = Object.fromEntries(url.searchParams.entries());
      const {
        page,
        limit,
        orderBy,
        orderDir,
        search,
        status,
        matterId,
        hasAudio,
        startDate,
        endDate
      } = SessionQuerySchema.parse(queryParams);

      const sessionRepo = new SessionRepository();

      // Build filters
      const filters: any = {
        userId: context.user.id // User can only see their own sessions
      };

      if (search) {
        filters.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }

      if (status) {
        filters.status = status;
      }

      if (matterId) {
        filters.matterId = matterId;
      }

      if (hasAudio !== undefined) {
        if (hasAudio) {
          filters.audioStoragePath = { not: null };
        } else {
          filters.audioStoragePath = null;
        }
      }

      if (startDate || endDate) {
        filters.createdAt = {};
        if (startDate) filters.createdAt.gte = startDate;
        if (endDate) filters.createdAt.lte = endDate;
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Execute query
      const [sessions, totalCount] = await Promise.all([
        prisma.session.findMany({
          where: filters,
          select: {
            id: true,
            matterId: true,
            title: true,
            description: true,
            status: true,
            startedAt: true,
            endedAt: true,
            durationMs: true,
            audioStoragePath: true,
            totalCost: true,
            asrProvider: true,
            aiProvider: true,
            createdAt: true,
            updatedAt: true,
            matter: {
              select: {
                id: true,
                name: true,
                clientName: true,
                status: true
              }
            },
            _count: {
              select: {
                segments: true,
                chatMessages: true,
                exportJobs: true
              }
            }
          },
          skip,
          take: limit,
          orderBy: orderBy ? { [orderBy]: orderDir } : { createdAt: orderDir }
        }),
        prisma.session.count({ where: filters })
      ]);

      // Calculate metadata
      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      // Add computed fields
      const enrichedSessions = sessions.map(session => ({
        ...session,
        hasAudio: !!session.audioStoragePath,
        segmentCount: session._count.segments,
        chatMessageCount: session._count.chatMessages,
        exportJobCount: session._count.exportJobs,
        duration: session.durationMs ? `${Math.round(session.durationMs / 1000 / 60)}m` : null
      }));

      return createSuccessResponse(
        enrichedSessions,
        `Retrieved ${sessions.length} sessions`,
        context.version,
        {
          totalCount,
          page,
          limit,
          totalPages,
          hasNextPage,
          hasPreviousPage
        }
      );

    } catch (error) {
      return handleAPIError(error, context.version);
    }
  },
  {
    auth: true,
    rateLimit: RATE_LIMITS.default,
    validation: {
      query: SessionQuerySchema
    },
    audit: {
      action: AuditAction.SESSION_LIST,
      resource: AuditResource.SESSION
    }
  }
));

/**
 * POST /api/v2/sessions
 * Create a new session with segments
 */
export const POST = withCORS(withMiddleware(
  async (req: NextRequest, context: APIContext) => {
    try {
      const body = await req.json();
      const sessionData = CreateSessionSchema.parse(body);

      const sessionRepo = new SessionRepository();

      // Validate matter access if matterId provided
      if (sessionData.matterId) {
        const matter = await prisma.matter.findFirst({
          where: {
            id: sessionData.matterId,
            userId: context.user.id
          }
        });

        if (!matter) {
          return createErrorResponse(
            'Matter not found or access denied',
            404,
            'MATTER_NOT_FOUND',
            undefined,
            context.version
          );
        }
      }

      // Create session using repository
      const session = await sessionRepo.create({
        id: sessionData.id,
        userId: context.user.id,
        matterId: sessionData.matterId,
        title: sessionData.title || `Session ${new Date().toLocaleString()}`,
        description: sessionData.description,
        status: sessionData.status,
        segments: sessionData.segments?.map(segment => ({
          text: segment.text,
          startMs: segment.startMs,
          endMs: segment.endMs,
          speakerId: segment.speakerId,
          speakerName: segment.speakerName,
          confidence: segment.confidence,
          isFinal: segment.isFinal,
          provider: segment.provider
        }))
      });

      return createSuccessResponse(
        session,
        'Session created successfully',
        context.version
      );

    } catch (error) {
      return handleAPIError(error, context.version);
    }
  },
  {
    auth: true,
    rateLimit: RATE_LIMITS.transcription,
    validation: {
      body: CreateSessionSchema
    },
    audit: {
      action: AuditAction.SESSION_CREATE,
      resource: AuditResource.SESSION
    }
  }
));

/**
 * GET /api/v2/sessions/stats
 * Get session statistics for the current user
 */
export const stats = withCORS(withMiddleware(
  async (req: NextRequest, context: APIContext) => {
    try {
      const url = new URL(req.url);
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');

      const dateFilter: any = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);

      const baseWhere = {
        userId: context.user.id,
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
      };

      // Get comprehensive statistics
      const [
        totalSessions,
        activeSessions,
        completedSessions,
        totalDuration,
        totalCost,
        segmentCount,
        recentSessions,
        topMatters,
        dailyStats
      ] = await Promise.all([
        // Total sessions
        prisma.session.count({ where: baseWhere }),

        // Active sessions
        prisma.session.count({
          where: { ...baseWhere, status: 'active' }
        }),

        // Completed sessions
        prisma.session.count({
          where: { ...baseWhere, status: 'completed' }
        }),

        // Total duration
        prisma.session.aggregate({
          where: baseWhere,
          _sum: { durationMs: true }
        }),

        // Total cost
        prisma.session.aggregate({
          where: baseWhere,
          _sum: { totalCost: true }
        }),

        // Segment count
        prisma.transcriptSegment.count({
          where: {
            session: baseWhere
          }
        }),

        // Recent sessions
        prisma.session.findMany({
          where: baseWhere,
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            durationMs: true,
            matter: {
              select: { name: true, clientName: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        }),

        // Top matters by session count
        prisma.matter.findMany({
          where: {
            userId: context.user.id,
            sessions: {
              some: dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {}
            }
          },
          select: {
            id: true,
            name: true,
            clientName: true,
            _count: {
              select: { sessions: true }
            }
          },
          orderBy: {
            sessions: { _count: 'desc' }
          },
          take: 5
        }),

        // Daily session stats for chart
        prisma.$queryRaw`
          SELECT
            DATE(created_at) as date,
            COUNT(*) as session_count,
            SUM(duration_ms) as total_duration,
            SUM(total_cost) as total_cost
          FROM sessions
          WHERE user_id = ${context.user.id}
            ${startDate ? `AND created_at >= ${startDate}` : ''}
            ${endDate ? `AND created_at <= ${endDate}` : ''}
          GROUP BY DATE(created_at)
          ORDER BY date DESC
          LIMIT 30
        `
      ]);

      const stats = {
        overview: {
          totalSessions,
          activeSessions,
          completedSessions,
          totalDurationMs: totalDuration._sum.durationMs || 0,
          totalDurationMinutes: Math.round((totalDuration._sum.durationMs || 0) / 1000 / 60),
          totalCost: totalCost._sum.totalCost || 0,
          segmentCount,
          averageDuration: totalSessions > 0 ? Math.round((totalDuration._sum.durationMs || 0) / totalSessions / 1000 / 60) : 0
        },
        recent: {
          sessions: recentSessions
        },
        insights: {
          topMatters,
          dailyStats: (dailyStats as any[]).map(row => ({
            date: row.date,
            sessionCount: Number(row.session_count),
            totalDuration: Number(row.total_duration),
            totalCost: Number(row.total_cost)
          }))
        }
      };

      return createSuccessResponse(
        stats,
        'Session statistics retrieved successfully',
        context.version
      );

    } catch (error) {
      return handleAPIError(error, context.version);
    }
  },
  {
    auth: true,
    rateLimit: RATE_LIMITS.default,
    audit: {
      action: AuditAction.SESSION_STATS,
      resource: AuditResource.SESSION
    }
  }
));