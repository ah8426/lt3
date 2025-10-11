import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { decryptAPIKey } from '@/lib/server/encryption/key-manager';
import { createASRProviderManager } from '@/lib/asr/provider-manager';
import type { ASRProviderType } from '@/lib/asr/provider-manager';
import type { TranscriptionSegment } from '@/lib/asr/providers/deepgram';

/**
 * Server-side proxy for ASR transcription
 * Handles API key decryption and provider management
 */

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

interface StreamMessage {
  type: 'start' | 'audio' | 'stop';
  audio?: string; // base64 encoded audio
  sessionId?: string;
}

interface StreamResponse {
  type: 'transcript' | 'error' | 'provider-switch' | 'metrics' | 'ready';
  segment?: TranscriptionSegment;
  error?: string;
  fromProvider?: ASRProviderType;
  toProvider?: ASRProviderType;
  metrics?: {
    provider: ASRProviderType;
    durationMs: number;
    cost: number;
  };
}

/**
 * POST /api/transcription/stream
 * WebSocket-like streaming endpoint for real-time transcription
 */
export async function POST(request: NextRequest) {
  // Authenticate user
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();

  try {
    const body = await request.json();
    const message: StreamMessage = body;

    // Get user's API keys from database using Prisma
    const apiKeys = await prisma.encryptedApiKey.findMany({
      where: {
        userId: user.id,
        provider: {
          in: ['deepgram', 'assemblyai', 'google'],
        },
        isActive: true,
      },
      select: {
        provider: true,
        encryptedKey: true,
      },
    });

    if (!apiKeys || apiKeys.length === 0) {
      return NextResponse.json(
        { error: 'No ASR API keys configured. Please add them in Settings.' },
        { status: 400 }
      );
    }

    // Decrypt API keys
    const decryptedKeys: Array<{
      provider: ASRProviderType;
      apiKey: string;
      priority: number;
    }> = [];

    const providerPriority: Record<string, number> = {
      deepgram: 0,
      assemblyai: 1,
      google: 2,
    };

    for (const key of apiKeys) {
      try {
        const decrypted = await decryptAPIKey(key.encryptedKey, user.id);
        decryptedKeys.push({
          provider: key.provider as ASRProviderType,
          apiKey: decrypted,
          priority: providerPriority[key.provider] ?? 99,
        });
      } catch (error) {
        console.error(`Failed to decrypt ${key.provider} key:`, error);
      }
    }

    if (decryptedKeys.length === 0) {
      return NextResponse.json(
        { error: 'Failed to decrypt API keys' },
        { status: 500 }
      );
    }

    // Create provider manager
    const manager = createASRProviderManager(decryptedKeys);

    // Handle different message types
    if (message.type === 'start') {
      // Start transcription stream
      const sessionId = message.sessionId || crypto.randomUUID();
      const startTime = Date.now();

      // Create session record
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          id: sessionId,
          user_id: user.id,
          status: 'recording',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (sessionError) {
        return NextResponse.json(
          { error: 'Failed to create session' },
          { status: 500 }
        );
      }

      // Setup streaming response
      const encoder = new TextEncoder();
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();

      // Keepalive mechanism to prevent connection timeout
      const keepAliveInterval = setInterval(async () => {
        try {
          // Send keepalive comment (ignored by SSE parsers)
          await writer.write(encoder.encode(': keepalive\n\n'));
        } catch (error) {
          // Connection closed, cleanup interval
          clearInterval(keepAliveInterval);
        }
      }, 30000); // Every 30 seconds

      // Cleanup function
      const cleanup = async () => {
        clearInterval(keepAliveInterval);
        await writer.close();
        await manager.cleanup();
      };

      // Start ASR stream
      manager
        .startStream({
          onTranscript: async (segment) => {
            const response: StreamResponse = {
              type: 'transcript',
              segment,
            };

            await writer.write(
              encoder.encode(`data: ${JSON.stringify(response)}\n\n`)
            );

            // Save segment to database
            await supabase.from('transcription_segments').insert({
              session_id: sessionId,
              text: segment.text,
              speaker: segment.speaker,
              confidence: segment.confidence,
              start_time: segment.startTime,
              end_time: segment.endTime,
              is_final: segment.isFinal,
            });
          },
          onError: async (error) => {
            const response: StreamResponse = {
              type: 'error',
              error: error.message,
            };

            await writer.write(
              encoder.encode(`data: ${JSON.stringify(response)}\n\n`)
            );
          },
          onProviderSwitch: async (fromProvider, toProvider) => {
            const response: StreamResponse = {
              type: 'provider-switch',
              fromProvider,
              toProvider,
            };

            await writer.write(
              encoder.encode(`data: ${JSON.stringify(response)}\n\n`)
            );
          },
          onOpen: async () => {
            const response: StreamResponse = {
              type: 'ready',
            };

            await writer.write(
              encoder.encode(`data: ${JSON.stringify(response)}\n\n`)
            );
          },
          onClose: async () => {
            const duration = Date.now() - startTime;
            const currentProvider = manager.getCurrentProvider();

            if (currentProvider) {
              manager.recordUsage(currentProvider, duration, true);

              // Send final metrics
              const stats = manager.getProviderStats(currentProvider);
              if (stats) {
                const response: StreamResponse = {
                  type: 'metrics',
                  metrics: {
                    provider: currentProvider,
                    durationMs: duration,
                    cost: stats.totalCost,
                  },
                };

                await writer.write(
                  encoder.encode(`data: ${JSON.stringify(response)}\n\n`)
                );
              }
            }

            // Update session
            await supabase
              .from('sessions')
              .update({
                status: 'completed',
                duration_ms: duration,
              })
              .eq('id', sessionId);

            await cleanup();
          },
        })
        .catch(async (error) => {
          const response: StreamResponse = {
            type: 'error',
            error: error.message,
          };

          await writer.write(
            encoder.encode(`data: ${JSON.stringify(response)}\n\n`)
          );
          await cleanup();
        });

      return new NextResponse(stream.readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    } else if (message.type === 'audio') {
      // Send audio chunk to provider
      if (!message.audio) {
        return NextResponse.json({ error: 'No audio data' }, { status: 400 });
      }

      const audioBuffer = Buffer.from(message.audio, 'base64');
      manager.sendAudio(audioBuffer);

      return NextResponse.json({ success: true });
    } else if (message.type === 'stop') {
      // Stop transcription
      await manager.stopStream();
      await manager.cleanup();

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid message type' }, { status: 400 });
  } catch (error) {
    console.error('Transcription stream error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Transcription failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/transcription/stream/[sessionId]
 * Get transcription segments for a session
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Get session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get segments
    const { data: segments, error: segmentsError } = await supabase
      .from('transcription_segments')
      .select('*')
      .eq('session_id', sessionId)
      .order('start_time', { ascending: true });

    if (segmentsError) {
      return NextResponse.json(
        { error: 'Failed to fetch segments' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      session,
      segments: segments || [],
    });
  } catch (error) {
    console.error('Get segments error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch segments',
      },
      { status: 500 }
    );
  }
}
