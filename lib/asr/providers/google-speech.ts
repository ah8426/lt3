import { SpeechClient, protos } from '@google-cloud/speech';

export interface GoogleSpeechConfig {
  apiKey: string;
  languageCode?: string;
  encoding?: string;
  sampleRateHertz?: number;
  enableSpeakerDiarization?: boolean;
  diarizationSpeakerCount?: number;
  enableAutomaticPunctuation?: boolean;
  model?: string;
}

export interface TranscriptionSegment {
  text: string;
  speaker?: number;
  confidence: number;
  startTime: number;
  endTime: number;
  isFinal: boolean;
}

export interface GoogleSpeechWord {
  word: string;
  startTime: { seconds: string; nanos: number };
  endTime: { seconds: string; nanos: number };
  confidence?: number;
  speakerTag?: number;
}

export interface GoogleSpeechStreamCallbacks {
  onTranscript?: (segment: TranscriptionSegment) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
  onOpen?: () => void;
}

/**
 * Google Cloud Speech-to-Text ASR Provider
 * Supports real-time streaming transcription with speaker diarization
 */
export class GoogleSpeechProvider {
  private client: SpeechClient | null = null;
  private stream: any = null;
  private config: GoogleSpeechConfig;
  private isConnected: boolean = false;

  constructor(config: GoogleSpeechConfig) {
    this.config = {
      languageCode: 'en-US',
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      enableSpeakerDiarization: true,
      diarizationSpeakerCount: 2,
      enableAutomaticPunctuation: true,
      model: 'latest_long',
      ...config,
    };

    // Initialize client with API key
    this.client = new SpeechClient({
      apiKey: this.config.apiKey,
    });
  }

  /**
   * Start streaming transcription
   */
  async startStream(callbacks: GoogleSpeechStreamCallbacks): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    try {
      const request = {
        config: {
          encoding: this.config.encoding as any,
          sampleRateHertz: this.config.sampleRateHertz,
          languageCode: this.config.languageCode,
          enableAutomaticPunctuation: this.config.enableAutomaticPunctuation,
          model: this.config.model,
          diarizationConfig: this.config.enableSpeakerDiarization
            ? {
                enableSpeakerDiarization: true,
                minSpeakerCount: 1,
                maxSpeakerCount: this.config.diarizationSpeakerCount || 2,
              }
            : undefined,
        },
        interimResults: true,
      };

      // Create streaming recognize stream
      this.stream = this.client
        .streamingRecognize(request as any)
        .on('error', (error: Error) => {
          this.isConnected = false;
          if (callbacks.onError) {
            callbacks.onError(error);
          }
        })
        .on('data', (response: any) => {
          if (callbacks.onTranscript && response.results?.[0]) {
            const segment = this.parseTranscriptData(response.results[0]);
            if (segment) {
              callbacks.onTranscript(segment);
            }
          }
        })
        .on('end', () => {
          this.isConnected = false;
          if (callbacks.onClose) {
            callbacks.onClose();
          }
        });

      this.isConnected = true;

      if (callbacks.onOpen) {
        callbacks.onOpen();
      }
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
    if (!this.stream || !this.isConnected) {
      throw new Error('Stream not connected');
    }

    this.stream.write({ audioContent: audioData });
  }

  /**
   * Stop the stream
   */
  async stopStream(): Promise<void> {
    if (this.stream) {
      this.stream.end();
      this.stream = null;
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
   * Parse Google Speech transcript response to our standard format
   */
  private parseTranscriptData(result: any): TranscriptionSegment | null {
    const alternative = result.alternatives?.[0];
    if (!alternative || !alternative.transcript) {
      return null;
    }

    const words = alternative.words || [];
    const isFinal = result.isFinal || false;

    // Calculate average confidence
    const avgConfidence =
      words.length > 0
        ? words.reduce((sum: number, word: GoogleSpeechWord) => sum + (word.confidence || 0), 0) /
          words.length
        : alternative.confidence || 0.8;

    // Get speaker from first word
    const speaker =
      words.length > 0 && words[0].speakerTag !== undefined
        ? words[0].speakerTag
        : undefined;

    // Get timing
    const startTime =
      words.length > 0 ? this.parseTime(words[0].startTime) : 0;
    const endTime =
      words.length > 0
        ? this.parseTime(words[words.length - 1].endTime)
        : startTime;

    return {
      text: alternative.transcript,
      speaker,
      confidence: avgConfidence,
      startTime,
      endTime,
      isFinal,
    };
  }

  /**
   * Parse Google timestamp to milliseconds
   */
  private parseTime(time: any): number {
    if (!time) return 0;
    const seconds = typeof time.seconds === 'string' ? parseInt(time.seconds) : Number(time.seconds || 0);
    const nanos = Number(time.nanos || 0);
    return seconds * 1000 + nanos / 1000000;
  }

  /**
   * Transcribe pre-recorded audio file
   */
  async transcribeFile(
    audioBuffer: Buffer,
    options: {
      encoding?: string;
      sampleRateHertz?: number;
      enableSpeakerDiarization?: boolean;
    } = {}
  ): Promise<{
    transcript: string;
    segments: TranscriptionSegment[];
    metadata: any;
  }> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    try {
      const request = {
        audio: {
          content: audioBuffer.toString('base64'),
        },
        config: {
          encoding: (options.encoding || this.config.encoding) as any,
          sampleRateHertz: options.sampleRateHertz || this.config.sampleRateHertz,
          languageCode: this.config.languageCode,
          enableAutomaticPunctuation: this.config.enableAutomaticPunctuation,
          model: this.config.model,
          diarizationConfig:
            options.enableSpeakerDiarization ?? this.config.enableSpeakerDiarization
              ? {
                  enableSpeakerDiarization: true,
                  minSpeakerCount: 1,
                  maxSpeakerCount: this.config.diarizationSpeakerCount || 2,
                }
              : undefined,
        },
      };

      const [response] = await this.client.recognize(request as any);

      if (!response.results || response.results.length === 0) {
        throw new Error('No transcription results');
      }

      // Combine all results
      let fullTranscript = '';
      const segments: TranscriptionSegment[] = [];

      for (const result of response.results) {
        const alternative = result.alternatives?.[0];
        if (!alternative) continue;

        fullTranscript += alternative.transcript + ' ';

        const words = alternative.words || [];

        if (words.length > 0) {
          // Group by speaker
          let currentSpeaker = words[0].speakerTag;
          let currentText = '';
          let currentStart = this.parseTime(words[0].startTime);
          let currentConfidences: number[] = [];

          for (const word of words) {
            if (word.speakerTag !== currentSpeaker && currentText) {
              // Finish current segment
              const avgConfidence =
                currentConfidences.reduce((sum, c) => sum + c, 0) /
                currentConfidences.length;
              segments.push({
                text: currentText.trim(),
                speaker: currentSpeaker ?? undefined,
                confidence: avgConfidence,
                startTime: currentStart,
                endTime: this.parseTime(word.startTime),
                isFinal: true,
              });

              // Start new segment
              currentSpeaker = word.speakerTag;
              currentText = word.word || '';
              currentStart = this.parseTime(word.startTime);
              currentConfidences = [word.confidence || 0.9];
            } else {
              currentText += ' ' + (word.word || '');
              currentConfidences.push(word.confidence || 0.9);
            }
          }

          // Add final segment
          if (currentText) {
            const avgConfidence =
              currentConfidences.reduce((sum, c) => sum + c, 0) /
              currentConfidences.length;
            segments.push({
              text: currentText.trim(),
              speaker: currentSpeaker ?? undefined,
              confidence: avgConfidence,
              startTime: currentStart,
              endTime: this.parseTime(words[words.length - 1].endTime),
              isFinal: true,
            });
          }
        } else {
          // No words, just add the whole alternative
          segments.push({
            text: alternative.transcript || '',
            speaker: undefined,
            confidence: alternative.confidence || 0.9,
            startTime: 0,
            endTime: 0,
            isFinal: true,
          });
        }
      }

      return {
        transcript: fullTranscript.trim(),
        segments,
        metadata: {
          totalBilledTime: response.totalBilledTime,
        },
      };
    } catch (error) {
      throw error instanceof Error ? error : new Error('Transcription failed');
    }
  }

  /**
   * Get provider name
   */
  getName(): string {
    return 'google-speech';
  }

  /**
   * Get provider pricing (per minute)
   */
  getPricing(): { streaming: number; batch: number } {
    return {
      streaming: 0.006, // $0.006 per 15 seconds = $0.024 per minute
      batch: 0.006, // $0.006 per 15 seconds = $0.024 per minute
    };
  }

  /**
   * Calculate cost for duration
   */
  calculateCost(durationMs: number, isStreaming: boolean = true): number {
    // Google bills in 15-second increments
    const seconds = Math.ceil(durationMs / 1000);
    const billedSeconds = Math.ceil(seconds / 15) * 15;
    const pricePerMinute = isStreaming
      ? this.getPricing().streaming
      : this.getPricing().batch;
    return (billedSeconds / 60) * pricePerMinute;
  }
}

/**
 * Create Google Speech provider instance
 */
export function createGoogleSpeechProvider(apiKey: string): GoogleSpeechProvider {
  return new GoogleSpeechProvider({ apiKey });
}
