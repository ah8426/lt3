'use client';

import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react';

interface WaveformVisualizerProps {
  audioBlob: Blob | null;
  isRecording: boolean;
  audioLevel: number;
}

export function WaveformVisualizer({
  audioBlob,
  isRecording,
  audioLevel,
}: WaveformVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Initialize WaveSurfer when audio blob is available
  useEffect(() => {
    if (!containerRef.current || !audioBlob) return;

    // Clean up previous instance
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    // Create new WaveSurfer instance
    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#94a3b8',
      progressColor: '#00BFA5',
      cursorColor: '#1E3A8A',
      barWidth: 2,
      barGap: 1,
      barRadius: 3,
      height: 80,
      normalize: true,
      backend: 'WebAudio',
    });

    // Load audio blob
    wavesurfer.loadBlob(audioBlob);

    // Event handlers
    wavesurfer.on('ready', () => {
      setDuration(wavesurfer.getDuration());
    });

    wavesurfer.on('audioprocess', () => {
      setCurrentTime(wavesurfer.getCurrentTime());
    });

    wavesurfer.on('play', () => {
      setIsPlaying(true);
    });

    wavesurfer.on('pause', () => {
      setIsPlaying(false);
    });

    wavesurfer.on('finish', () => {
      setIsPlaying(false);
    });

    wavesurferRef.current = wavesurfer;

    return () => {
      wavesurfer.destroy();
    };
  }, [audioBlob]);

  // Update volume
  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(isMuted ? 0 : volume);
    }
  }, [volume, isMuted]);

  /**
   * Toggle play/pause
   */
  const handlePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  /**
   * Skip backward 5 seconds
   */
  const handleSkipBackward = () => {
    if (wavesurferRef.current) {
      const newTime = Math.max(0, currentTime - 5);
      wavesurferRef.current.seekTo(newTime / duration);
    }
  };

  /**
   * Skip forward 5 seconds
   */
  const handleSkipForward = () => {
    if (wavesurferRef.current) {
      const newTime = Math.min(duration, currentTime + 5);
      wavesurferRef.current.seekTo(newTime / duration);
    }
  };

  /**
   * Toggle mute
   */
  const handleToggleMute = () => {
    setIsMuted(!isMuted);
  };

  /**
   * Format time
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Show real-time visualization while recording
  if (isRecording && !audioBlob) {
    return (
      <div className="space-y-4">
        <div className="h-20 flex items-center justify-center gap-1">
          {Array.from({ length: 40 }).map((_, i) => {
            // Create wave effect based on audio level
            const barHeight = Math.max(
              4,
              (audioLevel / 100) * 80 * Math.sin(i * 0.3 + Date.now() / 200)
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
        <p className="text-center text-sm text-gray-500">
          Recording in progress...
        </p>
      </div>
    );
  }

  // Show empty state if no audio
  if (!audioBlob) {
    return (
      <div className="h-32 flex items-center justify-center">
        <p className="text-sm text-gray-500">
          No audio available. Start recording to see waveform.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Waveform Container */}
      <div ref={containerRef} className="w-full" />

      {/* Time Display */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handleSkipBackward}
          disabled={!wavesurferRef.current}
        >
          <SkipBack className="h-4 w-4" />
        </Button>

        <Button
          size="icon"
          onClick={handlePlayPause}
          disabled={!wavesurferRef.current}
          className="bg-[#00BFA5] hover:bg-[#00BFA5]/90"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={handleSkipForward}
          disabled={!wavesurferRef.current}
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>

      {/* Volume Control */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleMute}
          className="shrink-0"
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>

        <Slider
          value={[isMuted ? 0 : volume * 100]}
          onValueChange={(value) => {
            setVolume(value[0] / 100);
            if (value[0] > 0 && isMuted) {
              setIsMuted(false);
            }
          }}
          max={100}
          step={1}
          className="flex-1"
        />

        <span className="text-sm text-gray-500 w-12 text-right">
          {Math.round((isMuted ? 0 : volume) * 100)}%
        </span>
      </div>
    </div>
  );
}
