import { createClient } from '@/lib/supabase/server';
import { APIError } from '@/lib/api/error-handler';

export interface Session {
  id: string;
  user_id: string;
  matter_id?: string;
  title: string;
  transcript: string;
  audio_url?: string;
  duration_ms: number;
  status: string;
  created_at: string;
  updated_at: string;
  matter?: {
    id: string;
    name: string;
    client_name: string;
    case_number?: string;
  };
  segments?: Segment[];
}

export interface Segment {
  id: string;
  session_id: string;
  text: string;
  speaker?: number;
  confidence?: number;
  start_time: number;
  end_time: number;
  is_final: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CreateSessionData {
  id?: string;
  user_id: string;
  matter_id?: string;
  title: string;
  transcript?: string;
  audio_url?: string;
  duration_ms?: number;
  status?: string;
  segments?: Omit<Segment, 'id' | 'session_id' | 'created_at' | 'updated_at'>[];
}

export interface UpdateSessionData {
  title?: string;
  matter_id?: string;
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
  sessions: Session[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Repository for session data access
 * Abstracts database operations and provides optimized queries
 */
export class SessionRepository {
  private supabase = createClient();

  /**
   * Create a new session
   */
  async create(data: CreateSessionData): Promise<Session> {
    const { data: session, error } = await this.supabase
      .from('sessions')
      .insert({
        id: data.id,
        user_id: data.user_id,
        matter_id: data.matter_id,
        title: data.title,
        transcript: data.transcript || '',
        audio_url: data.audio_url,
        duration_ms: data.duration_ms || 0,
        status: data.status || 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new APIError(`Failed to create session: ${error.message}`, 500, 'CREATE_ERROR');
    }

    // Create segments if provided
    if (data.segments && data.segments.length > 0) {
      await this.createSegments(session.id, data.segments);
    }

    return session;
  }

  /**
   * Get a session by ID with all related data (optimized single query)
   */
  async findById(id: string, userId: string): Promise<Session | null> {
    const { data: session, error } = await this.supabase
      .from('sessions')
      .select(`
        *,
        matter:matters(id, name, client_name, case_number),
        segments:transcription_segments(
          id, 
          text, 
          speaker, 
          confidence, 
          start_time, 
          end_time, 
          is_final, 
          created_at,
          updated_at
        )
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new APIError(`Failed to get session: ${error.message}`, 500, 'FETCH_ERROR');
    }

    return session;
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

    let query = this.supabase
      .from('sessions')
      .select(
        `
        *,
        matter:matters(id, name, client_name, case_number),
        segments:transcription_segments(
          id, 
          text, 
          speaker, 
          confidence, 
          start_time, 
          end_time, 
          is_final, 
          created_at
        )
      `,
        { count: 'exact' }
      )
      .eq('user_id', userId)
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
      throw new APIError(`Failed to list sessions: ${error.message}`, 500, 'FETCH_ERROR');
    }

    return {
      sessions: sessions || [],
      total: count || 0,
      limit,
      offset,
    };
  }

  /**
   * Update a session
   */
  async update(id: string, userId: string, data: UpdateSessionData): Promise<Session> {
    const { data: session, error } = await this.supabase
      .from('sessions')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new APIError('Session not found', 404, 'NOT_FOUND');
      }
      throw new APIError(`Failed to update session: ${error.message}`, 500, 'UPDATE_ERROR');
    }

    return session;
  }

  /**
   * Delete a session
   */
  async delete(id: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw new APIError(`Failed to delete session: ${error.message}`, 500, 'DELETE_ERROR');
    }
  }

  /**
   * Create segments for a session
   */
  async createSegments(sessionId: string, segments: Omit<Segment, 'id' | 'session_id' | 'created_at' | 'updated_at'>[]): Promise<void> {
    if (segments.length === 0) return;

    const { error } = await this.supabase
      .from('transcription_segments')
      .insert(
        segments.map(segment => ({
          session_id: sessionId,
          text: segment.text,
          speaker: segment.speaker,
          confidence: segment.confidence,
          start_time: segment.start_time,
          end_time: segment.end_time,
          is_final: segment.is_final,
          created_at: new Date().toISOString(),
        }))
      );

    if (error) {
      throw new APIError(`Failed to create segments: ${error.message}`, 500, 'CREATE_ERROR');
    }
  }

  /**
   * Get segments for a session
   */
  async getSegments(sessionId: string, userId: string): Promise<Segment[]> {
    // First verify session ownership
    const { data: session, error: sessionError } = await this.supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      throw new APIError('Session not found', 404, 'NOT_FOUND');
    }

    const { data: segments, error } = await this.supabase
      .from('transcription_segments')
      .select(`
        id,
        session_id,
        text,
        speaker,
        confidence,
        start_time,
        end_time,
        is_final,
        created_at,
        updated_at
      `)
      .eq('session_id', sessionId)
      .order('start_time', { ascending: true });

    if (error) {
      throw new APIError(`Failed to get segments: ${error.message}`, 500, 'FETCH_ERROR');
    }

    return segments || [];
  }

  /**
   * Update a segment
   */
  async updateSegment(sessionId: string, segmentId: string, userId: string, data: Partial<Segment>): Promise<Segment> {
    // First verify session ownership
    const { data: session, error: sessionError } = await this.supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      throw new APIError('Session not found', 404, 'NOT_FOUND');
    }

    const { data: segment, error } = await this.supabase
      .from('transcription_segments')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', segmentId)
      .eq('session_id', sessionId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new APIError('Segment not found', 404, 'NOT_FOUND');
      }
      throw new APIError(`Failed to update segment: ${error.message}`, 500, 'UPDATE_ERROR');
    }

    return segment;
  }

  /**
   * Delete a segment
   */
  async deleteSegment(sessionId: string, segmentId: string, userId: string): Promise<void> {
    // First verify session ownership
    const { data: session, error: sessionError } = await this.supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      throw new APIError('Session not found', 404, 'NOT_FOUND');
    }

    const { error } = await this.supabase
      .from('transcription_segments')
      .delete()
      .eq('id', segmentId)
      .eq('session_id', sessionId);

    if (error) {
      throw new APIError(`Failed to delete segment: ${error.message}`, 500, 'DELETE_ERROR');
    }
  }

  /**
   * Replace all segments for a session
   */
  async replaceSegments(sessionId: string, userId: string, segments: Omit<Segment, 'id' | 'session_id' | 'created_at' | 'updated_at'>[]): Promise<void> {
    // First verify session ownership
    const { data: session, error: sessionError } = await this.supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      throw new APIError('Session not found', 404, 'NOT_FOUND');
    }

    // Delete existing segments
    await this.supabase
      .from('transcription_segments')
      .delete()
      .eq('session_id', sessionId);

    // Create new segments
    if (segments.length > 0) {
      await this.createSegments(sessionId, segments);
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
    const { data: sessions, error } = await this.supabase
      .from('sessions')
      .select('status, duration_ms, matter_id')
      .eq('user_id', userId);

    if (error) {
      throw new APIError(`Failed to get session stats: ${error.message}`, 500, 'FETCH_ERROR');
    }

    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce((sum, session) => sum + (session.duration_ms || 0), 0);
    const averageDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;

    const byStatus: Record<string, number> = {};
    const byMatter: Record<string, number> = {};

    for (const session of sessions) {
      byStatus[session.status] = (byStatus[session.status] || 0) + 1;
      if (session.matter_id) {
        byMatter[session.matter_id] = (byMatter[session.matter_id] || 0) + 1;
      }
    }

    return {
      totalSessions,
      totalDuration,
      averageDuration,
      byStatus,
      byMatter,
    };
  }
}
