'use client'

import { useState, useRef, useCallback } from 'react'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { TranscriptEditor } from './TranscriptEditor'
import { Badge } from '@/components/ui/badge'
import { Sparkles } from 'lucide-react'

interface Segment {
  id: string
  text: string
  start_time: number
  end_time?: number
  speaker?: number
  confidence?: number
  is_final: boolean
  isAiGenerated?: boolean // New field to track AI-generated content
}

interface DictationWithChatProps {
  segments: Segment[]
  onSegmentsChange: (segments: Segment[]) => void
  isRecording?: boolean
}

/**
 * Enhanced dictation interface with integrated AI chat
 * This component wraps the transcript editor and provides AI chat capabilities
 */
export function DictationWithChat({
  segments,
  onSegmentsChange,
  isRecording = false,
}: DictationWithChatProps) {
  const [cursorPosition, setCursorPosition] = useState<number | null>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)

  // Get full transcript for chat context
  const fullTranscript = segments.map((s) => s.text).join('\n\n')

  /**
   * Insert AI-generated text into transcript
   */
  const handleInsertToTranscript = useCallback(
    (text: string) => {
      // If we have a cursor position, insert at that position
      if (cursorPosition !== null && cursorPosition >= 0) {
        insertAtPosition(text, cursorPosition)
      } else {
        // Otherwise, append at the end
        appendToEnd(text)
      }
    },
    [cursorPosition, segments]
  )

  /**
   * Insert text at a specific position
   */
  const insertAtPosition = (text: string, position: number) => {
    // Find which segment contains this position
    let charCount = 0
    let targetSegmentIndex = -1
    let positionInSegment = 0

    for (let i = 0; i < segments.length; i++) {
      const segmentLength = segments[i].text.length + 2 // +2 for \n\n
      if (charCount + segmentLength > position) {
        targetSegmentIndex = i
        positionInSegment = position - charCount
        break
      }
      charCount += segmentLength
    }

    if (targetSegmentIndex >= 0) {
      // Insert within existing segment
      const segment = segments[targetSegmentIndex]
      const before = segment.text.substring(0, positionInSegment)
      const after = segment.text.substring(positionInSegment)

      const updatedSegments = [...segments]

      // Update the target segment with before text
      updatedSegments[targetSegmentIndex] = {
        ...segment,
        text: before,
      }

      // Create new AI-generated segment
      const newSegment: Segment = {
        id: crypto.randomUUID(),
        text: text,
        start_time: segment.start_time,
        end_time: segment.end_time,
        is_final: true,
        isAiGenerated: true, // Mark as AI-generated
      }

      // Create segment with remaining text
      const afterSegment: Segment = {
        id: crypto.randomUUID(),
        text: after,
        start_time: segment.end_time || segment.start_time,
        is_final: true,
      }

      // Insert new segments
      updatedSegments.splice(targetSegmentIndex + 1, 0, newSegment)
      if (after.trim()) {
        updatedSegments.splice(targetSegmentIndex + 2, 0, afterSegment)
      }

      onSegmentsChange(updatedSegments)
    } else {
      // Position is beyond all segments, append
      appendToEnd(text)
    }
  }

  /**
   * Append text to the end of transcript
   */
  const appendToEnd = (text: string) => {
    const lastSegment = segments[segments.length - 1]
    const newSegment: Segment = {
      id: crypto.randomUUID(),
      text: text,
      start_time: lastSegment?.end_time || lastSegment?.start_time || 0,
      is_final: true,
      isAiGenerated: true, // Mark as AI-generated
    }

    onSegmentsChange([...segments, newSegment])
  }

  /**
   * Handle cursor position change in editor
   */
  const handleCursorChange = (position: number) => {
    setCursorPosition(position)
  }

  return (
    <div className="relative h-full">
      {/* Transcript Editor */}
      <div className="h-full">
        <TranscriptEditor
          segments={segments}
          onSegmentsChange={onSegmentsChange}
          isRecording={isRecording}
          onCursorChange={handleCursorChange}
          renderSegment={(segment) => (
            <div className="relative">
              {segment.isAiGenerated && (
                <Badge
                  variant="secondary"
                  className="absolute -top-2 -right-2 text-xs"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI
                </Badge>
              )}
              <span>{segment.text}</span>
            </div>
          )}
        />
      </div>

      {/* Chat Panel (floating) */}
      <ChatPanel
        transcript={fullTranscript}
        segments={segments}
        onInsertToTranscript={handleInsertToTranscript}
      />
    </div>
  )
}
