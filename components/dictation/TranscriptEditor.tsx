'use client'

import { useEffect, useRef, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Sparkles, User, Clock } from 'lucide-react'
import { formatDuration } from '@/lib/utils/format'

interface Segment {
  id: string
  text: string
  start_time: number
  end_time?: number
  speaker?: number
  confidence?: number
  is_final: boolean
  isAiGenerated?: boolean
}

interface TranscriptEditorProps {
  segments: Segment[]
  onSegmentsChange?: (segments: Segment[]) => void
  isRecording?: boolean
  editable?: boolean
  onCursorChange?: (position: number) => void
  renderSegment?: (segment: Segment) => React.ReactNode
}

export function TranscriptEditor({
  segments,
  onSegmentsChange,
  isRecording = false,
  editable = true,
  onCursorChange,
  renderSegment,
}: TranscriptEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new segments arrive
  useEffect(() => {
    if (isRecording && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [segments.length, isRecording])

  // Track cursor position
  useEffect(() => {
    const handleSelectionChange = () => {
      if (textareaRef.current && onCursorChange) {
        const position = textareaRef.current.selectionStart
        onCursorChange(position)
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [onCursorChange])

  const handleEdit = (segment: Segment) => {
    setEditingId(segment.id)
    setEditText(segment.text)
  }

  const handleSave = () => {
    if (!editingId || !onSegmentsChange) return

    const updatedSegments = segments.map((seg) =>
      seg.id === editingId ? { ...seg, text: editText } : seg
    )

    onSegmentsChange(updatedSegments)
    setEditingId(null)
    setEditText('')
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditText('')
  }

  const getSpeakerColor = (speaker?: number) => {
    if (speaker === undefined) return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'

    const colors = [
      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    ]

    return colors[speaker % colors.length]
  }

  return (
    <ScrollArea className="h-full" ref={scrollRef}>
      <div className="p-4 space-y-3">
        {segments.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            <p>
              {isRecording
                ? 'Listening... Start speaking to see your transcript here.'
                : 'No transcript yet. Start recording to begin.'}
            </p>
          </div>
        )}

        {segments.map((segment) => (
          <div
            key={segment.id}
            className={`group p-3 rounded-lg border transition-colors ${
              segment.isAiGenerated
                ? 'border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-950/20'
                : 'border-border hover:border-primary'
            } ${!segment.is_final ? 'opacity-60' : ''}`}
          >
            {/* Segment header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                {/* AI Generated badge */}
                {segment.isAiGenerated && (
                  <Badge variant="secondary" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI Generated
                  </Badge>
                )}

                {/* Speaker badge */}
                {segment.speaker !== undefined && segment.speaker !== null && (
                  <Badge variant="outline" className={`${getSpeakerColor(segment.speaker)} border-0 text-xs`}>
                    <User className="h-3 w-3 mr-1" />
                    Speaker {segment.speaker}
                  </Badge>
                )}

                {/* Timestamp */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatDuration(segment.start_time)}</span>
                  {segment.end_time && (
                    <>
                      <span>-</span>
                      <span>{formatDuration(segment.end_time)}</span>
                    </>
                  )}
                </div>

                {/* Confidence */}
                {segment.confidence !== undefined && segment.confidence !== null && (
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      segment.confidence >= 0.9
                        ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-300'
                        : segment.confidence >= 0.7
                        ? 'border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-300'
                        : 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-300'
                    }`}
                  >
                    {Math.round(segment.confidence * 100)}%
                  </Badge>
                )}

                {/* Interim badge */}
                {!segment.is_final && (
                  <Badge variant="outline" className="text-xs">
                    Interim
                  </Badge>
                )}
              </div>

              {/* Edit button */}
              {editable && !isRecording && editingId !== segment.id && (
                <button
                  onClick={() => handleEdit(segment)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground hover:text-foreground"
                >
                  Edit
                </button>
              )}
            </div>

            {/* Segment content */}
            {editingId === segment.id ? (
              <div className="space-y-2">
                <Textarea
                  ref={textareaRef}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="min-h-[100px]"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-3 py-1 text-sm bg-muted rounded hover:bg-muted/80"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : renderSegment ? (
              renderSegment(segment)
            ) : (
              <p className="text-base leading-relaxed whitespace-pre-wrap">
                {segment.text}
              </p>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
