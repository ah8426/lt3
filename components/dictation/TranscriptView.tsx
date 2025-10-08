'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Edit2, Check, X, User, Clock, Filter, BarChart3, Shield, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { SpeakerLabel } from '@/components/speakers/SpeakerLabel';
import { useSpeakers, Speaker } from '@/hooks/useSpeakers';
import { useRedaction } from '@/hooks/useRedaction';
import { RedactionEditor } from '@/components/redaction/RedactionEditor';
import { RedactionHighlight } from '@/components/redaction/RedactionHighlight';
import { PIIType } from '@/lib/redaction/pii-detector';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface TranscriptionSegment {
  text: string;
  speaker?: number;
  confidence: number;
  startTime: number;
  endTime: number;
  isFinal: boolean;
}

interface TranscriptViewProps {
  segments: TranscriptionSegment[];
  currentText: string;
  isTranscribing: boolean;
  sessionId: string;
}

interface EditingSegment {
  index: number;
  text: string;
}

export function TranscriptView({
  segments,
  currentText,
  isTranscribing,
  sessionId,
}: TranscriptViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingSegment, setEditingSegment] = useState<EditingSegment | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('all');
  const [showTimeline, setShowTimeline] = useState(false);
  const [showRedactionEditor, setShowRedactionEditor] = useState(false);
  const [selectedTextForRedaction, setSelectedTextForRedaction] = useState<{
    text: string;
    start: number;
    end: number;
  } | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const latestSegmentRef = useRef<HTMLDivElement>(null);

  // Fetch speakers
  const { speakers, stats, isLoading: speakersLoading } = useSpeakers({
    sessionId,
    includeStats: true,
  });

  // Fetch redactions
  const {
    redactions,
    isLoading: redactionsLoading,
    createRedaction,
    unredact,
    detectPII,
  } = useRedaction({ sessionId });

  // Auto-scroll to latest segment
  useEffect(() => {
    if (isTranscribing && latestSegmentRef.current) {
      latestSegmentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      });
    }
  }, [segments.length, isTranscribing]);

  // Get speaker by number
  const getSpeakerByNumber = (speakerNumber?: number): Speaker | undefined => {
    if (speakerNumber === undefined) return undefined;
    return speakers.find((s) => s.speakerNumber === speakerNumber);
  };

  // Filter segments based on search and speaker
  const filteredSegments = useMemo(() => {
    let filtered = segments.map((segment, index) => ({ segment, index }));

    // Filter by speaker
    if (selectedSpeaker !== 'all') {
      const speakerNum = parseInt(selectedSpeaker);
      filtered = filtered.filter(({ segment }) => segment.speaker === speakerNum);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(({ segment }) =>
        segment.text.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [segments, searchQuery, selectedSpeaker]);

  // Calculate speaker timeline data
  const timelineData = useMemo(() => {
    if (!showTimeline || segments.length === 0) return [];

    const totalDuration = Math.max(...segments.map((s) => s.endTime));

    return segments.map((segment, index) => ({
      index,
      speaker: segment.speaker,
      startPercent: (segment.startTime / totalDuration) * 100,
      widthPercent: ((segment.endTime - segment.startTime) / totalDuration) * 100,
    }));
  }, [segments, showTimeline]);

  /**
   * Start editing a segment
   */
  const handleStartEdit = (index: number, text: string) => {
    setEditingSegment({ index, text });
  };

  /**
   * Save edited segment
   */
  const handleSaveEdit = async () => {
    if (!editingSegment) return;

    try {
      // Update segment in database
      await fetch(`/api/sessions/${sessionId}/segments`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          index: editingSegment.index,
          text: editingSegment.text,
        }),
      });

      // Update local state (this would be better with global state management)
      segments[editingSegment.index].text = editingSegment.text;

      setEditingSegment(null);
    } catch (error) {
      console.error('Failed to save edit:', error);
    }
  };

  /**
   * Cancel editing
   */
  const handleCancelEdit = () => {
    setEditingSegment(null);
  };

  /**
   * Format timestamp
   */
  const formatTimestamp = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }

    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  /**
   * Get speaker border color for highlighting
   */
  const getSpeakerBorderColor = (speakerNumber?: number): string => {
    if (speakerNumber === undefined) return '';

    const speaker = getSpeakerByNumber(speakerNumber);
    if (speaker?.color) {
      return `border-l-4 border-l-[${speaker.color}]`;
    }

    const colors = [
      'border-l-4 border-l-blue-500',
      'border-l-4 border-l-green-500',
      'border-l-4 border-l-purple-500',
      'border-l-4 border-l-orange-500',
      'border-l-4 border-l-pink-500',
    ];

    return colors[speakerNumber % colors.length];
  };

  /**
   * Get unique speakers in transcript
   */
  const uniqueSpeakers = useMemo(() => {
    const speakerSet = new Set<number>();
    segments.forEach((seg) => {
      if (seg.speaker !== undefined) speakerSet.add(seg.speaker);
    });
    return Array.from(speakerSet).sort((a, b) => a - b);
  }, [segments]);

  /**
   * Handle text selection for redaction
   */
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.toString().trim().length === 0) {
      setSelectedTextForRedaction(null);
      return;
    }

    const selectedText = selection.toString();
    // In a real implementation, you'd calculate the actual offset in the full transcript
    // For now, we'll use a simplified approach
    setSelectedTextForRedaction({
      text: selectedText,
      start: 0, // Would calculate actual position
      end: selectedText.length,
    });
  };

  /**
   * Handle redaction from context menu
   */
  const handleRedactSelection = () => {
    if (selectedTextForRedaction) {
      setShowRedactionEditor(true);
    }
  };

  /**
   * Handle saving redaction
   */
  const handleSaveRedaction = async (params: {
    originalText: string;
    redactedText: string;
    piiType: PIIType;
    startOffset: number;
    endOffset: number;
    reason?: string;
    legalBasis?: string;
    accessControl?: string[];
  }) => {
    await createRedaction(params);
    setSelectedTextForRedaction(null);
  };

  /**
   * Apply redactions to text
   */
  const applyRedactionsToText = (text: string, segmentIndex: number): React.ReactNode => {
    // Find redactions for this segment
    const segmentRedactions = redactions.filter(
      (r) => r.segmentId === segments[segmentIndex]?.text // Simplified - would use actual segment ID
    );

    if (segmentRedactions.length === 0) {
      return text;
    }

    // Sort redactions by start offset
    const sorted = [...segmentRedactions].sort((a, b) => a.startOffset - b.startOffset);

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    sorted.forEach((redaction, idx) => {
      // Add text before redaction
      if (redaction.startOffset > lastIndex) {
        parts.push(
          <span key={`text-${idx}`}>{text.substring(lastIndex, redaction.startOffset)}</span>
        );
      }

      // Add redaction highlight
      parts.push(
        <RedactionHighlight
          key={`redaction-${redaction.id}`}
          redaction={redaction}
          canUnredact={true}
          onUnredact={unredact}
          variant="inline"
        />
      );

      lastIndex = redaction.endOffset;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(<span key="text-end">{text.substring(lastIndex)}</span>);
    }

    return <>{parts}</>;
  };

  /**
   * Export transcript (with option for redacted/unredacted)
   */
  const handleExportText = (includeRedactions: boolean = true) => {
    const text = segments
      .filter((s) => s.isFinal)
      .map((s) => {
        let segmentText = s.text;

        // Apply redactions if requested
        if (includeRedactions) {
          const segmentRedactions = redactions.filter(
            (r) => r.segmentId === s.text // Simplified
          );

          // Apply redactions from end to beginning to preserve offsets
          const sorted = [...segmentRedactions].sort((a, b) => b.startOffset - a.startOffset);
          sorted.forEach((r) => {
            segmentText =
              segmentText.substring(0, r.startOffset) +
              r.redactedText +
              segmentText.substring(r.endOffset);
          });
        }

        if (s.speaker !== undefined) {
          const speaker = getSpeakerByNumber(s.speaker);
          const speakerName = speaker?.name || `Speaker ${s.speaker + 1}`;
          const role = speaker?.role ? ` (${speaker.role})` : '';
          return `${speakerName}${role}: ${segmentText}`;
        }
        return segmentText;
      })
      .join('\n\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${sessionId}${includeRedactions ? '-redacted' : ''}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Show empty state
  if (segments.length === 0 && !isTranscribing) {
    return (
      <div className="h-full flex items-center justify-center text-center">
        <div className="max-w-md">
          <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
            <Search className="h-full w-full" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No transcript yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Start recording to see the live transcript appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Search and Filter Bar */}
      <div className="mb-4 space-y-2">
        <div className="flex gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search transcript..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Speaker Filter */}
          {uniqueSpeakers.length > 0 && (
            <Select value={selectedSpeaker} onValueChange={setSelectedSpeaker}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Speakers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Speakers</SelectItem>
                {uniqueSpeakers.map((speakerNum) => {
                  const speaker = getSpeakerByNumber(speakerNum);
                  const displayName = speaker?.name || `Speaker ${speakerNum + 1}`;
                  return (
                    <SelectItem key={speakerNum} value={speakerNum.toString()}>
                      {displayName}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}

          {/* Timeline Toggle */}
          {uniqueSpeakers.length > 0 && (
            <Button
              variant={showTimeline ? 'default' : 'outline'}
              size="icon"
              onClick={() => setShowTimeline(!showTimeline)}
              title="Toggle speaker timeline"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Filter status */}
        {(searchQuery || selectedSpeaker !== 'all') && (
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              {filteredSegments.length} result{filteredSegments.length !== 1 ? 's' : ''}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedSpeaker('all');
              }}
              className="h-auto py-1"
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* Speaker Timeline */}
      {showTimeline && timelineData.length > 0 && (
        <div className="mb-4 p-4 border rounded-lg dark:border-gray-700">
          <h4 className="text-sm font-medium mb-3">Speaker Timeline</h4>
          <div className="relative h-12 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
            {timelineData.map(({ index, speaker, startPercent, widthPercent }) => {
              const speakerData = getSpeakerByNumber(speaker);
              const color = speakerData?.color || '#3B82F6';
              const displayName = speakerData?.name || (speaker !== undefined ? `Speaker ${speaker + 1}` : 'Unknown');

              return (
                <div
                  key={index}
                  className="absolute h-full cursor-pointer hover:opacity-80 transition-opacity"
                  style={{
                    left: `${startPercent}%`,
                    width: `${widthPercent}%`,
                    backgroundColor: color,
                  }}
                  title={displayName}
                  onClick={() => {
                    setHighlightedIndex(index);
                    // Scroll to segment
                    const element = document.querySelector(`[data-segment-index="${index}"]`);
                    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                />
              );
            })}
          </div>
          {/* Timeline legend */}
          <div className="flex flex-wrap gap-3 mt-3">
            {uniqueSpeakers.map((speakerNum) => {
              const speaker = getSpeakerByNumber(speakerNum);
              const color = speaker?.color || '#3B82F6';
              const displayName = speaker?.name || `Speaker ${speakerNum + 1}`;
              const stat = stats?.find((s) => s.speakerNumber === speakerNum);

              return (
                <div key={speakerNum} className="flex items-center gap-2 text-xs">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    {displayName}
                  </span>
                  {stat && (
                    <span className="text-gray-500">
                      ({stat.totalSegments} segments)
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transcript */}
      <ScrollArea ref={scrollAreaRef} className="flex-1">
        <div className="space-y-4 pr-4">
          {filteredSegments.map(({ segment, index }, i) => {
            const isEditing = editingSegment?.index === index;
            const isHighlighted = highlightedIndex === index;
            const isLatest = i === filteredSegments.length - 1 && isTranscribing;

            return (
              <div
                key={index}
                ref={isLatest ? latestSegmentRef : undefined}
                data-segment-index={index}
                className={`group relative p-4 rounded-lg border transition-colors ${
                  getSpeakerBorderColor(segment.speaker)
                } ${
                  isHighlighted
                    ? 'border-[#00BFA5] bg-teal-50 dark:bg-teal-900/20'
                    : segment.isFinal
                    ? 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    : 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'
                }`}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseLeave={() => setHighlightedIndex(null)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {/* Speaker Label */}
                    {segment.speaker !== undefined && (
                      <SpeakerLabel
                        speaker={getSpeakerByNumber(segment.speaker)}
                        speakerNumber={segment.speaker}
                        variant="badge"
                        size="sm"
                        onClick={() => {
                          // Filter by this speaker
                          setSelectedSpeaker(segment.speaker!.toString());
                        }}
                      />
                    )}

                    {/* Timestamp */}
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      <span>{formatTimestamp(segment.startTime)}</span>
                    </div>

                    {/* Confidence */}
                    {segment.isFinal && (
                      <Badge
                        variant="outline"
                        className={
                          segment.confidence >= 0.9
                            ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-300'
                            : segment.confidence >= 0.7
                            ? 'border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-300'
                            : 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-300'
                        }
                      >
                        {Math.round(segment.confidence * 100)}%
                      </Badge>
                    )}

                    {/* Interim Badge */}
                    {!segment.isFinal && (
                      <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                        Interim
                      </Badge>
                    )}
                  </div>

                  {/* Edit Button */}
                  {segment.isFinal && !isEditing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                      onClick={() => handleStartEdit(index, segment.text)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Text Content */}
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={editingSegment.text}
                      onChange={(e) =>
                        setEditingSegment({ ...editingSegment, text: e.target.value })
                      }
                      className="w-full"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) {
                          handleSaveEdit();
                        } else if (e.key === 'Escape') {
                          handleCancelEdit();
                        }
                      }}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        className="bg-[#00BFA5] hover:bg-[#00BFA5]/90"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <p
                        className={`text-base leading-relaxed cursor-text select-text ${
                          segment.isFinal
                            ? 'text-gray-900 dark:text-white'
                            : 'text-gray-600 dark:text-gray-400 italic'
                        }`}
                        onMouseUp={handleTextSelection}
                      >
                        {applyRedactionsToText(segment.text, index)}
                      </p>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => handleStartEdit(index, segment.text)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit Text
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onClick={handleRedactSelection}
                        disabled={!selectedTextForRedaction}
                      >
                        <Lock className="h-4 w-4 mr-2" />
                        Redact Selected Text
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={async () => {
                          const matches = await detectPII({
                            text: segment.text,
                            options: { minConfidence: 0.75 },
                          });
                          if (matches.length > 0) {
                            // Show first match in redaction editor
                            setSelectedTextForRedaction({
                              text: matches[0].text,
                              start: matches[0].start,
                              end: matches[0].end,
                            });
                            setShowRedactionEditor(true);
                          }
                        }}
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        Auto-Detect PII
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                )}
              </div>
            );
          })}

          {/* Current/Interim Text */}
          {isTranscribing && currentText && (
            <div className="p-4 rounded-lg border border-dashed border-[#00BFA5] bg-teal-50 dark:bg-teal-900/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-2 w-2 rounded-full bg-[#00BFA5] animate-pulse" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Transcribing...
                </span>
              </div>
              <p className="text-base text-gray-700 dark:text-gray-300 italic">
                {currentText}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="mt-4 pt-4 border-t dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {segments.filter((s) => s.isFinal).length} segments
          </span>
          {redactions.length > 0 && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Lock className="h-3 w-3" />
              {redactions.length} redaction{redactions.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Export as Text
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExportText(true)}>
                <Lock className="h-4 w-4 mr-2" />
                Export with Redactions
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportText(false)}>
                <Shield className="h-4 w-4 mr-2" />
                Export Original (Unredacted)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Redaction Editor */}
      <RedactionEditor
        isOpen={showRedactionEditor}
        onClose={() => {
          setShowRedactionEditor(false);
          setSelectedTextForRedaction(null);
        }}
        onSave={handleSaveRedaction}
        selectedText={selectedTextForRedaction?.text}
        startOffset={selectedTextForRedaction?.start || 0}
        endOffset={selectedTextForRedaction?.end || 0}
      />
    </div>
  );
}
