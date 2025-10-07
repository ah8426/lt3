'use client';

import { useEffect, useState } from 'react';
import { useAudioRecorder, UseAudioRecorderOptions } from '@/hooks/useAudioRecorder';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Mic,
  Square,
  Pause,
  Play,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import type { AudioFormat } from '@/lib/audio/recorder';

export interface AudioRecorderProps {
  format?: AudioFormat;
  timeSlice?: number;
  onRecordingComplete?: (blob: Blob, duration: number) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  onError?: (error: string) => void;
  showFormatSelector?: boolean;
  showDeviceSelector?: boolean;
  autoStart?: boolean;
}

export function AudioRecorder({
  format: initialFormat = 'webm',
  timeSlice,
  onRecordingComplete,
  onRecordingStart,
  onRecordingStop,
  onError,
  showFormatSelector = false,
  showDeviceSelector = true,
  autoStart = false,
}: AudioRecorderProps) {
  const [format, setFormat] = useState<AudioFormat>(initialFormat);
  const [isInitializing, setIsInitializing] = useState(false);

  const recorderOptions: UseAudioRecorderOptions = {
    format,
    timeSlice,
  };

  const {
    isRecording,
    isPaused,
    duration,
    audioLevel,
    error,
    permissionGranted,
    compatibility,
    devices,
    selectedDevice,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    requestPermission,
    selectDevice,
    formatDuration,
  } = useAudioRecorder(recorderOptions);

  // Handle errors
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Auto-start if requested
  useEffect(() => {
    if (autoStart && !isRecording && permissionGranted) {
      handleStart();
    }
  }, [autoStart, permissionGranted]);

  /**
   * Request permission on mount if not granted
   */
  useEffect(() => {
    if (!permissionGranted && compatibility.isSupported) {
      handleRequestPermission();
    }
  }, []);

  const handleRequestPermission = async () => {
    setIsInitializing(true);
    await requestPermission();
    setIsInitializing(false);
  };

  const handleStart = async () => {
    await startRecording();
    if (onRecordingStart) {
      onRecordingStart();
    }
  };

  const handleStop = async () => {
    const blob = await stopRecording();
    if (blob && onRecordingComplete) {
      onRecordingComplete(blob, duration);
    }
    if (onRecordingStop) {
      onRecordingStop();
    }
  };

  const handlePause = () => {
    pauseRecording();
  };

  const handleResume = () => {
    resumeRecording();
  };

  const handleDeviceChange = async (deviceId: string) => {
    await selectDevice(deviceId);
  };

  const handleFormatChange = (newFormat: AudioFormat) => {
    if (isRecording) {
      return; // Can't change format while recording
    }
    setFormat(newFormat);
  };

  // Calculate audio level bar width (0-100%)
  const levelBarWidth = Math.min(audioLevel, 100);

  // Don't render if browser is not compatible
  if (!compatibility.isSupported) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Your browser ({compatibility.browser}) does not support audio recording.
          <br />
          Missing features: {compatibility.missingFeatures.join(', ')}
          <br />
          <br />
          Please try using Chrome, Firefox, or Edge for the best experience.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-6 space-y-6">
        {/* Permission Request */}
        {!permissionGranted && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Microphone permission is required to record audio.</span>
              <Button
                size="sm"
                onClick={handleRequestPermission}
                disabled={isInitializing}
                className="ml-4"
              >
                {isInitializing ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Requesting...
                  </>
                ) : (
                  'Grant Permission'
                )}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Permission Granted */}
        {permissionGranted && !isRecording && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              Microphone access granted. Ready to record.
            </AlertDescription>
          </Alert>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Device Selector */}
        {showDeviceSelector && devices.length > 0 && !isRecording && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Microphone
            </label>
            <Select
              value={selectedDevice || undefined}
              onValueChange={handleDeviceChange}
              disabled={isRecording}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select microphone" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Format Selector */}
        {showFormatSelector && !isRecording && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Audio Format
            </label>
            <Select
              value={format}
              onValueChange={(value) => handleFormatChange(value as AudioFormat)}
              disabled={isRecording}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="webm">WebM (Smaller file size)</SelectItem>
                <SelectItem value="wav">WAV (Better compatibility)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Recording Controls */}
        <div className="space-y-4">
          {/* Timer and Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isRecording && (
                <>
                  {!isPaused && (
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-red-600 animate-pulse" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Recording
                      </span>
                    </div>
                  )}
                  {isPaused && (
                    <div className="flex items-center gap-2">
                      <Pause className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Paused
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="text-2xl font-mono font-bold text-gray-900 dark:text-white">
              {formatDuration(duration)}
            </div>
          </div>

          {/* Audio Level Meter */}
          {isRecording && !isPaused && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Audio Level</span>
                <span>{audioLevel}%</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#00BFA5] to-teal-600 transition-all duration-100 ease-out"
                  style={{ width: `${levelBarWidth}%` }}
                />
              </div>
            </div>
          )}

          {/* Waveform Visualization (Simple bars) */}
          {isRecording && !isPaused && (
            <div className="flex items-center justify-center gap-1 h-16">
              {Array.from({ length: 20 }).map((_, i) => {
                // Create wave effect based on audio level
                const barHeight = Math.max(
                  10,
                  (audioLevel / 100) * 64 * Math.sin(i * 0.5 + Date.now() / 200)
                );
                return (
                  <div
                    key={i}
                    className="w-1 bg-[#00BFA5] rounded-full transition-all duration-100"
                    style={{
                      height: `${Math.abs(barHeight)}px`,
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-4">
            {!isRecording ? (
              <Button
                size="lg"
                onClick={handleStart}
                disabled={!permissionGranted}
                className="bg-[#00BFA5] hover:bg-[#00BFA5]/90 w-full sm:w-auto"
              >
                <Mic className="mr-2 h-5 w-5" />
                Start Recording
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={isPaused ? handleResume : handlePause}
                  className="w-full sm:w-auto"
                >
                  {isPaused ? (
                    <>
                      <Play className="mr-2 h-5 w-5" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="mr-2 h-5 w-5" />
                      Pause
                    </>
                  )}
                </Button>
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={handleStop}
                  className="w-full sm:w-auto"
                >
                  <Square className="mr-2 h-5 w-5" />
                  Stop
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Browser Info */}
        <div className="pt-4 border-t dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Using {compatibility.browser} • Format: {format.toUpperCase()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
