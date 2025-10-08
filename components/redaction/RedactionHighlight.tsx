'use client'

import { useState } from 'react'
import { Redaction } from '@/hooks/useRedaction'
import { getRedactionLabel } from '@/lib/redaction/pii-detector'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Lock, Info } from 'lucide-react'
import { PIIType } from '@/lib/redaction/pii-detector'

export interface RedactionHighlightProps {
  redaction: Redaction
  canUnredact?: boolean
  onUnredact?: (redactionId: string, reason: string) => Promise<string>
  variant?: 'inline' | 'block'
}

export function RedactionHighlight({
  redaction,
  canUnredact = false,
  onUnredact,
  variant = 'inline',
}: RedactionHighlightProps) {
  const [showUnredactDialog, setShowUnredactDialog] = useState(false)
  const [unredactReason, setUnredactReason] = useState('')
  const [isUnredacting, setIsUnredacting] = useState(false)
  const [unredactedText, setUnredactedText] = useState<string | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)

  const label = getRedactionLabel(redaction.piiType as PIIType)

  const handleUnredactClick = () => {
    if (canUnredact && onUnredact) {
      setShowUnredactDialog(true)
    }
  }

  const handleUnredact = async () => {
    if (!onUnredact || !unredactReason.trim()) return

    setIsUnredacting(true)
    try {
      const original = await onUnredact(redaction.id, unredactReason)
      setUnredactedText(original)
      setShowOriginal(true)
      setShowUnredactDialog(false)
      setUnredactReason('')
    } catch (error) {
      console.error('Failed to unredact:', error)
    } finally {
      setIsUnredacting(false)
    }
  }

  const displayText = showOriginal && unredactedText ? unredactedText : redaction.redactedText

  const getRedactionColor = (piiType: string): string => {
    const colors: Record<string, string> = {
      ssn: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      credit_card: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      bank_account: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      email: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      phone: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      address: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      name: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      date_of_birth: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      driver_license: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
      passport: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
      ip_address: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      custom: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    }
    return colors[piiType] || colors.custom
  }

  if (variant === 'block') {
    return (
      <>
        <div className="p-3 rounded-lg border border-dashed bg-gray-50 dark:bg-gray-900">
          <div className="flex items-start justify-between mb-2">
            <Badge variant="outline" className={getRedactionColor(redaction.piiType)}>
              <Lock className="h-3 w-3 mr-1" />
              {label}
            </Badge>

            {canUnredact && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOriginal(!showOriginal)}
                disabled={!unredactedText && !showUnredactDialog}
                className="h-7"
              >
                {showOriginal ? (
                  <>
                    <EyeOff className="h-3 w-3 mr-1" />
                    Hide
                  </>
                ) : (
                  <>
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </>
                )}
              </Button>
            )}
          </div>

          <p className="text-sm font-mono">
            {showOriginal && unredactedText ? (
              <span className="text-gray-900 dark:text-white">{unredactedText}</span>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">{redaction.redactedText}</span>
            )}
          </p>

          {redaction.reason && (
            <p className="text-xs text-gray-500 mt-2">
              <Info className="h-3 w-3 inline mr-1" />
              {redaction.reason}
            </p>
          )}

          {canUnredact && !unredactedText && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnredactClick}
              className="mt-2"
            >
              Request Unredaction
            </Button>
          )}
        </div>

        <UnredactDialog
          open={showUnredactDialog}
          onOpenChange={setShowUnredactDialog}
          reason={unredactReason}
          onReasonChange={setUnredactReason}
          onUnredact={handleUnredact}
          isUnredacting={isUnredacting}
          redactionLabel={label}
        />
      </>
    )
  }

  // Inline variant
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors ${getRedactionColor(
              redaction.piiType
            )} ${canUnredact ? 'hover:opacity-80' : ''}`}
            onClick={canUnredact ? handleUnredactClick : undefined}
          >
            <Lock className="h-3 w-3" />
            <span>{displayText}</span>
            {canUnredact && <Eye className="h-3 w-3 ml-1 opacity-50" />}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          <div className="space-y-1">
            <p className="font-medium">Redacted: {label}</p>
            {redaction.reason && (
              <p className="text-xs text-muted-foreground">{redaction.reason}</p>
            )}
            {redaction.legalBasis && (
              <p className="text-xs text-muted-foreground">
                Legal basis: {redaction.legalBasis}
              </p>
            )}
            {canUnredact && <p className="text-xs text-green-500">Click to unredact</p>}
          </div>
        </TooltipContent>
      </Tooltip>

      <UnredactDialog
        open={showUnredactDialog}
        onOpenChange={setShowUnredactDialog}
        reason={unredactReason}
        onReasonChange={setUnredactReason}
        onUnredact={handleUnredact}
        isUnredacting={isUnredacting}
        redactionLabel={label}
      />
    </TooltipProvider>
  )
}

interface UnredactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reason: string
  onReasonChange: (reason: string) => void
  onUnredact: () => void
  isUnredacting: boolean
  redactionLabel: string
}

function UnredactDialog({
  open,
  onOpenChange,
  reason,
  onReasonChange,
  onUnredact,
  isUnredacting,
  redactionLabel,
}: UnredactDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unredact Content</DialogTitle>
          <DialogDescription>
            You are requesting to view the original {redactionLabel}. Please provide a reason for
            this action. This will be logged for audit purposes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Unredaction</Label>
            <Textarea
              id="reason"
              placeholder="Enter the legal or business reason for viewing this redacted content..."
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              rows={4}
              required
            />
            <p className="text-xs text-muted-foreground">
              This action will be recorded in the audit log with your user ID and timestamp.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUnredacting}>
            Cancel
          </Button>
          <Button onClick={onUnredact} disabled={!reason.trim() || isUnredacting}>
            {isUnredacting ? 'Unredacting...' : 'Unredact'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
