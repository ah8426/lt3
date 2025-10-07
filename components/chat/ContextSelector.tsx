'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown, FileText, Check } from 'lucide-react'
import { formatDuration } from '@/lib/utils/format'

interface ContextSelectorProps {
  transcript: string
  segments: Array<{ id: string; text: string; start_time: number }>
  includeContext: boolean
  onIncludeContextChange: (include: boolean) => void
  selectedSegments: string[]
  onSelectedSegmentsChange: (segments: string[]) => void
}

export function ContextSelector({
  transcript,
  segments,
  includeContext,
  onIncludeContextChange,
  selectedSegments,
  onSelectedSegmentsChange,
}: ContextSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [contextMode, setContextMode] = useState<'full' | 'last' | 'custom'>('full')
  const [lastN, setLastN] = useState('5')

  const handleContextModeChange = (mode: 'full' | 'last' | 'custom') => {
    setContextMode(mode)

    if (mode === 'full') {
      // Clear selection, will use full transcript
      onSelectedSegmentsChange([])
    } else if (mode === 'last') {
      // Select last N segments
      const n = parseInt(lastN) || 5
      const lastSegments = segments.slice(-n).map((s) => s.id)
      onSelectedSegmentsChange(lastSegments)
    }
  }

  const handleSegmentToggle = (segmentId: string) => {
    if (selectedSegments.includes(segmentId)) {
      onSelectedSegmentsChange(selectedSegments.filter((id) => id !== segmentId))
    } else {
      onSelectedSegmentsChange([...selectedSegments, segmentId])
    }
  }

  const handleSelectAll = () => {
    onSelectedSegmentsChange(segments.map((s) => s.id))
  }

  const handleSelectNone = () => {
    onSelectedSegmentsChange([])
  }

  const wordCount = transcript.split(/\s+/).filter(Boolean).length
  const selectedText =
    contextMode === 'full'
      ? transcript
      : segments
          .filter((s) => selectedSegments.includes(s.id))
          .map((s) => s.text)
          .join('\n\n')
  const selectedWordCount = selectedText.split(/\s+/).filter(Boolean).length

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            id="include-context"
            checked={includeContext}
            onCheckedChange={(checked) => onIncludeContextChange(checked as boolean)}
          />
          <Label
            htmlFor="include-context"
            className="text-sm cursor-pointer flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Include transcript context
          </Label>
        </div>

        {includeContext && (
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </Button>
          </CollapsibleTrigger>
        )}
      </div>

      <CollapsibleContent className="mt-2 space-y-2">
        {/* Context mode selector */}
        <div className="flex gap-2">
          <Button
            variant={contextMode === 'full' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleContextModeChange('full')}
            className="flex-1"
          >
            Full transcript
          </Button>
          <Button
            variant={contextMode === 'last' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleContextModeChange('last')}
            className="flex-1"
          >
            Last N
          </Button>
          <Button
            variant={contextMode === 'custom' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleContextModeChange('custom')}
            className="flex-1"
          >
            Custom
          </Button>
        </div>

        {/* Last N selector */}
        {contextMode === 'last' && (
          <div className="flex items-center gap-2">
            <Label htmlFor="last-n" className="text-xs">
              Last
            </Label>
            <Select
              value={lastN}
              onValueChange={(value) => {
                setLastN(value)
                const n = parseInt(value) || 5
                const lastSegments = segments.slice(-n).map((s) => s.id)
                onSelectedSegmentsChange(lastSegments)
              }}
            >
              <SelectTrigger id="last-n" className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
              </SelectContent>
            </Select>
            <Label className="text-xs">segments</Label>
          </div>
        )}

        {/* Custom segment selector */}
        {contextMode === 'custom' && segments.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {selectedSegments.length} of {segments.length} selected
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={handleSelectAll}
                >
                  All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={handleSelectNone}
                >
                  None
                </Button>
              </div>
            </div>

            <ScrollArea className="h-32 border rounded-md">
              <div className="p-2 space-y-1">
                {segments.map((segment, index) => (
                  <div
                    key={segment.id}
                    className="flex items-start gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                    onClick={() => handleSegmentToggle(segment.id)}
                  >
                    <Checkbox
                      checked={selectedSegments.includes(segment.id)}
                      onCheckedChange={() => handleSegmentToggle(segment.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium">
                          Segment {index + 1}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDuration(segment.start_time)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {segment.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Context info */}
        <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
          <div className="flex items-center justify-between">
            <span>Context size:</span>
            <span className="font-medium">
              {contextMode === 'full'
                ? `${wordCount} words`
                : `${selectedWordCount} words (${selectedSegments.length} segments)`}
            </span>
          </div>
          {selectedWordCount > 1000 && (
            <p className="mt-1 text-yellow-600 dark:text-yellow-400">
              ⚠ Large context may increase costs and response time
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
