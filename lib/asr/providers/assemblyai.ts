import { RealtimeTranscriber } from 'assemblyai';

export interface AssemblyAIConfig {
  apiKey: string;
  sampleRate?: number;
  wordBoost?: string[];
  encoding?: 'pcm_s16le' | 'pcm_mulaw';
}

export interface TranscriptionSegment {
  text: string;
  speaker?: number;
  confidence: number;
  startTime: number;
  endTime: number;
  isFinal: boolean;
}

export interface AssemblyAIWord {
  text: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: string;
}

export interface AssemblyAITranscript {
  message_type: 'PartialTranscript' | 'FinalTranscript';
  text: string;
  confidence?: number;
  words?: AssemblyAIWord[];
  audio_start?: number;
  audio_end?: number;
  created?: string;
}

export interface AssemblyAIStreamCallbacks {
  onTranscript?: (segment: TranscriptionSegment) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
  onOpen?: () => void;
}

/**
 * AssemblyAI ASR Provider
 * Supports real-time streaming transcription with speaker diarization
 */
export class AssemblyAIProvider {
  private transcriber: RealtimeTranscriber | null = null;
  private config: AssemblyAIConfig;
  private isConnected: boolean = false;

  constructor(config: AssemblyAIConfig) {
    this.config = {
      sampleRate: 16000,
      encoding: 'pcm_s16le',
      ...config,
    };
  }

  /**
   * Start streaming transcription
   */
  async startStream(callbacks: AssemblyAIStreamCallbacks): Promise<void> {
    try {
      // Create realtime transcriber
      this.transcriber = new RealtimeTranscriber({
        apiKey: this.config.apiKey,
        sampleRate: this.config.sampleRate,
        wordBoost: this.config.wordBoost,
        encoding: this.config.encoding,
      });

      // Setup event handlers
      this.transcriber.on('open', ({ sessionId }: { sessionId: string }) => {
        this.isConnected = true;
        if (callbacks.onOpen) {
          callbacks.onOpen();
        }
      });

      this.transcriber.on('transcript', (transcript: AssemblyAITranscript) => {
        if (callbacks.onTranscript) {
          const segment = this.parseTranscriptData(transcript);
          if (segment) {
            callbacks.onTranscript(segment);
          }
        }
      });

      this.transcriber.on('error', (error: Error) => {
        this.isConnected = false;
        if (callbacks.onError) {
          callbacks.onError(error);
        }
      });

      this.transcriber.on('close', (code: number, reason: string) => {
        this.isConnected = false;
        if (callbacks.onClose) {
          callbacks.onClose();
        }
      });

      // Connect to AssemblyAI
      await this.transcriber.connect();
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
    if (!this.transcriber || !this.isConnected) {
      throw new Error('Stream not connected');
    }

    this.transcriber.sendAudio(audioData);
  }

  /**
   * Stop the stream
   */
  async stopStream(): Promise<void> {
    if (this.transcriber) {
      await this.transcriber.close();
      this.transcriber = null;
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
   * Parse AssemblyAI transcript response to our standard format
   */
  private parseTranscriptData(
    data: AssemblyAITranscript
  ): TranscriptionSegment | null {
    // Skip empty transcripts
    if (!data.text || data.text.trim() === '') {
      return null;
    }

    const isFinal = data.message_type === 'FinalTranscript';
    const words = data.words || [];

    // Calculate average confidence
    const avgConfidence =
      words.length > 0
        ? words.reduce((sum, word) => sum + (word.confidence || 0), 0) / words.length
        : data.confidence || 0.8;

    // Get speaker from first word (if available)
    const speakerLabel = words.length > 0 ? words[0].speaker : undefined;
    const speaker = speakerLabel ? this.parseSpeakerLabel(speakerLabel) : undefined;

    // Get timing
    const startTime = data.audio_start || (words.length > 0 ? words[0].start : 0);
    const endTime =
      data.audio_end || (words.length > 0 ? words[words.length - 1].end : startTime);

    return {
      text: data.text,
      speaker,
      confidence: avgConfidence,
      startTime,
      endTime,
      isFinal,
    };
  }

  /**
   * Parse speaker label to number (e.g., "A" -> 0, "B" -> 1)
   */
  private parseSpeakerLabel(label: string): number | undefined {
    if (!label) return undefined;
    const charCode = label.charCodeAt(0);
    if (charCode >= 65 && charCode <= 90) {
      // A-Z
      return charCode - 65;
    }
    return undefined;
  }

  /**
   * Transcribe pre-recorded audio file
   */
  async transcribeFile(
    audioUrl: string,
    options: {
      speakerLabels?: boolean;
      punctuate?: boolean;
      formatText?: boolean;
    } = {}
  ): Promise<{
    transcript: string;
    segments: TranscriptionSegment[];
    metadata: any;
  }> {
    try {
      const response = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          authorization: this.config.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          audio_url: audioUrl,
          speaker_labels: options.speakerLabels ?? true,
          punctuate: options.punctuate ?? true,
          format_text: options.formatText ?? true,
        }),
      });

      if (!response.ok) {
        throw new Error(`AssemblyAI API error: ${response.statusText}`);
      }

      const transcript = await response.json();
      const transcriptId = transcript.id;

      // Poll for completion
      const result = await this.pollTranscript(transcriptId);

      // Convert to segments
      const segments: TranscriptionSegment[] = [];

      if (result.utterances) {
        for (const utterance of result.utterances) {
          const speaker = this.parseSpeakerLabel(utterance.speaker);
          segments.push({
            text: utterance.text,
            speaker,
            confidence: utterance.confidence,
            startTime: utterance.start,
            endTime: utterance.end,
            isFinal: true,
          });
        }
      } else if (result.words) {
        // Group words by speaker
        let currentSpeaker = result.words[0]?.speaker;
        let currentText = '';
        let currentStart = result.words[0]?.start || 0;
        let currentConfidences: number[] = [];

        for (const word of result.words) {
          if (word.speaker !== currentSpeaker && currentText) {
            // Finish current segment
            const avgConfidence =
              currentConfidences.reduce((sum, c) => sum + c, 0) /
              currentConfidences.length;
            segments.push({
              text: currentText.trim(),
              speaker: this.parseSpeakerLabel(currentSpeaker),
              confidence: avgConfidence,
              startTime: currentStart,
              endTime: word.start,
              isFinal: true,
            });

            // Start new segment
            currentSpeaker = word.speaker;
            currentText = word.text;
            currentStart = word.start;
            currentConfidences = [word.confidence];
          } else {
            currentText += ' ' + word.text;
            currentConfidences.push(word.confidence);
          }
        }

        // Add final segment
        if (currentText) {
          const avgConfidence =
            currentConfidences.reduce((sum, c) => sum + c, 0) / currentConfidences.length;
          const lastWord = result.words[result.words.length - 1];
          segments.push({
            text: currentText.trim(),
            speaker: this.parseSpeakerLabel(currentSpeaker),
            confidence: avgConfidence,
            startTime: currentStart,
            endTime: lastWord.end,
            isFinal: true,
          });
        }
      }

      return {
        transcript: result.text,
        segments,
        metadata: {
          id: result.id,
          status: result.status,
          language_code: result.language_code,
          audio_duration: result.audio_duration,
        },
      };
    } catch (error) {
      throw error instanceof Error ? error : new Error('Transcription failed');
    }
  }

  /**
   * Poll transcript until completed
   */
  private async pollTranscript(
    transcriptId: string,
    maxAttempts: number = 60
  ): Promise<any> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        {
          headers: {
            authorization: this.config.apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`AssemblyAI API error: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.status === 'completed') {
        return result;
      } else if (result.status === 'error') {
        throw new Error(result.error || 'Transcription failed');
      }

      // Wait 1 second before polling again
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error('Transcription timeout');
  }

  /**
   * Upload audio file to AssemblyAI
   */
  async uploadFile(audioBuffer: Buffer): Promise<string> {
    try {
      const response = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
          authorization: this.config.apiKey,
          'content-type': 'application/octet-stream',
        },
        body: audioBuffer,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result.upload_url;
    } catch (error) {
      throw error instanceof Error ? error : new Error('Upload failed');
    }
  }

  /**
   * Get provider name
   */
  getName(): string {
    return 'assemblyai';
  }

  /**
   * Get provider pricing (per minute)
   */
  getPricing(): { streaming: number; batch: number } {
    return {
      streaming: 0.0065, // $0.0065 per minute for streaming
      batch: 0.0065, // $0.0065 per minute for batch
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
 * Create AssemblyAI provider instance
 */
export function createAssemblyAIProvider(apiKey: string): AssemblyAIProvider {
  return new AssemblyAIProvider({ apiKey });
}
