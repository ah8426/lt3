'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SegmentDiff {
  segmentId: string
  type: 'added' | 'removed' | 'modified' | 'unchanged'
  oldText?: string
  newText?: string
  startMs: number
  endMs: number
  changes?: Array<{
    type: 'added' | 'removed' | 'unchanged'
    value: string
  }>
}

interface DiffViewerProps {
  fromVersion: number
  toVersion: number
  segments: SegmentDiff[]
  summary: {
    added: number
    removed: number
    modified: number
    unchanged: number
  }
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function DiffViewer({
  fromVersion,
  toVersion,
  segments,
  summary,
}: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'inline'>('inline')
  const [showUnchanged, setShowUnchanged] = useState(false)
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(
    new Set()
  )

  const toggleSegment = (segmentId: string) => {
    const newExpanded = new Set(expandedSegments)
    if (newExpanded.has(segmentId)) {
      newExpanded.delete(segmentId)
    } else {
      newExpanded.add(segmentId)
    }
    setExpandedSegments(newExpanded)
  }

  const filteredSegments = showUnchanged
    ? segments
    : segments.filter((s) => s.type !== 'unchanged')

  const renderInlineWord = (
    word: { type: 'added' | 'removed' | 'unchanged'; value: string },
    index: number
  ) => {
    if (word.type === 'unchanged') {
      return <span key={index}>{word.value}</span>
    }

    if (word.type === 'added') {
      return (
        <span
          key={index}
          className="bg-green-100 text-green-800 px-0.5 rounded"
        >
          {word.value}
        </span>
      )
    }

    if (word.type === 'removed') {
      return (
        <span
          key={index}
          className="bg-red-100 text-red-800 line-through px-0.5 rounded"
        >
          {word.value}
        </span>
      )
    }
  }

  const renderSegment = (segment: SegmentDiff) => {
    const isExpanded = expandedSegments.has(segment.segmentId)

    if (segment.type === 'added') {
      return (
        <div
          key={segment.segmentId}
          className="border-l-4 border-green-500 bg-green-50 p-4 rounded-r-lg"
        >
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-green-500">
              <Plus className="h-3 w-3 mr-1" />
              Added
            </Badge>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(segment.startMs)} - {formatTime(segment.endMs)}
            </span>
          </div>
          <p className="text-sm font-mono whitespace-pre-wrap">
            {segment.newText}
          </p>
        </div>
      )
    }

    if (segment.type === 'removed') {
      return (
        <div
          key={segment.segmentId}
          className="border-l-4 border-red-500 bg-red-50 p-4 rounded-r-lg"
        >
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-red-500">
              <Minus className="h-3 w-3 mr-1" />
              Removed
            </Badge>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(segment.startMs)} - {formatTime(segment.endMs)}
            </span>
          </div>
          <p className="text-sm font-mono whitespace-pre-wrap line-through opacity-70">
            {segment.oldText}
          </p>
        </div>
      )
    }

    if (segment.type === 'modified') {
      return (
        <div
          key={segment.segmentId}
          className="border-l-4 border-yellow-500 bg-yellow-50 p-4 rounded-r-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-yellow-500">
                <ArrowLeftRight className="h-3 w-3 mr-1" />
                Modified
              </Badge>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(segment.startMs)} - {formatTime(segment.endMs)}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleSegment(segment.segmentId)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>

          {viewMode === 'inline' ? (
            <div className="text-sm font-mono whitespace-pre-wrap">
              {segment.changes?.map((word, index) =>
                renderInlineWord(word, index)
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-red-600">
                  Version {fromVersion}
                </div>
                <p className="text-sm font-mono bg-red-50 p-2 rounded whitespace-pre-wrap">
                  {segment.oldText}
                </p>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-green-600">
                  Version {toVersion}
                </div>
                <p className="text-sm font-mono bg-green-50 p-2 rounded whitespace-pre-wrap">
                  {segment.newText}
                </p>
              </div>
            </div>
          )}

          {isExpanded && viewMode === 'inline' && (
            <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-red-600">
                  Before (v{fromVersion})
                </div>
                <p className="text-sm font-mono bg-white p-2 rounded whitespace-pre-wrap">
                  {segment.oldText}
                </p>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-green-600">
                  After (v{toVersion})
                </div>
                <p className="text-sm font-mono bg-white p-2 rounded whitespace-pre-wrap">
                  {segment.newText}
                </p>
              </div>
            </div>
          )}
        </div>
      )
    }

    if (segment.type === 'unchanged' && showUnchanged) {
      return (
        <div
          key={segment.segmentId}
          className="border-l-4 border-gray-300 bg-gray-50 p-4 rounded-r-lg opacity-60"
        >
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline">Unchanged</Badge>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(segment.startMs)} - {formatTime(segment.endMs)}
            </span>
          </div>
          <p className="text-sm font-mono whitespace-pre-wrap">
            {segment.oldText}
          </p>
        </div>
      )
    }

    return null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            Version Comparison: v{fromVersion} → v{toVersion}
          </CardTitle>
          <div className="flex gap-2">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
              <TabsList>
                <TabsTrigger value="inline">Inline</TabsTrigger>
                <TabsTrigger value="side-by-side">Side-by-Side</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Summary */}
        <div className="flex gap-4 mt-4">
          {summary.added > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm">
                {summary.added} segment{summary.added !== 1 ? 's' : ''} added
              </span>
            </div>
          )}
          {summary.removed > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm">
                {summary.removed} segment{summary.removed !== 1 ? 's' : ''}{' '}
                removed
              </span>
            </div>
          )}
          {summary.modified > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-sm">
                {summary.modified} segment{summary.modified !== 1 ? 's' : ''}{' '}
                modified
              </span>
            </div>
          )}
          {summary.unchanged > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span className="text-sm">{summary.unchanged} unchanged</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUnchanged(!showUnchanged)}
              >
                {showUnchanged ? 'Hide' : 'Show'}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[700px]">
          <div className="space-y-4">
            {filteredSegments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No changes between these versions</p>
              </div>
            ) : (
              filteredSegments.map(renderSegment)
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
