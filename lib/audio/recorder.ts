import RecordRTC, { StereoAudioRecorder } from 'recordrtc';

export type AudioFormat = 'webm' | 'wav';

export interface AudioQualitySettings {
  sampleRate: number;
  numberOfAudioChannels: number;
  desiredSampleRate?: number;
  bitrate?: number;
}

export interface RecorderConfig {
  format: AudioFormat;
  quality: AudioQualitySettings;
  timeSlice?: number; // For chunked recording (ms)
  onDataAvailable?: (blob: Blob) => void;
  onAudioLevel?: (level: number) => void;
}

export interface BrowserCompatibility {
  isSupported: boolean;
  missingFeatures: string[];
  browser: string;
}

/**
 * Check browser compatibility for audio recording
 */
export function checkBrowserCompatibility(): BrowserCompatibility {
  const missingFeatures: string[] = [];
  let browser = 'Unknown';

  // Detect browser
  const userAgent = navigator.userAgent;
  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Safari') && !userAgent.includes('Chrome'))
    browser = 'Safari';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Edge')) browser = 'Edge';

  // Check for required features
  if (!navigator.mediaDevices) {
    missingFeatures.push('navigator.mediaDevices');
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    missingFeatures.push('getUserMedia');
  }

  if (!window.MediaRecorder && !window.AudioContext && !(window as any).webkitAudioContext) {
    missingFeatures.push('MediaRecorder or AudioContext');
  }

  return {
    isSupported: missingFeatures.length === 0,
    missingFeatures,
    browser,
  };
}

/**
 * Request microphone permission
 */
export async function requestMicrophonePermission(): Promise<{
  granted: boolean;
  stream?: MediaStream;
  error?: string;
}> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    return { granted: true, stream };
  } catch (error) {
    let errorMessage = 'Microphone access denied';

    if (error instanceof Error) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Microphone permission was denied. Please allow microphone access.';
      } else if (error.name === 'NotFoundError' || error.name === 'DeviceNotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage =
          'Microphone is already in use by another application or browser tab.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Microphone does not meet the required constraints.';
      } else if (error.name === 'SecurityError') {
        errorMessage =
          'Microphone access blocked due to security restrictions. Please use HTTPS.';
      } else {
        errorMessage = error.message || 'Failed to access microphone';
      }
    }

    return { granted: false, error: errorMessage };
  }
}

/**
 * Get default quality settings based on format
 */
export function getDefaultQualitySettings(format: AudioFormat): AudioQualitySettings {
  if (format === 'wav') {
    return {
      sampleRate: 48000,
      numberOfAudioChannels: 1, // Mono for smaller file size
      desiredSampleRate: 16000, // Downsample for speech recognition
      bitrate: 128000,
    };
  }

  // WebM defaults
  return {
    sampleRate: 48000,
    numberOfAudioChannels: 1,
    bitrate: 128000,
  };
}

/**
 * AudioRecorder class using RecordRTC
 */
export class AudioRecorder {
  private recorder: RecordRTC | null = null;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private animationFrameId: number | null = null;
  private config: RecorderConfig;
  private chunks: Blob[] = [];
  private startTime: number = 0;
  private pausedDuration: number = 0;
  private lastPauseTime: number = 0;

  constructor(config: RecorderConfig) {
    this.config = config;
  }

  /**
   * Initialize the recorder with a media stream
   */
  async initialize(stream: MediaStream): Promise<void> {
    this.stream = stream;

    // Setup audio analysis
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;

    const source = this.audioContext.createMediaStreamSource(stream);
    source.connect(this.analyser);

    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    // Configure RecordRTC based on format
    const recorderConfig: any = {
      type: 'audio',
      mimeType: this.config.format === 'wav' ? 'audio/wav' : 'audio/webm',
      recorderType: this.config.format === 'wav' ? StereoAudioRecorder : undefined,
      numberOfAudioChannels: this.config.quality.numberOfAudioChannels,
      desiredSampleRate: this.config.quality.desiredSampleRate || this.config.quality.sampleRate,
      timeSlice: this.config.timeSlice,
      ondataavailable: (blob: Blob) => {
        this.chunks.push(blob);
        if (this.config.onDataAvailable) {
          this.config.onDataAvailable(blob);
        }
      },
    };

    // Add bitrate for WebM
    if (this.config.format === 'webm' && this.config.quality.bitrate) {
      recorderConfig.audioBitsPerSecond = this.config.quality.bitrate;
    }

    this.recorder = new RecordRTC(stream, recorderConfig);
  }

  /**
   * Start recording
   */
  start(): void {
    if (!this.recorder) {
      throw new Error('Recorder not initialized');
    }

    this.chunks = [];
    this.startTime = Date.now();
    this.pausedDuration = 0;
    this.lastPauseTime = 0;

    this.recorder.startRecording();
    this.startAudioLevelMonitoring();
  }

  /**
   * Pause recording
   */
  pause(): void {
    if (!this.recorder) {
      throw new Error('Recorder not initialized');
    }

    this.recorder.pauseRecording();
    this.lastPauseTime = Date.now();
    this.stopAudioLevelMonitoring();
  }

  /**
   * Resume recording
   */
  resume(): void {
    if (!this.recorder) {
      throw new Error('Recorder not initialized');
    }

    if (this.lastPauseTime > 0) {
      this.pausedDuration += Date.now() - this.lastPauseTime;
      this.lastPauseTime = 0;
    }

    this.recorder.resumeRecording();
    this.startAudioLevelMonitoring();
  }

  /**
   * Stop recording and return the blob
   */
  async stop(): Promise<Blob> {
    if (!this.recorder) {
      throw new Error('Recorder not initialized');
    }

    return new Promise((resolve, reject) => {
      this.stopAudioLevelMonitoring();

      this.recorder!.stopRecording(() => {
        try {
          const blob = this.recorder!.getBlob();
          resolve(blob);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Get current recording duration in milliseconds
   */
  getDuration(): number {
    if (this.startTime === 0) return 0;

    const now = Date.now();
    const elapsed = now - this.startTime - this.pausedDuration;

    // If currently paused, subtract the current pause duration
    if (this.lastPauseTime > 0) {
      return elapsed - (now - this.lastPauseTime);
    }

    return elapsed;
  }

  /**
   * Get recording state
   */
  getState(): 'inactive' | 'recording' | 'paused' {
    if (!this.recorder) return 'inactive';

    const state = this.recorder.getState();
    if (state === 'recording') return 'recording';
    if (state === 'paused') return 'paused';
    return 'inactive';
  }

  /**
   * Start monitoring audio levels
   */
  private startAudioLevelMonitoring(): void {
    if (!this.analyser || !this.dataArray) return;

    const updateLevel = () => {
      if (!this.analyser || !this.dataArray) return;

      this.analyser.getByteFrequencyData(this.dataArray);

      // Calculate average volume level (0-100)
      const sum = this.dataArray.reduce((acc, val) => acc + val, 0);
      const average = sum / this.dataArray.length;
      const level = Math.round((average / 255) * 100);

      if (this.config.onAudioLevel) {
        this.config.onAudioLevel(level);
      }

      this.animationFrameId = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  }

  /**
   * Stop monitoring audio levels
   */
  private stopAudioLevelMonitoring(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.config.onAudioLevel) {
      this.config.onAudioLevel(0);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopAudioLevelMonitoring();

    if (this.recorder) {
      if (this.recorder.getState() !== 'stopped') {
        this.recorder.stopRecording(() => {
          this.recorder?.destroy();
          this.recorder = null;
        });
      } else {
        this.recorder.destroy();
        this.recorder = null;
      }
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.dataArray = null;
    this.chunks = [];
  }
}

/**
 * Get available audio input devices
 */
export async function getAudioInputDevices(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === 'audioinput');
  } catch (error) {
    console.error('Error enumerating audio devices:', error);
    return [];
  }
}

/**
 * Create a media stream with specific audio device
 */
export async function createStreamWithDevice(
  deviceId: string
): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: deviceId },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (error) {
    console.error('Error creating stream with device:', error);
    return null;
  }
}
