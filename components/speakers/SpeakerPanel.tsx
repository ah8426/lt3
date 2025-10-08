'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  Users,
  Edit2,
  Trash2,
  GitMerge,
  Plus,
  BarChart3,
  Clock,
  MessageSquare,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SpeakerEditor } from './SpeakerEditor'
import { formatSpeakingTime, calculateSpeakingPercentage } from '@/lib/speakers/manager'

interface Speaker {
  id: string
  sessionId: string
  speakerNumber: number
  name?: string
  role?: string
  organization?: string
  color?: string
  createdAt: Date
  updatedAt: Date
}

interface SpeakerStats {
  speakerId: string
  speakerNumber: number
  name?: string
  totalSegments: number
  totalWords: number
  speakingTimeMs: number
  averageConfidence: number
  firstAppearance: Date
  lastAppearance: Date
}

interface SpeakerPanelProps {
  sessionId: string
  speakers: Speaker[]
  stats: SpeakerStats[]
  isLoading?: boolean
  onUpdate?: (speakerId: string, data: Partial<Speaker>) => Promise<void>
  onDelete?: (speakerId: string) => Promise<void>
  onMerge?: (fromSpeakerId: string, toSpeakerId: string) => Promise<void>
  onCreate?: (speakerNumber: number) => Promise<void>
  onRefresh?: () => Promise<void>
}

const ROLE_LABELS: Record<string, string> = {
  attorney: 'Attorney',
  client: 'Client',
  witness: 'Witness',
  expert: 'Expert',
  judge: 'Judge',
  court_reporter: 'Court Reporter',
  interpreter: 'Interpreter',
  other: 'Other',
}

const ROLE_COLORS: Record<string, string> = {
  attorney: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  client: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  witness: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  expert: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  judge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  court_reporter: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  interpreter: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  other: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
}

export function SpeakerPanel({
  sessionId,
  speakers,
  stats,
  isLoading = false,
  onUpdate,
  onDelete,
  onMerge,
  onCreate,
  onRefresh,
}: SpeakerPanelProps) {
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null)
  const [mergingFrom, setMergingFrom] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'number' | 'name' | 'time'>('number')

  // Calculate total speaking time
  const totalSpeakingTime = stats.reduce((sum, s) => sum + s.speakingTimeMs, 0)

  // Sort speakers
  const sortedSpeakers = [...speakers].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return (a.name || `Speaker ${a.speakerNumber + 1}`).localeCompare(
          b.name || `Speaker ${b.speakerNumber + 1}`
        )
      case 'time': {
        const aStats = stats.find((s) => s.speakerId === a.id)
        const bStats = stats.find((s) => s.speakerId === b.id)
        return (bStats?.speakingTimeMs || 0) - (aStats?.speakingTimeMs || 0)
      }
      default:
        return a.speakerNumber - b.speakerNumber
    }
  })

  const handleMerge = async (targetSpeakerId: string) => {
    if (!mergingFrom || !onMerge) return
    await onMerge(mergingFrom, targetSpeakerId)
    setMergingFrom(null)
  }

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Speakers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{speakers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Total Speaking Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatSpeakingTime(totalSpeakingTime)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Total Segments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.reduce((sum, s) => sum + s.totalSegments, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Speaker Management</CardTitle>
              <CardDescription>
                View and edit speaker information for this session
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">Sort by Number</SelectItem>
                  <SelectItem value="name">Sort by Name</SelectItem>
                  <SelectItem value="time">Sort by Time</SelectItem>
                </SelectContent>
              </Select>
              {onCreate && (
                <Button variant="outline" size="sm" onClick={() => onCreate(speakers.length)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Speaker
                </Button>
              )}
              {onRefresh && (
                <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
                  <TrendingUp className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {speakers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No speakers detected yet</p>
              <p className="text-sm mt-2">
                Speakers will be automatically detected during transcription
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="p-4 space-y-3">
                {sortedSpeakers.map((speaker) => {
                  const speakerStats = stats.find((s) => s.speakerId === speaker.id)
                  const speakingPercentage = speakerStats
                    ? calculateSpeakingPercentage(speakerStats.speakingTimeMs, totalSpeakingTime)
                    : 0

                  return (
                    <Card
                      key={speaker.id}
                      className="transition-colors hover:bg-muted/50"
                      style={{ borderLeftWidth: '4px', borderLeftColor: speaker.color }}
                    >
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Speaker Header */}
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                                  style={{ backgroundColor: speaker.color }}
                                >
                                  {speaker.speakerNumber + 1}
                                </div>
                                <div>
                                  <h3 className="font-medium">
                                    {speaker.name || `Speaker ${speaker.speakerNumber + 1}`}
                                  </h3>
                                  {speaker.organization && (
                                    <p className="text-sm text-muted-foreground">
                                      {speaker.organization}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {speaker.role && (
                                <Badge
                                  variant="secondary"
                                  className={ROLE_COLORS[speaker.role]}
                                >
                                  {ROLE_LABELS[speaker.role]}
                                </Badge>
                              )}
                              {onUpdate && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditingSpeaker(speaker)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              )}
                              {onMerge && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setMergingFrom(speaker.id)}
                                >
                                  <GitMerge className="h-4 w-4" />
                                </Button>
                              )}
                              {onDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onDelete(speaker.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Statistics */}
                          {speakerStats && (
                            <>
                              <Separator />
                              <div className="grid grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Speaking Time</p>
                                  <p className="font-medium">
                                    {formatSpeakingTime(speakerStats.speakingTimeMs)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Segments</p>
                                  <p className="font-medium">{speakerStats.totalSegments}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Words</p>
                                  <p className="font-medium">{speakerStats.totalWords.toLocaleString()}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Confidence</p>
                                  <p className="font-medium">
                                    {Math.round(speakerStats.averageConfidence * 100)}%
                                  </p>
                                </div>
                              </div>

                              {/* Speaking Time Progress */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Speaking Share</span>
                                  <span className="font-medium">{speakingPercentage}%</span>
                                </div>
                                <Progress value={speakingPercentage} className="h-2" />
                              </div>

                              {/* Timeline */}
                              <div className="text-xs text-muted-foreground">
                                First appeared{' '}
                                {formatDistanceToNow(speakerStats.firstAppearance, {
                                  addSuffix: true,
                                })}
                                {' • '}
                                Last spoke{' '}
                                {formatDistanceToNow(speakerStats.lastAppearance, {
                                  addSuffix: true,
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Speaker Editor Dialog */}
      {editingSpeaker && onUpdate && (
        <SpeakerEditor
          speaker={editingSpeaker}
          isOpen={true}
          onClose={() => setEditingSpeaker(null)}
          onSave={async (data) => {
            await onUpdate(editingSpeaker.id, data)
            setEditingSpeaker(null)
          }}
        />
      )}

      {/* Merge Dialog */}
      {mergingFrom && onMerge && (
        <Dialog open={true} onOpenChange={() => setMergingFrom(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Merge Speaker</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select the target speaker to merge into. All segments from the current speaker
                will be reassigned to the target speaker.
              </p>
              <Select onValueChange={handleMerge}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target speaker" />
                </SelectTrigger>
                <SelectContent>
                  {speakers
                    .filter((s) => s.id !== mergingFrom)
                    .map((speaker) => (
                      <SelectItem key={speaker.id} value={speaker.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: speaker.color }}
                          />
                          {speaker.name || `Speaker ${speaker.speakerNumber + 1}`}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
