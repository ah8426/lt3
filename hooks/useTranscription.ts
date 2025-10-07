import { useState, useEffect, useRef, useCallback } from 'react';
import type { ASRProviderType } from '@/lib/asr/provider-manager';

export interface TranscriptionSegment {
  text: string;
  speaker?: number;
  confidence: number;
  startTime: number;
  endTime: number;
  isFinal: boolean;
}

export interface TranscriptionMetrics {
  provider: ASRProviderType;
  durationMs: number;
  cost: number;
}

export interface UseTranscriptionOptions {
  sessionId?: string;
  onSegment?: (segment: TranscriptionSegment) => void;
  onError?: (error: string) => void;
  onProviderSwitch?: (fromProvider: ASRProviderType, toProvider: ASRProviderType) => void;
  onMetrics?: (metrics: TranscriptionMetrics) => void;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
}

export interface UseTranscriptionReturn {
  // State
  isTranscribing: boolean;
  segments: TranscriptionSegment[];
  currentText: string;
  error: string | null;
  currentProvider: ASRProviderType | null;
  metrics: TranscriptionMetrics | null;
  isReconnecting: boolean;

  // Actions
  startTranscription: () => Promise<void>;
  stopTranscription: () => Promise<void>;
  sendAudio: (audioData: ArrayBuffer) => Promise<void>;
  clearSegments: () => void;
  retryConnection: () => Promise<void>;

  // Utilities
  getFullTranscript: () => string;
  getFinalTranscript: () => string;
  getSpeakerSegments: () => Map<number, TranscriptionSegment[]>;
}

/**
 * Hook for managing real-time transcription
 */
export function useTranscription(
  options: UseTranscriptionOptions = {}
): UseTranscriptionReturn {
  const {
    sessionId: initialSessionId,
    onSegment,
    onError,
    onProviderSwitch,
    onMetrics,
    autoReconnect = true,
    maxReconnectAttempts = 3,
  } = options;

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string>(initialSessionId || '');

  // State
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [currentText, setCurrentText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentProvider, setCurrentProvider] = useState<ASRProviderType | null>(null);
  const [metrics, setMetrics] = useState<TranscriptionMetrics | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Update current text when segments change
  useEffect(() => {
    const latestSegment = segments[segments.length - 1];
    if (latestSegment) {
      setCurrentText(latestSegment.text);
    }
  }, [segments]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  /**
   * Start transcription stream
   */
  const startTranscription = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      setIsReconnecting(false);
      reconnectAttemptsRef.current = 0;

      // Generate session ID if not provided
      if (!sessionIdRef.current) {
        sessionIdRef.current = crypto.randomUUID();
      }

      // Start stream via API
      const response = await fetch('/api/transcription/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'start',
          sessionId: sessionIdRef.current,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start transcription');
      }

      // Setup event source for streaming
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      setIsTranscribing(true);

      // Read stream
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            handleStreamMessage(data);
          }
        }
      }

      setIsTranscribing(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transcription failed';
      setError(errorMessage);
      setIsTranscribing(false);

      if (onError) {
        onError(errorMessage);
      }

      // Attempt reconnect if enabled
      if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
        attemptReconnect();
      }
    }
  }, [autoReconnect, maxReconnectAttempts, onError]);

  /**
   * Handle stream messages
   */
  const handleStreamMessage = useCallback(
    (data: any) => {
      switch (data.type) {
        case 'ready':
          console.log('Transcription stream ready');
          break;

        case 'transcript':
          if (data.segment) {
            const segment: TranscriptionSegment = data.segment;

            // Add or update segment
            setSegments((prev) => {
              // If final, add to list
              if (segment.isFinal) {
                return [...prev, segment];
              }

              // If interim, replace last interim segment
              const lastSegment = prev[prev.length - 1];
              if (lastSegment && !lastSegment.isFinal) {
                return [...prev.slice(0, -1), segment];
              }

              return [...prev, segment];
            });

            if (onSegment) {
              onSegment(segment);
            }
          }
          break;

        case 'provider-switch':
          if (data.fromProvider && data.toProvider) {
            console.log(`Provider switched: ${data.fromProvider} -> ${data.toProvider}`);
            setCurrentProvider(data.toProvider);

            if (onProviderSwitch) {
              onProviderSwitch(data.fromProvider, data.toProvider);
            }
          }
          break;

        case 'metrics':
          if (data.metrics) {
            setMetrics(data.metrics);
            setCurrentProvider(data.metrics.provider);

            if (onMetrics) {
              onMetrics(data.metrics);
            }
          }
          break;

        case 'error':
          const errorMsg = data.error || 'Transcription error';
          setError(errorMsg);

          if (onError) {
            onError(errorMsg);
          }
          break;
      }
    },
    [onSegment, onProviderSwitch, onMetrics, onError]
  );

  /**
   * Send audio data to transcription service
   */
  const sendAudio = useCallback(
    async (audioData: ArrayBuffer): Promise<void> => {
      if (!isTranscribing) {
        throw new Error('Transcription not started');
      }

      try {
        // Convert ArrayBuffer to base64
        const buffer = Buffer.from(audioData);
        const base64Audio = buffer.toString('base64');

        await fetch('/api/transcription/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'audio',
            audio: base64Audio,
          }),
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to send audio';
        setError(errorMessage);

        if (onError) {
          onError(errorMessage);
        }
      }
    },
    [isTranscribing, onError]
  );

  /**
   * Stop transcription
   */
  const stopTranscription = useCallback(async (): Promise<void> => {
    try {
      if (isTranscribing) {
        await fetch('/api/transcription/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'stop',
          }),
        });
      }

      cleanup();
    } catch (err) {
      console.error('Error stopping transcription:', err);
    } finally {
      setIsTranscribing(false);
    }
  }, [isTranscribing]);

  /**
   * Attempt to reconnect
   */
  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      setError('Max reconnection attempts reached');
      return;
    }

    setIsReconnecting(true);
    reconnectAttemptsRef.current++;

    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log(
        `Reconnecting... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
      );
      startTranscription();
    }, delay);
  }, [maxReconnectAttempts, startTranscription]);

  /**
   * Retry connection manually
   */
  const retryConnection = useCallback(async (): Promise<void> => {
    reconnectAttemptsRef.current = 0;
    setError(null);
    await startTranscription();
  }, [startTranscription]);

  /**
   * Clear segments
   */
  const clearSegments = useCallback(() => {
    setSegments([]);
    setCurrentText('');
  }, []);

  /**
   * Get full transcript (including interim results)
   */
  const getFullTranscript = useCallback((): string => {
    return segments.map((s) => s.text).join(' ');
  }, [segments]);

  /**
   * Get final transcript (only final segments)
   */
  const getFinalTranscript = useCallback((): string => {
    return segments
      .filter((s) => s.isFinal)
      .map((s) => s.text)
      .join(' ');
  }, [segments]);

  /**
   * Get segments grouped by speaker
   */
  const getSpeakerSegments = useCallback((): Map<number, TranscriptionSegment[]> => {
    const speakerMap = new Map<number, TranscriptionSegment[]>();

    for (const segment of segments) {
      if (segment.speaker !== undefined) {
        const existing = speakerMap.get(segment.speaker) || [];
        speakerMap.set(segment.speaker, [...existing, segment]);
      }
    }

    return speakerMap;
  }, [segments]);

  /**
   * Cleanup resources
   */
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setIsReconnecting(false);
  }, []);

  return {
    // State
    isTranscribing,
    segments,
    currentText,
    error,
    currentProvider,
    metrics,
    isReconnecting,

    // Actions
    startTranscription,
    stopTranscription,
    sendAudio,
    clearSegments,
    retryConnection,

    // Utilities
    getFullTranscript,
    getFinalTranscript,
    getSpeakerSegments,
  };
}
