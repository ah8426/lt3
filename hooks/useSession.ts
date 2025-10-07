import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createBrowserClient } from '@/lib/supabase/client';
import { uploadAudio, getSignedUrl, deleteAudio } from '@/lib/storage/audio-storage';

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

export interface SessionUpdate {
  title?: string;
  matter_id?: string;
  status?: string;
  transcript?: string;
}

export interface SegmentUpdate {
  text?: string;
  speaker?: number;
  confidence?: number;
  start_time?: number;
  end_time?: number;
  is_final?: boolean;
}

/**
 * Hook for managing a single session
 */
export function useSession(sessionId: string) {
  const queryClient = useQueryClient();
  const supabase = createBrowserClient();

  // Fetch session details
  const {
    data: sessionData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch session');
      }
      return response.json();
    },
    enabled: !!sessionId,
  });

  // Fetch segments
  const { data: segmentsData } = useQuery({
    queryKey: ['segments', sessionId],
    queryFn: async () => {
      const response = await fetch(`/api/sessions/${sessionId}/segments`);
      if (!response.ok) {
        throw new Error('Failed to fetch segments');
      }
      return response.json();
    },
    enabled: !!sessionId,
  });

  // Update session mutation
  const updateSessionMutation = useMutation({
    mutationFn: async (updates: SessionUpdate) => {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update session');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete session');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  // Update segment mutation
  const updateSegmentMutation = useMutation({
    mutationFn: async ({
      segmentId,
      originalText,
      updates,
    }: {
      segmentId: string;
      originalText?: string;
      updates: SegmentUpdate;
    }) => {
      const response = await fetch(`/api/sessions/${sessionId}/segments`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          segment_id: segmentId,
          original_text: originalText,
          ...updates,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update segment');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
    },
  });

  // Delete segment mutation
  const deleteSegmentMutation = useMutation({
    mutationFn: async (segmentId: string) => {
      const response = await fetch(
        `/api/sessions/${sessionId}/segments?segment_id=${segmentId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete segment');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments', sessionId] });
    },
  });

  // Upload audio mutation
  const uploadAudioMutation = useMutation({
    mutationFn: async (audioFile: Blob | File) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Upload audio
      const result = await uploadAudio(audioFile, user.id, sessionId, supabase);

      // Update session with audio URL
      await updateSessionMutation.mutateAsync({
        // Note: This should update audio_url in the session
      });

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
    },
  });

  // Generate share link mutation
  const generateShareLinkMutation = useMutation({
    mutationFn: async () => {
      // In a real implementation, this would create a shareable link in the database
      // For now, return a simple link
      return {
        link: `${window.location.origin}/sessions/shared/${sessionId}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };
    },
  });

  return {
    // Data
    session: sessionData?.session as Session | undefined,
    segments: segmentsData?.segments as Segment[] | undefined,
    isLoading,
    error,

    // Mutations
    updateSession: updateSessionMutation.mutateAsync,
    deleteSession: deleteSessionMutation.mutateAsync,
    updateSegment: (segmentId: string, updates: SegmentUpdate, originalText?: string) =>
      updateSegmentMutation.mutateAsync({ segmentId, updates, originalText }),
    deleteSegment: deleteSegmentMutation.mutateAsync,
    uploadAudio: uploadAudioMutation.mutateAsync,
    generateShareLink: generateShareLinkMutation.mutateAsync,

    // Mutation states
    isUpdating: updateSessionMutation.isPending,
    isDeleting: deleteSessionMutation.isPending,
    isUploadingAudio: uploadAudioMutation.isPending,
  };
}

/**
 * Hook for fetching sessions list
 */
export function useSessions(options?: {
  matterId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['sessions', options],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (options?.matterId) params.append('matterId', options.matterId);
      if (options?.status) params.append('status', options.status);
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());

      const response = await fetch(`/api/sessions?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }

      return response.json();
    },
  });
}

/**
 * Hook for creating a new session
 */
export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id?: string;
      matter_id?: string;
      title: string;
      transcript?: string;
      duration_ms?: number;
      status?: string;
      audio?: Blob;
      segments?: any[];
    }) => {
      const formData = new FormData();

      if (data.id) formData.append('id', data.id);
      if (data.matter_id) formData.append('matter_id', data.matter_id);
      formData.append('title', data.title);
      if (data.transcript) formData.append('transcript', data.transcript);
      if (data.duration_ms) formData.append('duration_ms', data.duration_ms.toString());
      if (data.status) formData.append('status', data.status);
      if (data.audio) formData.append('audio', data.audio, 'recording.webm');
      if (data.segments) formData.append('segments', JSON.stringify(data.segments));

      const response = await fetch('/api/sessions', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

/**
 * Hook for getting segment edit history
 */
export function useSegmentHistory(segmentId: string) {
  return useQuery({
    queryKey: ['segment-history', segmentId],
    queryFn: async () => {
      const response = await fetch(`/api/segments/${segmentId}/history`);

      if (!response.ok) {
        throw new Error('Failed to fetch segment history');
      }

      return response.json();
    },
    enabled: !!segmentId,
  });
}
