import { prisma } from '@/lib/prisma';
import { APIError } from '@/lib/api/error-handler';
import type { Session, TranscriptSegment, Matter } from '@prisma/client';

export type SessionWithRelations = Session & {
  matter?: Matter | null;
  segments?: TranscriptSegment[];
};

export interface CreateSessionData {
  id?: string;
  userId: string;
  matterId?: string;
  title: string;
  transcript?: string;
  audioUrl?: string;
  durationMs?: number;
  status?: string;
  segments?: Omit<TranscriptSegment, 'id' | 'sessionId' | 'createdAt' | 'updatedAt'>[];
}

export interface UpdateSessionData {
  title?: string;
  matterId?: string;
  status?: string;
  transcript?: string;
}

export interface SessionFilters {
  matterId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface SessionListResult {
  sessions: SessionWithRelations[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Repository for session data access
 * Abstracts database operations and provides optimized queries using Prisma
 */
export class SessionRepository {
  /**
   * Create a new session
   */
  async create(data: CreateSessionData): Promise<SessionWithRelations> {
    try {
      const session = await prisma.session.create({
        data: {
          id: data.id,
          userId: data.userId,
          matterId: data.matterId,
          title: data.title,
          transcript: data.transcript || '',
          audioUrl: data.audioUrl,
          durationMs: data.durationMs || 0,
          status: data.status || 'draft',
          segments: data.segments ? {
            create: data.segments.map(segment => ({
              text: segment.text,
              speaker: segment.speaker,
              confidence: segment.confidence,
              startTime: segment.startTime,
              endTime: segment.endTime,
              isFinal: segment.isFinal ?? true,
            })),
          } : undefined,
        },
        include: {
          matter: true,
          segments: {
            orderBy: {
              startTime: 'asc',
            },
          },
        },
      });

      return session;
    } catch (error) {
      throw new APIError(
        `Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'CREATE_ERROR'
      );
    }
  }

  /**
   * Get a session by ID with all related data (optimized single query)
   */
  async findById(id: string, userId: string): Promise<SessionWithRelations | null> {
    try {
      const session = await prisma.session.findFirst({
        where: {
          id,
          userId,
        },
        include: {
          matter: {
            select: {
              id: true,
              name: true,
              clientName: true,
              caseNumber: true,
            },
          },
          segments: {
            orderBy: {
              startTime: 'asc',
            },
          },
        },
      });

      return session;
    } catch (error) {
      throw new APIError(
        `Failed to get session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'FETCH_ERROR'
      );
    }
  }

  /**
   * List sessions with filters and pagination (optimized query)
   */
  async findMany(userId: string, filters: SessionFilters = {}): Promise<SessionListResult> {
    const {
      matterId,
      status,
      limit = 50,
      offset = 0,
    } = filters;

    try {
      const where: any = { userId };

      if (matterId) {
        where.matterId = matterId;
      }

      if (status) {
        where.status = status;
      }

      const [sessions, total] = await Promise.all([
        prisma.session.findMany({
          where,
          include: {
            matter: {
              select: {
                id: true,
                name: true,
                clientName: true,
                caseNumber: true,
              },
            },
            segments: {
              select: {
                id: true,
                text: true,
                speaker: true,
                confidence: true,
                startTime: true,
                endTime: true,
                isFinal: true,
                createdAt: true,
              },
              orderBy: {
                startTime: 'asc',
              },
              take: 10, // Limit segments for list view
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip: offset,
          take: limit,
        }),
        prisma.session.count({ where }),
      ]);

      return {
        sessions,
        total,
        limit,
        offset,
      };
    } catch (error) {
      throw new APIError(
        `Failed to list sessions: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'FETCH_ERROR'
      );
    }
  }

  /**
   * Update a session
   */
  async update(id: string, userId: string, data: UpdateSessionData): Promise<SessionWithRelations> {
    try {
      const session = await prisma.session.update({
        where: {
          id_userId: {
            id,
            userId,
          },
        },
        data: {
          ...data,
          updatedAt: new Date(),
        },
        include: {
          matter: true,
          segments: true,
        },
      });

      return session;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new APIError('Session not found', 404, 'NOT_FOUND');
      }
      throw new APIError(
        `Failed to update session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'UPDATE_ERROR'
      );
    }
  }

  /**
   * Delete a session
   */
  async delete(id: string, userId: string): Promise<void> {
    try {
      await prisma.session.delete({
        where: {
          id_userId: {
            id,
            userId,
          },
        },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new APIError('Session not found', 404, 'NOT_FOUND');
      }
      throw new APIError(
        `Failed to delete session: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'DELETE_ERROR'
      );
    }
  }

  /**
   * Create segments for a session
   */
  async createSegments(
    sessionId: string,
    segments: Omit<TranscriptSegment, 'id' | 'sessionId' | 'createdAt' | 'updatedAt'>[]
  ): Promise<void> {
    if (segments.length === 0) return;

    try {
      await prisma.transcriptSegment.createMany({
        data: segments.map(segment => ({
          sessionId,
          text: segment.text,
          speaker: segment.speaker,
          confidence: segment.confidence,
          startTime: segment.startTime,
          endTime: segment.endTime,
          isFinal: segment.isFinal ?? true,
        })),
      });
    } catch (error) {
      throw new APIError(
        `Failed to create segments: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'CREATE_ERROR'
      );
    }
  }

  /**
   * Get segments for a session
   */
  async getSegments(sessionId: string, userId: string): Promise<TranscriptSegment[]> {
    try {
      // First verify session ownership
      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          userId,
        },
        select: {
          id: true,
        },
      });

      if (!session) {
        throw new APIError('Session not found', 404, 'NOT_FOUND');
      }

      const segments = await prisma.transcriptSegment.findMany({
        where: {
          sessionId,
        },
        orderBy: {
          startTime: 'asc',
        },
      });

      return segments;
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError(
        `Failed to get segments: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'FETCH_ERROR'
      );
    }
  }

  /**
   * Update a segment
   */
  async updateSegment(
    sessionId: string,
    segmentId: string,
    userId: string,
    data: Partial<TranscriptSegment>
  ): Promise<TranscriptSegment> {
    try {
      // First verify session ownership
      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          userId,
        },
        select: {
          id: true,
        },
      });

      if (!session) {
        throw new APIError('Session not found', 404, 'NOT_FOUND');
      }

      const segment = await prisma.transcriptSegment.update({
        where: {
          id: segmentId,
          sessionId,
        },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });

      return segment;
    } catch (error: any) {
      if (error instanceof APIError) throw error;
      if (error.code === 'P2025') {
        throw new APIError('Segment not found', 404, 'NOT_FOUND');
      }
      throw new APIError(
        `Failed to update segment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'UPDATE_ERROR'
      );
    }
  }

  /**
   * Delete a segment
   */
  async deleteSegment(sessionId: string, segmentId: string, userId: string): Promise<void> {
    try {
      // First verify session ownership
      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          userId,
        },
        select: {
          id: true,
        },
      });

      if (!session) {
        throw new APIError('Session not found', 404, 'NOT_FOUND');
      }

      await prisma.transcriptSegment.delete({
        where: {
          id: segmentId,
          sessionId,
        },
      });
    } catch (error: any) {
      if (error instanceof APIError) throw error;
      if (error.code === 'P2025') {
        throw new APIError('Segment not found', 404, 'NOT_FOUND');
      }
      throw new APIError(
        `Failed to delete segment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'DELETE_ERROR'
      );
    }
  }

  /**
   * Replace all segments for a session
   */
  async replaceSegments(
    sessionId: string,
    userId: string,
    segments: Omit<TranscriptSegment, 'id' | 'sessionId' | 'createdAt' | 'updatedAt'>[]
  ): Promise<void> {
    try {
      // First verify session ownership
      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          userId,
        },
        select: {
          id: true,
        },
      });

      if (!session) {
        throw new APIError('Session not found', 404, 'NOT_FOUND');
      }

      // Use transaction to delete and create atomically
      await prisma.$transaction([
        prisma.transcriptSegment.deleteMany({
          where: {
            sessionId,
          },
        }),
        ...(segments.length > 0
          ? [
              prisma.transcriptSegment.createMany({
                data: segments.map(segment => ({
                  sessionId,
                  text: segment.text,
                  speaker: segment.speaker,
                  confidence: segment.confidence,
                  startTime: segment.startTime,
                  endTime: segment.endTime,
                  isFinal: segment.isFinal ?? true,
                })),
              }),
            ]
          : []),
      ]);
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError(
        `Failed to replace segments: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'UPDATE_ERROR'
      );
    }
  }

  /**
   * Get session statistics for a user
   */
  async getStats(userId: string): Promise<{
    totalSessions: number;
    totalDuration: number;
    averageDuration: number;
    byStatus: Record<string, number>;
    byMatter: Record<string, number>;
  }> {
    try {
      const sessions = await prisma.session.findMany({
        where: {
          userId,
        },
        select: {
          status: true,
          durationMs: true,
          matterId: true,
        },
      });

      const totalSessions = sessions.length;
      const totalDuration = sessions.reduce((sum, session) => sum + (session.durationMs || 0), 0);
      const averageDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;

      const byStatus: Record<string, number> = {};
      const byMatter: Record<string, number> = {};

      for (const session of sessions) {
        byStatus[session.status] = (byStatus[session.status] || 0) + 1;
        if (session.matterId) {
          byMatter[session.matterId] = (byMatter[session.matterId] || 0) + 1;
        }
      }

      return {
        totalSessions,
        totalDuration,
        averageDuration,
        byStatus,
        byMatter,
      };
    } catch (error) {
      throw new APIError(
        `Failed to get session stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'FETCH_ERROR'
      );
    }
  }
}
