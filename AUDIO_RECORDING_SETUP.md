# Audio Recording System - Integration Guide

## Overview

Browser-based audio recording system built with RecordRTC for Law Transcribed. Supports multiple audio formats, real-time audio level monitoring, and comprehensive error handling across all major browsers.

## Files Created

### 1. Core Audio Library
**[lib/audio/recorder.ts](lib/audio/recorder.ts)**
- `AudioRecorder` class - Main recording engine using RecordRTC
- `checkBrowserCompatibility()` - Detects browser support and missing features
- `requestMicrophonePermission()` - Handles permission requests with detailed error messages
- `getDefaultQualitySettings()` - Provides optimized audio quality presets
- `getAudioInputDevices()` - Enumerates available microphones
- `createStreamWithDevice()` - Creates audio stream for specific device

### 2. React Hook
**[hooks/useAudioRecorder.ts](hooks/useAudioRecorder.ts)**
- Complete state management for recording lifecycle
- Real-time duration tracking and audio level monitoring
- Device selection and permission handling
- Automatic cleanup and resource management

### 3. UI Component
**[components/dictation/AudioRecorder.tsx](components/dictation/AudioRecorder.tsx)**
- Full-featured recording interface
- Visual feedback with waveform and level meters
- Permission request UI
- Format and device selection
- Error handling and browser compatibility warnings

## Features

### Audio Recording
- ✅ Multiple formats: WebM (smaller) and WAV (better compatibility)
- ✅ Configurable audio quality (sample rate, bitrate, channels)
- ✅ Chunked recording for long sessions
- ✅ Pause/resume capability
- ✅ Accurate duration tracking (handles pauses correctly)

### Audio Monitoring
- ✅ Real-time audio level detection (0-100%)
- ✅ Waveform visualization with animated bars
- ✅ Audio level meter with gradient display
- ✅ Web Audio API integration for analysis

### User Experience
- ✅ Microphone permission handling with clear messaging
- ✅ Device selection (multiple microphones)
- ✅ Browser compatibility detection
- ✅ Comprehensive error messages
- ✅ Mobile-responsive design
- ✅ Law Transcribed branding (#00BFA5 teal)

### Browser Support
- ✅ Chrome (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ❌ Graceful degradation for unsupported browsers

## Quick Start

### Basic Usage

```tsx
import { AudioRecorder } from '@/components/dictation/AudioRecorder';

export default function MyPage() {
  const handleRecordingComplete = (blob: Blob, duration: number) => {
    console.log('Recording complete:', blob, duration);
    // Upload blob to server, process it, etc.
  };

  return (
    <AudioRecorder
      format="webm"
      onRecordingComplete={handleRecordingComplete}
    />
  );
}
```

### Advanced Usage with Custom Hook

```tsx
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { Button } from '@/components/ui/button';

export default function CustomRecorder() {
  const {
    isRecording,
    duration,
    audioLevel,
    startRecording,
    stopRecording,
    formatDuration,
  } = useAudioRecorder({
    format: 'wav',
    timeSlice: 1000, // Chunks every second
    onDataAvailable: (blob) => {
      // Handle chunks for streaming
      console.log('Chunk received:', blob);
    },
  });

  const handleStop = async () => {
    const blob = await stopRecording();
    if (blob) {
      // Process final recording
      console.log('Final blob:', blob);
    }
  };

  return (
    <div>
      <p>Duration: {formatDuration(duration)}</p>
      <p>Audio Level: {audioLevel}%</p>
      {!isRecording ? (
        <Button onClick={startRecording}>Start</Button>
      ) : (
        <Button onClick={handleStop}>Stop</Button>
      )}
    </div>
  );
}
```

## Integration Examples

### 1. Dictation Session Page

```tsx
// app/(app)/sessions/new/page.tsx
'use client';

import { AudioRecorder } from '@/components/dictation/AudioRecorder';
import { useState } from 'react';

export default function NewSessionPage() {
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const handleRecordingComplete = async (blob: Blob, duration: number) => {
    setAudioBlob(blob);

    // Upload to server
    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');
    formData.append('duration', duration.toString());

    const response = await fetch('/api/sessions', {
      method: 'POST',
      body: formData,
    });

    const session = await response.json();
    console.log('Session created:', session);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">New Dictation Session</h1>

      <AudioRecorder
        format="webm"
        onRecordingComplete={handleRecordingComplete}
        showFormatSelector
        showDeviceSelector
      />
    </div>
  );
}
```

### 2. Real-time Transcription with Chunked Recording

```tsx
'use client';

import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useState } from 'react';

export default function RealtimeTranscription() {
  const [transcript, setTranscript] = useState('');

  const { startRecording, stopRecording, isRecording } = useAudioRecorder({
    format: 'webm',
    timeSlice: 2000, // Send chunks every 2 seconds
    onDataAvailable: async (chunk) => {
      // Send chunk to transcription API
      const formData = new FormData();
      formData.append('audio', chunk);

      const response = await fetch('/api/transcribe/stream', {
        method: 'POST',
        body: formData,
      });

      const { text } = await response.json();
      setTranscript((prev) => prev + ' ' + text);
    },
  });

  return (
    <div>
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? 'Stop' : 'Start'} Transcription
      </button>
      <p>{transcript}</p>
    </div>
  );
}
```

### 3. Audio Upload API Route

```typescript
// app/api/sessions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const audioFile = formData.get('audio') as Blob;
  const duration = parseInt(formData.get('duration') as string);

  if (!audioFile) {
    return NextResponse.json({ error: 'No audio file' }, { status: 400 });
  }

  // Convert blob to buffer
  const buffer = Buffer.from(await audioFile.arrayBuffer());

  // Upload to storage (S3, Supabase Storage, etc.)
  const fileName = `sessions/${user.id}/${Date.now()}.webm`;

  // Example with Supabase Storage:
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('audio-recordings')
    .upload(fileName, buffer, {
      contentType: 'audio/webm',
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Create session record in database
  const { data: session, error: dbError } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      audio_url: fileName,
      duration_ms: duration,
      status: 'processing',
    })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ session });
}
```

## Component Props Reference

### AudioRecorder Component

```typescript
interface AudioRecorderProps {
  // Audio format (default: 'webm')
  format?: 'webm' | 'wav';

  // Time interval for chunked recording in ms (optional)
  timeSlice?: number;

  // Callback when recording completes
  onRecordingComplete?: (blob: Blob, duration: number) => void;

  // Callback when recording starts
  onRecordingStart?: () => void;

  // Callback when recording stops
  onRecordingStop?: () => void;

  // Callback for errors
  onError?: (error: string) => void;

  // Show format selector UI (default: false)
  showFormatSelector?: boolean;

  // Show device selector UI (default: true)
  showDeviceSelector?: boolean;

  // Auto-start recording after permission granted (default: false)
  autoStart?: boolean;
}
```

### useAudioRecorder Hook

```typescript
// Options
interface UseAudioRecorderOptions {
  format?: 'webm' | 'wav';
  timeSlice?: number;
  onDataAvailable?: (blob: Blob) => void;
  deviceId?: string;
}

// Return value
interface UseAudioRecorderReturn {
  // State
  isRecording: boolean;
  isPaused: boolean;
  duration: number; // in milliseconds
  audioLevel: number; // 0-100
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
```

## Audio Quality Settings

### Default WebM Settings
```typescript
{
  sampleRate: 48000,
  numberOfAudioChannels: 1, // Mono
  bitrate: 128000 // 128 kbps
}
```

### Default WAV Settings
```typescript
{
  sampleRate: 48000,
  numberOfAudioChannels: 1, // Mono
  desiredSampleRate: 16000, // Downsampled for speech recognition
  bitrate: 128000
}
```

### Custom Quality Settings

```typescript
import { AudioRecorder } from '@/lib/audio/recorder';

const recorder = new AudioRecorder({
  format: 'webm',
  quality: {
    sampleRate: 48000,
    numberOfAudioChannels: 2, // Stereo
    bitrate: 256000, // Higher quality
  },
  onAudioLevel: (level) => console.log('Level:', level),
});
```

## Error Handling

The system provides detailed error messages for common scenarios:

### Permission Errors
- **NotAllowedError**: User denied permission
- **NotFoundError**: No microphone found
- **NotReadableError**: Microphone in use by another app
- **SecurityError**: HTTPS required (blocks on HTTP)

### Browser Compatibility
- Automatically detects missing features
- Shows user-friendly messages
- Recommends compatible browsers

### Example Error Handling

```tsx
<AudioRecorder
  onError={(error) => {
    // Log to monitoring service
    console.error('Recording error:', error);

    // Show toast notification
    toast.error(error);

    // Track analytics
    analytics.track('recording_error', { error });
  }}
/>
```

## Performance Considerations

### File Size Optimization
- **WebM format**: ~1MB per minute (recommended for web)
- **WAV format**: ~10MB per minute (better for processing)
- **Mono vs Stereo**: Mono is half the size, suitable for speech

### Chunked Recording
- Use `timeSlice` for long sessions to avoid memory issues
- Recommended: 2000-5000ms for real-time streaming
- Don't use for short recordings (adds overhead)

### Memory Management
- Recorder automatically cleans up on unmount
- Stop tracks when switching devices
- Close AudioContext when done

## Testing Across Browsers

### Chrome (Recommended)
- ✅ Full support for all features
- ✅ Best WebM encoding
- ✅ Excellent audio level monitoring

### Firefox
- ✅ Full support for all features
- ✅ Good WebM encoding
- ⚠️ May show different device labels

### Safari
- ✅ Full support (iOS 14+, macOS 11+)
- ⚠️ WebM may require fallback to WAV
- ⚠️ Different permission UI

### Edge
- ✅ Full support (Chromium-based)
- ✅ Same as Chrome

### Testing Checklist
```
□ Microphone permission request works
□ Multiple device selection works
□ Audio levels display correctly
□ Recording timer is accurate
□ Pause/resume functions properly
□ Final blob is valid and playable
□ Error messages are user-friendly
□ Mobile devices work correctly
□ HTTPS requirement is enforced
```

## Security Considerations

### HTTPS Requirement
- `getUserMedia()` requires HTTPS in production
- localhost exempt for development
- Handle SecurityError gracefully

### Permission Persistence
- Chrome: Remembers permission per domain
- Safari: May ask each session
- Handle repeated permission requests

### Audio Privacy
- Stop tracks when not recording
- Clear audio data on unmount
- Don't send audio without user consent

## Next Steps

1. **Create session recording page** using AudioRecorder component
2. **Implement audio storage** (S3 or Supabase Storage)
3. **Add transcription integration** (Deepgram, AssemblyAI, etc.)
4. **Build playback component** for reviewing recordings
5. **Add waveform visualization** for editing (WaveSurfer.js already installed)

## Troubleshooting

### "Microphone permission denied"
- User must click "Allow" in browser prompt
- Check browser settings if permission blocked
- Verify HTTPS in production

### "No microphone found"
- Check physical connection
- Verify device shows in system settings
- Try refreshing device list

### "Microphone already in use"
- Close other applications using mic
- Close other browser tabs with microphone access
- Restart browser if needed

### Audio level stuck at 0
- Check microphone is not muted
- Verify correct device is selected
- Test in system audio settings

### Recording fails to start
- Check browser console for errors
- Verify RecordRTC is installed
- Ensure permissions granted

## Dependencies

Already installed in package.json:
- `recordrtc@5.6.2` - Audio recording engine
- `wavesurfer.js@7.8.6` - For future waveform visualization

## Support

For issues or questions:
- Check browser console for detailed errors
- Test in Chrome first (most reliable)
- Verify HTTPS in production environments
- Review browser compatibility table above
