import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AudioRecorder,
  AudioFormat,
  RecorderConfig,
  checkBrowserCompatibility,
  requestMicrophonePermission,
  getDefaultQualitySettings,
  getAudioInputDevices,
  createStreamWithDevice,
  BrowserCompatibility,
} from '@/lib/audio/recorder';

export interface UseAudioRecorderOptions {
  format?: AudioFormat;
  timeSlice?: number;
  onDataAvailable?: (blob: Blob) => void;
  deviceId?: string;
}

export interface UseAudioRecorderReturn {
  // State
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioLevel: number;
  error: string | null;
  permissionGranted: boolean;
  compatibility: BrowserCompatibility;
  devices: MediaDeviceInfo[];
  selectedDevice: string | null;

  // Actions
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  requestPermission: () => Promise<boolean>;
  selectDevice: (deviceId: string) => Promise<void>;

  // Utilities
  formatDuration: (ms: number) => string;
}

export function useAudioRecorder(
  options: UseAudioRecorderOptions = {}
): UseAudioRecorderReturn {
  const {
    format = 'webm',
    timeSlice,
    onDataAvailable,
    deviceId: initialDeviceId,
  } = options;

  // Refs
  const recorderRef = useRef<AudioRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [compatibility] = useState<BrowserCompatibility>(checkBrowserCompatibility());
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(
    initialDeviceId || null
  );

  // Load audio devices on mount
  useEffect(() => {
    loadDevices();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Update duration while recording
  useEffect(() => {
    if (isRecording && !isPaused) {
      durationIntervalRef.current = setInterval(() => {
        if (recorderRef.current) {
          setDuration(recorderRef.current.getDuration());
        }
      }, 100);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [isRecording, isPaused]);

  /**
   * Load available audio input devices
   */
  const loadDevices = async () => {
    try {
      const audioDevices = await getAudioInputDevices();
      setDevices(audioDevices);

      // Set default device if none selected
      if (!selectedDevice && audioDevices.length > 0) {
        setSelectedDevice(audioDevices[0].deviceId);
      }
    } catch (err) {
      console.error('Error loading audio devices:', err);
    }
  };

  /**
   * Request microphone permission
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!compatibility.isSupported) {
      setError(
        `Your browser (${compatibility.browser}) does not support audio recording. Missing features: ${compatibility.missingFeatures.join(', ')}`
      );
      return false;
    }

    setError(null);
    const result = await requestMicrophonePermission();

    if (result.granted && result.stream) {
      setPermissionGranted(true);
      streamRef.current = result.stream;

      // Reload devices after permission is granted
      await loadDevices();

      return true;
    } else {
      setError(result.error || 'Failed to access microphone');
      setPermissionGranted(false);
      return false;
    }
  }, [compatibility]);

  /**
   * Select an audio input device
   */
  const selectDevice = useCallback(
    async (deviceId: string) => {
      // Can't change device while recording
      if (isRecording) {
        setError('Cannot change microphone while recording');
        return;
      }

      setError(null);
      setSelectedDevice(deviceId);

      // If we already have permission, create new stream with selected device
      if (permissionGranted) {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        const newStream = await createStreamWithDevice(deviceId);
        if (newStream) {
          streamRef.current = newStream;
        } else {
          setError('Failed to switch to selected microphone');
        }
      }
    },
    [isRecording, permissionGranted]
  );

  /**
   * Initialize recorder
   */
  const initializeRecorder = useCallback(async (): Promise<boolean> => {
    try {
      // Request permission if not granted
      if (!permissionGranted || !streamRef.current) {
        const granted = await requestPermission();
        if (!granted) return false;
      }

      // Create stream with selected device if specified
      if (selectedDevice && streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        const newStream = await createStreamWithDevice(selectedDevice);
        if (newStream) {
          streamRef.current = newStream;
        }
      }

      if (!streamRef.current) {
        setError('No audio stream available');
        return false;
      }

      // Create recorder config
      const config: RecorderConfig = {
        format,
        quality: getDefaultQualitySettings(format),
        timeSlice,
        onDataAvailable,
        onAudioLevel: (level) => setAudioLevel(level),
      };

      // Initialize recorder
      const recorder = new AudioRecorder(config);
      await recorder.initialize(streamRef.current);
      recorderRef.current = recorder;

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize recorder');
      return false;
    }
  }, [format, timeSlice, onDataAvailable, permissionGranted, selectedDevice, requestPermission]);

  /**
   * Start recording
   */
  const startRecording = useCallback(async () => {
    setError(null);

    try {
      const initialized = await initializeRecorder();
      if (!initialized || !recorderRef.current) {
        return;
      }

      recorderRef.current.start();
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    }
  }, [initializeRecorder]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    setError(null);

    try {
      if (!recorderRef.current) {
        setError('No active recording');
        return null;
      }

      const blob = await recorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      setAudioLevel(0);

      // Update final duration
      if (recorderRef.current) {
        setDuration(recorderRef.current.getDuration());
      }

      return blob;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop recording');
      return null;
    } finally {
      cleanup();
    }
  }, []);

  /**
   * Pause recording
   */
  const pauseRecording = useCallback(() => {
    setError(null);

    try {
      if (!recorderRef.current) {
        setError('No active recording');
        return;
      }

      recorderRef.current.pause();
      setIsPaused(true);
      setAudioLevel(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause recording');
    }
  }, []);

  /**
   * Resume recording
   */
  const resumeRecording = useCallback(() => {
    setError(null);

    try {
      if (!recorderRef.current) {
        setError('No active recording');
        return;
      }

      recorderRef.current.resume();
      setIsPaused(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume recording');
    }
  }, []);

  /**
   * Format duration in ms to HH:MM:SS
   */
  const formatDuration = useCallback((ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  /**
   * Cleanup resources
   */
  const cleanup = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.destroy();
      recorderRef.current = null;
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    setDuration(0);
    setAudioLevel(0);
  }, []);

  return {
    // State
    isRecording,
    isPaused,
    duration,
    audioLevel,
    error,
    permissionGranted,
    compatibility,
    devices,
    selectedDevice,

    // Actions
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    requestPermission,
    selectDevice,

    // Utilities
    formatDuration,
  };
}
