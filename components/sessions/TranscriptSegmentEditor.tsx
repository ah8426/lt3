'use client'

import { useState } from 'react'
import { Segment } from '@/hooks/useSession'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { SegmentEditHistory } from './SegmentEditHistory'
import {
  Edit2,
  Save,
  X,
  Clock,
  User,
  History,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { formatDuration } from '@/lib/utils/format'

interface TranscriptSegmentEditorProps {
  segment: Segment
  onUpdate: (segmentId: string, text: string, originalText: string) => Promise<void>
  onDelete?: (segmentId: string) => Promise<void>
  isUpdating?: boolean
}

export function TranscriptSegmentEditor({
  segment,
  onUpdate,
  onDelete,
  isUpdating = false,
}: TranscriptSegmentEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedText, setEditedText] = useState(segment.text)
  const [showHistory, setShowHistory] = useState(false)

  const handleStartEdit = () => {
    setEditedText(segment.text)
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (editedText.trim() === segment.text.trim()) {
      setIsEditing(false)
      return
    }

    try {
      await onUpdate(segment.id, editedText, segment.text)
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to save segment:', error)
    }
  }

  const handleCancel = () => {
    setEditedText(segment.text)
    setIsEditing(false)
  }

  const handleDelete = async () => {
    if (!onDelete) return

    if (confirm('Are you sure you want to delete this segment?')) {
      try {
        await onDelete(segment.id)
      } catch (error) {
        console.error('Failed to delete segment:', error)
      }
    }
  }

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    if (confidence >= 0.9)
      return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
    if (confidence >= 0.7)
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
    return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
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
    <div className="group p-4 rounded-lg border hover:border-primary transition-colors dark:border-gray-700">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Speaker */}
          {segment.speaker !== undefined && segment.speaker !== null && (
            <Badge variant="outline" className={`${getSpeakerColor(segment.speaker)} border-0`}>
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
            <Badge variant="outline" className={`${getConfidenceColor(segment.confidence)} border-0`}>
              {segment.confidence >= 0.9 ? (
                <CheckCircle2 className="h-3 w-3 mr-1" />
              ) : (
                <AlertCircle className="h-3 w-3 mr-1" />
              )}
              {Math.round(segment.confidence * 100)}%
            </Badge>
          )}

          {/* Final status */}
          {!segment.is_final && (
            <Badge variant="outline" className="text-xs">
              Interim
            </Badge>
          )}
        </div>

        {/* Actions */}
        {!isEditing && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* View history */}
            <Dialog open={showHistory} onOpenChange={setShowHistory}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <History className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Edit History</DialogTitle>
                  <DialogDescription>
                    View all changes made to this transcript segment
                  </DialogDescription>
                </DialogHeader>
                <SegmentEditHistory segmentId={segment.id} />
              </DialogContent>
            </Dialog>

            {/* Edit */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleStartEdit}
              disabled={isUpdating}
            >
              <Edit2 className="h-4 w-4" />
            </Button>

            {/* Delete */}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="min-h-[100px] resize-none"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                handleSave()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                handleCancel()
              }
            }}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={isUpdating}>
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel} disabled={isUpdating}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <span className="text-xs text-muted-foreground self-center ml-2">
              Ctrl/Cmd + Enter to save, Esc to cancel
            </span>
          </div>
        </div>
      ) : (
        <p
          className="text-base leading-relaxed cursor-text"
          onClick={handleStartEdit}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleStartEdit()
            }
          }}
        >
          {segment.text}
        </p>
      )}

      {/* Edit timestamp */}
      {segment.updated_at && segment.updated_at !== segment.created_at && (
        <div className="mt-2 pt-2 border-t dark:border-gray-700">
          <p className="text-xs text-muted-foreground">
            Last edited: {new Date(segment.updated_at).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  )
}
