'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useTranscription } from '@/hooks/useTranscription';
import { AudioRecorder } from '@/components/dictation/AudioRecorder';
import { TranscriptView } from '@/components/dictation/TranscriptView';
import { SessionControls } from '@/components/dictation/SessionControls';
import { WaveformVisualizer } from '@/components/dictation/WaveformVisualizer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMatters } from '@/hooks/useMatters';
import { AlertCircle, Mic, FileText, Waves, CheckCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface SessionMetadata {
  id: string;
  matterId?: string;
  title: string;
  startTime: Date;
  duration: number;
  status: 'recording' | 'paused' | 'stopped';
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function DictationPage() {
  const searchParams = useSearchParams();
  const initialMatterId = searchParams.get('matterId');

  // Session state
  const [sessionId] = useState(() => crypto.randomUUID());
  const [sessionMetadata, setSessionMetadata] = useState<SessionMetadata>({
    id: sessionId,
    matterId: initialMatterId || undefined,
    title: `Dictation ${format(new Date(), 'MM/dd/yyyy HH:mm')}`,
    startTime: new Date(),
    duration: 0,
    status: 'stopped',
  });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [autoSaveInterval, setAutoSaveInterval] = useState<NodeJS.Timeout | null>(null);

  // Matters for session association
  const { data: matters } = useMatters();

  // Audio recorder
  const {
    isRecording,
    isPaused,
    duration,
    audioLevel,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    formatDuration,
  } = useAudioRecorder({
    format: 'webm',
    timeSlice: 250, // Send audio chunks every 250ms
    onDataAvailable: async (blob) => {
      // Send audio to transcription
      if (isTranscribing) {
        const arrayBuffer = await blob.arrayBuffer();
        await sendAudio(arrayBuffer);
      }
    },
  });

  // Transcription
  const {
    isTranscribing,
    segments,
    currentText,
    error: transcriptionError,
    currentProvider,
    metrics,
    startTranscription,
    stopTranscription,
    sendAudio,
    getFullTranscript,
  } = useTranscription({
    sessionId,
    onProviderSwitch: (from, to) => {
      console.log(`ASR provider switched: ${from} → ${to}`);
    },
  });

  // Update session metadata
  useEffect(() => {
    setSessionMetadata((prev) => ({
      ...prev,
      duration,
      status: isRecording ? (isPaused ? 'paused' : 'recording') : 'stopped',
    }));
  }, [isRecording, isPaused, duration]);

  // Auto-save setup
  useEffect(() => {
    if (isRecording && !isPaused) {
      // Save every 30 seconds
      const interval = setInterval(() => {
        handleAutoSave();
      }, 30000);

      setAutoSaveInterval(interval);

      return () => {
        clearInterval(interval);
      };
    } else if (autoSaveInterval) {
      clearInterval(autoSaveInterval);
      setAutoSaveInterval(null);
    }
  }, [isRecording, isPaused]);

  // Save on pause or stop
  useEffect(() => {
    if ((isPaused || !isRecording) && segments.length > 0) {
      handleAutoSave();
    }
  }, [isPaused, isRecording]);

  /**
   * Start recording and transcription
   */
  const handleStart = async () => {
    try {
      await startTranscription();
      await startRecording();
    } catch (error) {
      console.error('Failed to start:', error);
    }
  };

  /**
   * Pause recording
   */
  const handlePause = () => {
    pauseRecording();
    // Transcription continues to process queued audio
  };

  /**
   * Resume recording
   */
  const handleResume = async () => {
    resumeRecording();
  };

  /**
   * Stop recording and transcription
   */
  const handleStop = async () => {
    try {
      const blob = await stopRecording();
      if (blob) {
        setAudioBlob(blob);
      }
      await stopTranscription();
      await handleSave(blob);
    } catch (error) {
      console.error('Failed to stop:', error);
    }
  };

  /**
   * Auto-save progress
   */
  const handleAutoSave = async () => {
    if (segments.length === 0) return;

    setSaveStatus('saving');

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: sessionId,
          matter_id: sessionMetadata.matterId,
          title: sessionMetadata.title,
          transcript: getFullTranscript(),
          duration_ms: duration,
          status: sessionMetadata.status,
          segments: segments.map((s) => ({
            text: s.text,
            speaker: s.speaker,
            confidence: s.confidence,
            start_time: s.startTime,
            end_time: s.endTime,
            is_final: s.isFinal,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Auto-save failed');
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Auto-save error:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  /**
   * Save session with audio
   */
  const handleSave = async (blob?: Blob | null) => {
    setSaveStatus('saving');

    try {
      const formData = new FormData();
      formData.append('id', sessionId);
      if (sessionMetadata.matterId) {
        formData.append('matter_id', sessionMetadata.matterId);
      }
      formData.append('title', sessionMetadata.title);
      formData.append('transcript', getFullTranscript());
      formData.append('duration_ms', duration.toString());
      formData.append('status', 'completed');

      if (blob || audioBlob) {
        formData.append('audio', (blob || audioBlob)!, 'recording.webm');
      }

      // Add segments
      formData.append(
        'segments',
        JSON.stringify(
          segments
            .filter((s) => s.isFinal)
            .map((s) => ({
              text: s.text,
              speaker: s.speaker,
              confidence: s.confidence,
              start_time: s.startTime,
              end_time: s.endTime,
              is_final: s.isFinal,
            }))
        )
      );

      const response = await fetch('/api/sessions', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Save failed');
      }

      setSaveStatus('saved');
    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('error');
    }
  };

  /**
   * Export session
   */
  const handleExport = async (format: 'txt' | 'docx' | 'pdf') => {
    // Implementation in SessionControls component
    console.log('Export as:', format);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="border-b dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Dictation Session
            </h1>
            <div className="flex items-center gap-4 flex-wrap">
              {/* Matter Selection */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 dark:text-gray-400">Matter:</label>
                <Select
                  value={sessionMetadata.matterId || 'none'}
                  onValueChange={(value) =>
                    setSessionMetadata((prev) => ({
                      ...prev,
                      matterId: value === 'none' ? undefined : value,
                    }))
                  }
                  disabled={isRecording}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select matter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No matter</SelectItem>
                    {matters?.matters.map((matter) => (
                      <SelectItem key={matter.id} value={matter.id}>
                        {matter.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Session Info */}
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>{format(sessionMetadata.startTime, 'MMM d, yyyy h:mm a')}</span>
                <span>•</span>
                <span className="font-mono font-bold text-gray-900 dark:text-white">
                  {formatDuration(duration)}
                </span>
                {currentProvider && (
                  <>
                    <span>•</span>
                    <Badge variant="outline">{currentProvider}</Badge>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Save Status */}
          <div className="flex items-center gap-2">
            {saveStatus === 'saving' && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </div>
            )}
            {saveStatus === 'saved' && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>Saved</span>
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>Save failed</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 h-full">
          {/* Left Column: Recording Controls */}
          <div className="space-y-6 overflow-y-auto">
            {/* Errors */}
            {transcriptionError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{transcriptionError}</AlertDescription>
              </Alert>
            )}

            {/* Session Controls */}
            <SessionControls
              isRecording={isRecording}
              isPaused={isPaused}
              onStart={handleStart}
              onPause={handlePause}
              onResume={handleResume}
              onStop={handleStop}
              onSave={() => handleSave()}
              onExport={handleExport}
              saveStatus={saveStatus}
              canSave={segments.length > 0}
            />

            {/* Audio Recorder Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5 text-[#00BFA5]" />
                  Audio Recorder
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="controls" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="controls">Controls</TabsTrigger>
                    <TabsTrigger value="waveform">Waveform</TabsTrigger>
                  </TabsList>

                  <TabsContent value="controls" className="mt-4">
                    <div className="space-y-4">
                      {/* Duration Display */}
                      <div className="text-center">
                        <div className="text-4xl font-mono font-bold text-gray-900 dark:text-white">
                          {formatDuration(duration)}
                        </div>
                        {isRecording && (
                          <div className="mt-2">
                            <Badge
                              variant="outline"
                              className={
                                isPaused
                                  ? 'border-yellow-500 text-yellow-600'
                                  : 'border-red-500 text-red-600'
                              }
                            >
                              {isPaused ? 'Paused' : 'Recording'}
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* Audio Level */}
                      {isRecording && !isPaused && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>Audio Level</span>
                            <span>{audioLevel}%</span>
                          </div>
                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#00BFA5] to-teal-600 transition-all duration-100"
                              style={{ width: `${Math.min(audioLevel, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Metrics */}
                      {metrics && (
                        <div className="pt-4 border-t dark:border-gray-700">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-gray-500">Provider</div>
                              <div className="font-medium">{metrics.provider}</div>
                            </div>
                            <div>
                              <div className="text-gray-500">Cost</div>
                              <div className="font-medium">${metrics.cost.toFixed(4)}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="waveform" className="mt-4">
                    <WaveformVisualizer
                      audioBlob={audioBlob}
                      isRecording={isRecording}
                      audioLevel={audioLevel}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Transcript */}
          <div className="overflow-hidden">
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#00BFA5]" />
                  Live Transcript
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <TranscriptView
                  segments={segments}
                  currentText={currentText}
                  isTranscribing={isTranscribing}
                  sessionId={sessionId}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
