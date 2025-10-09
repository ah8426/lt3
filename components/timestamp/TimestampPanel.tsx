'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle2, XCircle, Clock, AlertCircle, Download, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TimestampBadge } from './TimestampBadge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface TimestampProof {
  id: string
  segmentId: string
  contentHash: string
  timestamp: Date
  timestampSource: 'ntp' | 'local'
  nonce: string
  signature: string
  isVerified: boolean
  verifiedAt?: Date
  ntpServer?: string
  ntpOffsetMs?: number
  segment?: {
    text: string
    startTime: number
    endTime: number
  }
}

interface TimestampPanelProps {
  sessionId: string
  proofs: TimestampProof[]
  isLoading?: boolean
  onVerify?: (proofIds: string[]) => Promise<void>
  onDelete?: (proofIds: string[]) => Promise<void>
  onExport?: (proofIds: string[]) => Promise<void>
  onRefresh?: () => Promise<void>
  onVerifyChain?: () => Promise<void>
}

export function TimestampPanel({
  sessionId,
  proofs,
  isLoading = false,
  onVerify,
  onDelete,
  onExport,
  onRefresh,
  onVerifyChain,
}: TimestampPanelProps) {
  const [selectedProofs, setSelectedProofs] = useState<Set<string>>(new Set())
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const allSelected = proofs.length > 0 && selectedProofs.size === proofs.length
  const someSelected = selectedProofs.size > 0 && selectedProofs.size < proofs.length

  const handleToggleAll = () => {
    if (allSelected) {
      setSelectedProofs(new Set())
    } else {
      setSelectedProofs(new Set(proofs.map(p => p.id)))
    }
  }

  const handleToggleProof = (proofId: string) => {
    const newSelected = new Set(selectedProofs)
    if (newSelected.has(proofId)) {
      newSelected.delete(proofId)
    } else {
      newSelected.add(proofId)
    }
    setSelectedProofs(newSelected)
  }

  const handleBulkVerify = async () => {
    if (!onVerify || selectedProofs.size === 0) return
    setIsProcessing(true)
    try {
      await onVerify(Array.from(selectedProofs))
      setSelectedProofs(new Set())
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBulkExport = async () => {
    if (!onExport || selectedProofs.size === 0) return
    setIsProcessing(true)
    try {
      await onExport(Array.from(selectedProofs))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBulkDelete = async () => {
    if (!onDelete || selectedProofs.size === 0) return
    setIsProcessing(true)
    try {
      await onDelete(Array.from(selectedProofs))
      setSelectedProofs(new Set())
      setShowDeleteDialog(false)
    } finally {
      setIsProcessing(false)
    }
  }

  const stats = {
    total: proofs.length,
    verified: proofs.filter(p => p.isVerified).length,
    ntp: proofs.filter(p => p.timestampSource === 'ntp').length,
    local: proofs.filter(p => p.timestampSource === 'local').length,
  }

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Proofs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Verified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.verified}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.verified / stats.total) * 100) : 0}% verified
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">NTP Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.ntp}
            </div>
            <p className="text-xs text-muted-foreground">Trusted source</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Local Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats.local}
            </div>
            <p className="text-xs text-muted-foreground">Fallback source</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Timestamp Proofs</CardTitle>
              <CardDescription>
                {selectedProofs.size > 0
                  ? `${selectedProofs.size} proof${selectedProofs.size === 1 ? '' : 's'} selected`
                  : 'Manage cryptographic timestamp proofs for this session'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {onVerifyChain && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onVerifyChain}
                  disabled={isLoading || isProcessing}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Verify Chain
                </Button>
              )}
              {onRefresh && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  disabled={isLoading || isProcessing}
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {selectedProofs.size > 0 && (
          <>
            <Separator />
            <div className="p-4 bg-muted/50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {selectedProofs.size} selected
                </span>
                <div className="flex items-center gap-2">
                  {onVerify && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkVerify}
                      disabled={isProcessing}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Verify Selected
                    </Button>
                  )}
                  {onExport && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkExport}
                      disabled={isProcessing}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                      disabled={isProcessing}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        <CardContent className="p-0">
          {proofs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No timestamp proofs yet</p>
              <p className="text-sm mt-2">
                Timestamp proofs will appear here as segments are timestamped
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="p-4 space-y-2">
                {/* Select All */}
                <div className="flex items-center space-x-2 p-2 rounded-lg bg-muted/30">
                  <Checkbox
                    checked={allSelected}
                    ref={(el) => {
                      if (el) {
                        (el as any).indeterminate = someSelected
                      }
                    }}
                    onCheckedChange={handleToggleAll}
                  />
                  <span className="text-sm font-medium">
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </span>
                </div>

                {/* Proof List */}
                {proofs.map((proof, index) => (
                  <div
                    key={proof.id}
                    className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                      selectedProofs.has(proof.id)
                        ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                        : 'bg-card hover:bg-muted/50'
                    }`}
                  >
                    <Checkbox
                      checked={selectedProofs.has(proof.id)}
                      onCheckedChange={() => handleToggleProof(proof.id)}
                      className="mt-1"
                    />

                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Proof Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">
                              Proof #{index + 1}
                            </span>
                            <TimestampBadge
                              timestamp={proof.timestamp}
                              isVerified={proof.isVerified}
                              timestampSource={proof.timestampSource}
                              size="sm"
                              variant="minimal"
                            />
                            {proof.isVerified && (
                              <Badge variant="outline" className="text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
                                Verified
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(proof.timestamp, { addSuffix: true })}
                          </p>
                        </div>
                      </div>

                      {/* Segment Text */}
                      {proof.segment && (
                        <div className="text-sm bg-muted/50 rounded p-2">
                          <p className="line-clamp-2">{proof.segment.text}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatTime(proof.segment.startTime)} - {formatTime(proof.segment.endTime)}
                          </p>
                        </div>
                      )}

                      {/* Proof Details */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Content Hash:</span>
                          <p className="font-mono truncate">{proof.contentHash.slice(0, 16)}...</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Signature:</span>
                          <p className="font-mono truncate">{proof.signature.slice(0, 16)}...</p>
                        </div>
                        {proof.ntpServer && (
                          <div>
                            <span className="text-muted-foreground">NTP Server:</span>
                            <p className="truncate">{proof.ntpServer}</p>
                          </div>
                        )}
                        {proof.ntpOffsetMs !== undefined && (
                          <div>
                            <span className="text-muted-foreground">NTP Offset:</span>
                            <p>{proof.ntpOffsetMs}ms</p>
                          </div>
                        )}
                      </div>

                      {/* Verification Info */}
                      {proof.verifiedAt && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                          <span>
                            Verified {formatDistanceToNow(proof.verifiedAt, { addSuffix: true })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Local Time Warning */}
      {stats.local > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {stats.local} proof{stats.local === 1 ? '' : 's'} used local time fallback due to NTP unavailability.
            These timestamps may be less reliable for legal verification.
          </AlertDescription>
        </Alert>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Timestamp Proofs</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedProofs.size} timestamp proof
              {selectedProofs.size === 1 ? '' : 's'}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Deleting timestamp proofs will remove cryptographic verification for these segments.
              This may affect the legal admissibility of the transcript.
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isProcessing}
            >
              {isProcessing ? 'Deleting...' : 'Delete Proofs'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
