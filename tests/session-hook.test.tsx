import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSession, useSessions, useCreateSession } from '@/hooks/useSession';
import * as React from 'react';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
      }),
    },
  })),
}));

// Mock storage functions
vi.mock('@/lib/storage/audio-storage', () => ({
  uploadAudio: vi.fn().mockResolvedValue({ url: 'https://example.com/audio.webm' }),
  getSignedUrl: vi.fn().mockResolvedValue('https://example.com/signed-url'),
  deleteAudio: vi.fn().mockResolvedValue(undefined),
}));

// Test wrapper component
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Data Fetching', () => {
    it('should fetch session data successfully', async () => {
      const mockSession = {
        id: 'session-1',
        user_id: 'user-1',
        title: 'Test Session',
        transcript: 'Test transcript',
        duration_ms: 5000,
        status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        matter: {
          id: 'matter-1',
          name: 'Test Matter',
          client_name: 'Test Client',
          case_number: 'CASE-001',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ session: mockSession }),
      });

      const { result } = renderHook(() => useSession('session-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.session).toEqual(mockSession);
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/session-1');
    });

    it('should handle session fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useSession('session-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
    });

    it('should fetch segments separately', async () => {
      const mockSegments = [
        {
          id: 'segment-1',
          session_id: 'session-1',
          text: 'Hello world',
          speaker: 1,
          confidence: 0.95,
          start_time: 0,
          end_time: 1000,
          is_final: true,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ session: { id: 'session-1' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ segments: mockSegments }),
        });

      const { result } = renderHook(() => useSession('session-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.segments).toBeDefined();
      });

      expect(result.current.segments).toEqual(mockSegments);
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/session-1/segments');
    });
  });

  describe('Session Mutations', () => {
    it('should update session successfully', async () => {
      const mockUpdatedSession = {
        id: 'session-1',
        title: 'Updated Title',
        status: 'processing',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ session: { id: 'session-1' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ session: mockUpdatedSession }),
        });

      const { result } = renderHook(() => useSession('session-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.session).toBeDefined();
      });

      const updateData = { title: 'Updated Title', status: 'processing' };
      await result.current.updateSession(updateData);

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/session-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
    });

    it('should delete session successfully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ session: { id: 'session-1' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      const { result } = renderHook(() => useSession('session-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.session).toBeDefined();
      });

      await result.current.deleteSession();

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/session-1', {
        method: 'DELETE',
      });
    });

    it('should handle update session error', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ session: { id: 'session-1' } }),
        })
        .mockRejectedValueOnce(new Error('Update failed'));

      const { result } = renderHook(() => useSession('session-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.session).toBeDefined();
      });

      await expect(result.current.updateSession({ title: 'New Title' })).rejects.toThrow('Update failed');
    });
  });

  describe('Segment Mutations', () => {
    it('should update segment successfully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ session: { id: 'session-1' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ segments: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      const { result } = renderHook(() => useSession('session-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.session).toBeDefined();
      });

      const updateData = { text: 'Updated text', confidence: 0.98 };
      await result.current.updateSegment('segment-1', updateData, 'Original text');

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/session-1/segments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segment_id: 'segment-1',
          original_text: 'Original text',
          ...updateData,
        }),
      });
    });

    it('should delete segment successfully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ session: { id: 'session-1' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ segments: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      const { result } = renderHook(() => useSession('session-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.session).toBeDefined();
      });

      await result.current.deleteSegment('segment-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/session-1/segments?segment_id=segment-1', {
        method: 'DELETE',
      });
    });
  });

  describe('Audio Upload', () => {
    it('should upload audio successfully', async () => {
      const mockAudioFile = new Blob(['audio data'], { type: 'audio/webm' });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ session: { id: 'session-1' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ segments: [] }),
        });

      const { result } = renderHook(() => useSession('session-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.session).toBeDefined();
      });

      await result.current.uploadAudio(mockAudioFile);

      expect(result.current.isUploadingAudio).toBe(false);
    });

    it('should handle audio upload error', async () => {
      const mockAudioFile = new Blob(['audio data'], { type: 'audio/webm' });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ session: { id: 'session-1' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ segments: [] }),
        });

      const { result } = renderHook(() => useSession('session-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.session).toBeDefined();
      });

      // Mock uploadAudio to throw error
      const { uploadAudio } = await import('@/lib/storage/audio-storage');
      vi.mocked(uploadAudio).mockRejectedValueOnce(new Error('Upload failed'));

      await expect(result.current.uploadAudio(mockAudioFile)).rejects.toThrow('Upload failed');
    });
  });

  describe('Share Link Generation', () => {
    it('should generate share link successfully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ session: { id: 'session-1' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ segments: [] }),
        });

      const { result } = renderHook(() => useSession('session-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.session).toBeDefined();
      });

      const shareLink = await result.current.generateShareLink();

      expect(shareLink.link).toContain('/sessions/shared/session-1');
      expect(shareLink.expiresAt).toBeInstanceOf(Date);
    });
  });
});

describe('useSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch sessions list with default options', async () => {
    const mockSessions = [
      { id: 'session-1', title: 'Session 1' },
      { id: 'session-2', title: 'Session 2' },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ sessions: mockSessions }),
    });

    const { result } = renderHook(() => useSessions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/sessions');
  });

  it('should fetch sessions with filters', async () => {
    const mockSessions = [{ id: 'session-1', title: 'Session 1' }];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ sessions: mockSessions }),
    });

    const { result } = renderHook(() => useSessions({
      matterId: 'matter-1',
      status: 'completed',
      limit: 10,
      offset: 0,
    }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/sessions?matterId=matter-1&status=completed&limit=10&offset=0');
  });
});

describe('useCreateSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create session successfully', async () => {
    const mockSession = { id: 'session-1', title: 'New Session' };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ session: mockSession }),
    });

    const { result } = renderHook(() => useCreateSession(), {
      wrapper: createWrapper(),
    });

    const sessionData = {
      title: 'New Session',
      matter_id: 'matter-1',
      transcript: 'Initial transcript',
      duration_ms: 5000,
      status: 'processing',
    };

    await result.current.mutateAsync(sessionData);

    expect(mockFetch).toHaveBeenCalledWith('/api/sessions', {
      method: 'POST',
      body: expect.any(FormData),
    });
  });

  it('should create session with audio file', async () => {
    const mockSession = { id: 'session-1', title: 'New Session' };
    const mockAudioFile = new Blob(['audio data'], { type: 'audio/webm' });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ session: mockSession }),
    });

    const { result } = renderHook(() => useCreateSession(), {
      wrapper: createWrapper(),
    });

    const sessionData = {
      title: 'New Session',
      audio: mockAudioFile,
      segments: [{ text: 'Hello', start_time: 0, end_time: 1000 }],
    };

    await result.current.mutateAsync(sessionData);

    expect(mockFetch).toHaveBeenCalledWith('/api/sessions', {
      method: 'POST',
      body: expect.any(FormData),
    });
  });

  it('should handle creation error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Creation failed'));

    const { result } = renderHook(() => useCreateSession(), {
      wrapper: createWrapper(),
    });

    const sessionData = { title: 'New Session' };

    await expect(result.current.mutateAsync(sessionData)).rejects.toThrow('Creation failed');
  });
});
