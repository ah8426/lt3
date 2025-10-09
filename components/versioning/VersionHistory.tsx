'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Clock, GitBranch, User, RotateCcw, Eye, GitCompare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

interface Version {
  id: string
  version: number
  changeType: string
  changedBy: string
  changeReason?: string
  diffSummary?: {
    added: number
    removed: number
    modified: number
  }
  createdAt: string
}

interface VersionHistoryProps {
  sessionId: string
  versions: Version[]
  currentVersion?: number
  onCompare: (fromVersion: number, toVersion: number) => void
  onRestore: (version: number, reason?: string) => Promise<void>
  onRefresh: () => void
}

export function VersionHistory({
  sessionId,
  versions,
  currentVersion,
  onCompare,
  onRestore,
  onRefresh,
}: VersionHistoryProps) {
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareVersions, setCompareVersions] = useState<{
    from: number | null
    to: number | null
  }>({ from: null, to: null })
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [restoreReason, setRestoreReason] = useState('')
  const [isRestoring, setIsRestoring] = useState(false)
  const { toast } = useToast()

  const getChangeTypeColor = (changeType: string) => {
    const colors: Record<string, string> = {
      manual_save: 'bg-blue-500',
      auto_save: 'bg-gray-500',
      segment_edit: 'bg-yellow-500',
      segment_add: 'bg-green-500',
      segment_delete: 'bg-red-500',
      restore: 'bg-purple-500',
      pre_export: 'bg-indigo-500',
      pre_share: 'bg-pink-500',
    }
    return colors[changeType] || 'bg-gray-500'
  }

  const getChangeTypeLabel = (changeType: string) => {
    const labels: Record<string, string> = {
      manual_save: 'Manual Save',
      auto_save: 'Auto Save',
      segment_edit: 'Segment Edit',
      segment_add: 'Segment Added',
      segment_delete: 'Segment Deleted',
      restore: 'Restored',
      pre_export: 'Before Export',
      pre_share: 'Before Share',
    }
    return labels[changeType] || changeType
  }

  const handleCompareSelect = (version: number) => {
    if (!compareVersions.from) {
      setCompareVersions({ from: version, to: null })
    } else if (!compareVersions.to) {
      const from = Math.min(compareVersions.from, version)
      const to = Math.max(compareVersions.from, version)
      setCompareVersions({ from, to })
      onCompare(from, to)
      setCompareMode(false)
    }
  }

  const handleRestore = async () => {
    if (selectedVersion === null) return

    setIsRestoring(true)
    try {
      await onRestore(selectedVersion, restoreReason || undefined)
      toast({
        title: 'Version Restored',
        description: `Successfully restored to version ${selectedVersion}`,
      })
      setRestoreDialogOpen(false)
      setRestoreReason('')
      setSelectedVersion(null)
      onRefresh()
    } catch (error) {
      toast({
        title: 'Restore Failed',
        description: 'Failed to restore version. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Version History
              </CardTitle>
              <CardDescription>
                Track and manage transcript versions
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={compareMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setCompareMode(!compareMode)
                  setCompareVersions({ from: null, to: null })
                }}
              >
                <GitCompare className="h-4 w-4 mr-2" />
                {compareMode ? 'Cancel Compare' : 'Compare Versions'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {versions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No version history yet</p>
                  <p className="text-sm">
                    Versions are created automatically and when you save changes
                  </p>
                </div>
              ) : (
                versions.map((version) => (
                  <div
                    key={version.id}
                    className={`relative pl-8 pb-4 border-l-2 ${
                      compareMode &&
                      (compareVersions.from === version.version ||
                        compareVersions.to === version.version)
                        ? 'border-blue-500'
                        : 'border-gray-200'
                    } ${
                      version.version === currentVersion
                        ? 'bg-blue-50 -ml-4 pl-12 pr-4 py-4 rounded-r-lg'
                        : ''
                    }`}
                  >
                    {/* Timeline dot */}
                    <div
                      className={`absolute left-0 top-0 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white ${getChangeTypeColor(
                        version.changeType
                      )}`}
                    />

                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">
                            Version {version.version}
                          </span>
                          {version.version === currentVersion && (
                            <Badge variant="default">Current</Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={`${getChangeTypeColor(
                              version.changeType
                            )} text-white border-0`}
                          >
                            {getChangeTypeLabel(version.changeType)}
                          </Badge>
                        </div>

                        <div className="text-sm text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            <span>
                              {formatDistanceToNow(new Date(version.createdAt), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3" />
                            <span>{version.changedBy}</span>
                          </div>
                        </div>

                        {version.changeReason && (
                          <p className="text-sm italic text-muted-foreground">
                            &quot;{version.changeReason}&quot;
                          </p>
                        )}

                        {version.diffSummary && (
                          <div className="flex gap-3 text-sm">
                            {version.diffSummary.added > 0 && (
                              <span className="text-green-600">
                                +{version.diffSummary.added} added
                              </span>
                            )}
                            {version.diffSummary.removed > 0 && (
                              <span className="text-red-600">
                                -{version.diffSummary.removed} removed
                              </span>
                            )}
                            {version.diffSummary.modified > 0 && (
                              <span className="text-yellow-600">
                                ~{version.diffSummary.modified} modified
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {compareMode ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCompareSelect(version.version)}
                            disabled={
                              compareVersions.from === version.version ||
                              compareVersions.to === version.version
                            }
                          >
                            {compareVersions.from === version.version ||
                            compareVersions.to === version.version
                              ? 'Selected'
                              : 'Select'}
                          </Button>
                        ) : (
                          <>
                            {version.version !== currentVersion && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedVersion(version.version)
                                  setRestoreDialogOpen(true)
                                }}
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Restore
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Version {selectedVersion}</DialogTitle>
            <DialogDescription>
              This will replace the current transcript with version {selectedVersion}.
              A backup of the current state will be created automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for restore (optional)</Label>
              <Input
                id="reason"
                placeholder="e.g., Reverting accidental changes"
                value={restoreReason}
                onChange={(e) => setRestoreReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRestoreDialogOpen(false)
                setRestoreReason('')
                setSelectedVersion(null)
              }}
              disabled={isRestoring}
            >
              Cancel
            </Button>
            <Button onClick={handleRestore} disabled={isRestoring}>
              {isRestoring ? 'Restoring...' : 'Restore Version'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
