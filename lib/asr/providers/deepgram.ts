import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

export interface DeepgramConfig {
  apiKey: string;
  model?: string;
  language?: string;
  punctuate?: boolean;
  diarize?: boolean;
  smart_format?: boolean;
  interim_results?: boolean;
  endpointing?: number;
  vad_events?: boolean;
}

export interface TranscriptionSegment {
  text: string;
  speaker?: number;
  confidence: number;
  startTime: number;
  endTime: number;
  isFinal: boolean;
}

export interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
  punctuated_word?: string;
}

export interface DeepgramTranscriptResponse {
  channel: {
    alternatives: Array<{
      transcript: string;
      confidence: number;
      words: DeepgramWord[];
    }>;
  };
  metadata: {
    request_id: string;
    model_info: {
      name: string;
      version: string;
    };
  };
  is_final: boolean;
  speech_final: boolean;
  duration?: number;
  start?: number;
}

export interface DeepgramStreamCallbacks {
  onTranscript?: (segment: TranscriptionSegment) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
  onOpen?: () => void;
  onMetadata?: (metadata: any) => void;
}

/**
 * Deepgram ASR Provider
 * Supports real-time streaming transcription with speaker diarization
 */
export class DeepgramProvider {
  private client: ReturnType<typeof createClient>;
  private connection: any = null;
  private config: DeepgramConfig;
  private isConnected: boolean = false;

  constructor(config: DeepgramConfig) {
    this.config = {
      model: 'nova-2',
      language: 'en-US',
      punctuate: true,
      diarize: true,
      smart_format: true,
      interim_results: true,
      endpointing: 300, // ms of silence before finalizing
      vad_events: true,
      ...config,
    };

    this.client = createClient(this.config.apiKey);
  }

  /**
   * Start streaming transcription
   */
  async startStream(callbacks: DeepgramStreamCallbacks): Promise<void> {
    try {
      // Create live transcription connection
      this.connection = this.client.listen.live({
        model: this.config.model,
        language: this.config.language,
        punctuate: this.config.punctuate,
        diarize: this.config.diarize,
        smart_format: this.config.smart_format,
        interim_results: this.config.interim_results,
        endpointing: this.config.endpointing,
        vad_events: this.config.vad_events,
        encoding: 'linear16',
        sample_rate: 16000,
        channels: 1,
      });

      // Setup event handlers
      this.connection.on(LiveTranscriptionEvents.Open, () => {
        this.isConnected = true;
        if (callbacks.onOpen) {
          callbacks.onOpen();
        }
      });

      this.connection.on(
        LiveTranscriptionEvents.Transcript,
        (data: DeepgramTranscriptResponse) => {
          if (callbacks.onTranscript) {
            const segment = this.parseTranscriptData(data);
            if (segment) {
              callbacks.onTranscript(segment);
            }
          }
        }
      );

      this.connection.on(LiveTranscriptionEvents.Metadata, (data: any) => {
        if (callbacks.onMetadata) {
          callbacks.onMetadata(data);
        }
      });

      this.connection.on(LiveTranscriptionEvents.Error, (error: Error) => {
        this.isConnected = false;
        if (callbacks.onError) {
          callbacks.onError(error);
        }
      });

      this.connection.on(LiveTranscriptionEvents.Close, () => {
        this.isConnected = false;
        if (callbacks.onClose) {
          callbacks.onClose();
        }
      });
    } catch (error) {
      this.isConnected = false;
      if (callbacks.onError) {
        callbacks.onError(
          error instanceof Error ? error : new Error('Failed to start stream')
        );
      }
    }
  }

  /**
   * Send audio data to the stream
   */
  sendAudio(audioData: Buffer | Uint8Array): void {
    if (!this.connection || !this.isConnected) {
      throw new Error('Stream not connected');
    }

    this.connection.send(audioData);
  }

  /**
   * Stop the stream
   */
  async stopStream(): Promise<void> {
    if (this.connection) {
      this.connection.finish();
      this.connection = null;
      this.isConnected = false;
    }
  }

  /**
   * Check if stream is connected
   */
  isStreamConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Parse Deepgram transcript response to our standard format
   */
  private parseTranscriptData(
    data: DeepgramTranscriptResponse
  ): TranscriptionSegment | null {
    const channel = data.channel;
    if (!channel?.alternatives?.length) {
      return null;
    }

    const alternative = channel.alternatives[0];
    const words = alternative.words || [];

    // Skip empty transcripts
    if (!alternative.transcript || alternative.transcript.trim() === '') {
      return null;
    }

    // Calculate average confidence
    const avgConfidence =
      words.length > 0
        ? words.reduce((sum, word) => sum + word.confidence, 0) / words.length
        : alternative.confidence;

    // Get speaker from first word (if diarization enabled)
    const speaker = words.length > 0 ? words[0].speaker : undefined;

    // Get timing from first and last word
    const startTime = data.start || (words.length > 0 ? words[0].start : 0);
    const endTime = words.length > 0 ? words[words.length - 1].end : startTime;

    return {
      text: alternative.transcript,
      speaker,
      confidence: avgConfidence,
      startTime,
      endTime,
      isFinal: data.is_final && data.speech_final,
    };
  }

  /**
   * Transcribe pre-recorded audio file
   */
  async transcribeFile(
    audioBuffer: Buffer,
    options: {
      mimetype?: string;
      diarize?: boolean;
      punctuate?: boolean;
      utterances?: boolean;
    } = {}
  ): Promise<{
    transcript: string;
    segments: TranscriptionSegment[];
    metadata: any;
  }> {
    try {
      const { result, error } = await this.client.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: this.config.model,
          language: this.config.language,
          punctuate: options.punctuate ?? this.config.punctuate,
          diarize: options.diarize ?? this.config.diarize,
          smart_format: this.config.smart_format,
          utterances: options.utterances ?? true,
          mimetype: options.mimetype || 'audio/webm',
        }
      );

      if (error) {
        throw new Error(error.message || 'Transcription failed');
      }

      // Parse result
      const channel = result.results?.channels?.[0];
      if (!channel) {
        throw new Error('No transcription results');
      }

      const alternative = channel.alternatives?.[0];
      if (!alternative) {
        throw new Error('No alternatives in transcription');
      }

      // Convert to segments
      const segments: TranscriptionSegment[] = [];

      if (options.utterances && result.results.utterances) {
        // Use utterances for better segmentation
        for (const utterance of result.results.utterances) {
          segments.push({
            text: utterance.transcript,
            speaker: utterance.speaker,
            confidence: utterance.confidence,
            startTime: utterance.start,
            endTime: utterance.end,
            isFinal: true,
          });
        }
      } else if (alternative.words) {
        // Fallback to words
        segments.push({
          text: alternative.transcript,
          speaker: alternative.words[0]?.speaker,
          confidence: alternative.confidence,
          startTime: alternative.words[0]?.start || 0,
          endTime: alternative.words[alternative.words.length - 1]?.end || 0,
          isFinal: true,
        });
      }

      return {
        transcript: alternative.transcript,
        segments,
        metadata: result.metadata,
      };
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error('Transcription failed');
    }
  }

  /**
   * Get provider name
   */
  getName(): string {
    return 'deepgram';
  }

  /**
   * Get provider pricing (per minute)
   */
  getPricing(): { streaming: number; batch: number } {
    return {
      streaming: 0.0043, // $0.0043 per minute for streaming
      batch: 0.0043, // $0.0043 per minute for batch
    };
  }

  /**
   * Calculate cost for duration
   */
  calculateCost(durationMs: number, isStreaming: boolean = true): number {
    const minutes = durationMs / 60000;
    const pricePerMinute = isStreaming
      ? this.getPricing().streaming
      : this.getPricing().batch;
    return minutes * pricePerMinute;
  }
}

/**
 * Create Deepgram provider instance
 */
export function createDeepgramProvider(apiKey: string): DeepgramProvider {
  return new DeepgramProvider({ apiKey });
}
