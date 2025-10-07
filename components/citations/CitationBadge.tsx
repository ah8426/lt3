'use client'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, AlertCircle, HelpCircle, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExtractedCitation, CitationVerification } from '@/lib/services/citation-checker'

export interface CitationBadgeProps {
  citation: ExtractedCitation
  verification?: CitationVerification
  onClick?: () => void
  showTooltip?: boolean
  className?: string
}

export function CitationBadge({
  citation,
  verification,
  onClick,
  showTooltip = true,
  className,
}: CitationBadgeProps) {
  const status = getVerificationStatus(verification)
  const { icon: Icon, color, bgColor, label } = getStatusConfig(status)

  const badge = (
    <Badge
      variant={status === 'verified' ? 'default' : status === 'invalid' ? 'destructive' : 'outline'}
      className={cn(
        'inline-flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity',
        bgColor,
        className
      )}
      onClick={onClick}
    >
      <Icon className={cn('h-3 w-3', color)} />
      <span className="text-xs font-mono">{citation.text}</span>
    </Badge>
  )

  if (!showTooltip) {
    return badge
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          <div className="space-y-2">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="font-semibold text-sm">{citation.text}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {getCitationTypeLabel(citation.type)}
                  {citation.jurisdiction && ` • ${citation.jurisdiction}`}
                </div>
              </div>
              <Badge variant={status === 'verified' ? 'default' : 'outline'} className="text-xs">
                {label}
              </Badge>
            </div>

            {/* Verification Details */}
            {verification && (
              <>
                <div className="border-t pt-2 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Format:</span>
                    <span className={verification.isFormatCorrect ? 'text-green-600' : 'text-red-600'}>
                      {verification.isFormatCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Valid Law:</span>
                    <span
                      className={verification.isCurrentlyValid ? 'text-green-600' : 'text-red-600'}
                    >
                      {verification.isCurrentlyValid ? 'Yes' : 'No'}
                    </span>
                  </div>
                  {verification.treatmentStatus && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Treatment:</span>
                      <span className={getTreatmentColor(verification.treatmentStatus)}>
                        {getTreatmentLabel(verification.treatmentStatus)}
                      </span>
                    </div>
                  )}
                  {verification.confidence > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Confidence:</span>
                      <span>{verification.confidence}%</span>
                    </div>
                  )}
                </div>

                {/* Bluebook Format */}
                {verification.bluebookFormat && (
                  <div className="border-t pt-2">
                    <div className="text-xs text-muted-foreground mb-1">Bluebook Format:</div>
                    <div className="text-xs font-mono bg-muted p-2 rounded">
                      {verification.bluebookFormat}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {verification.suggestions && verification.suggestions.length > 0 && (
                  <div className="border-t pt-2">
                    <div className="text-xs text-muted-foreground mb-1">Suggestions:</div>
                    <ul className="text-xs space-y-1">
                      {verification.suggestions.map((suggestion, index) => (
                        <li key={index} className="flex items-start gap-1">
                          <span className="text-blue-500 mt-0.5">•</span>
                          <span>{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Errors */}
                {verification.errors && verification.errors.length > 0 && (
                  <div className="border-t pt-2">
                    <div className="text-xs text-red-600 mb-1">Errors:</div>
                    <ul className="text-xs space-y-1">
                      {verification.errors.map((error, index) => (
                        <li key={index} className="flex items-start gap-1">
                          <span className="text-red-500 mt-0.5">•</span>
                          <span>{error}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Details */}
                {verification.details && (
                  <div className="border-t pt-2 space-y-1 text-xs">
                    {verification.details.fullName && (
                      <div>
                        <span className="text-muted-foreground">Full Name: </span>
                        <span>{verification.details.fullName}</span>
                      </div>
                    )}
                    {verification.details.court && (
                      <div>
                        <span className="text-muted-foreground">Court: </span>
                        <span>{verification.details.court}</span>
                      </div>
                    )}
                    {verification.details.decidedDate && (
                      <div>
                        <span className="text-muted-foreground">Decided: </span>
                        <span>{verification.details.decidedDate}</span>
                      </div>
                    )}
                    {verification.details.treatmentNotes && (
                      <div className="mt-2">
                        <div className="text-muted-foreground mb-1">Treatment Notes:</div>
                        <div className="bg-muted p-2 rounded">
                          {verification.details.treatmentNotes}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Click to view details */}
            {onClick && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs mt-2"
                onClick={onClick}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View Full Details
              </Button>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

type VerificationStatus = 'verified' | 'invalid' | 'unknown' | 'unverified'

function getVerificationStatus(verification?: CitationVerification): VerificationStatus {
  if (!verification) return 'unverified'
  if (verification.treatmentStatus === 'unknown') return 'unknown'
  if (verification.isValid && verification.isCurrentlyValid) return 'verified'
  return 'invalid'
}

function getStatusConfig(status: VerificationStatus) {
  const configs = {
    verified: {
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50 border-green-200',
      label: 'Verified',
    },
    invalid: {
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50 border-red-200',
      label: 'Invalid',
    },
    unknown: {
      icon: AlertCircle,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50 border-yellow-200',
      label: 'Unknown',
    },
    unverified: {
      icon: HelpCircle,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50 border-gray-200',
      label: 'Unverified',
    },
  }
  return configs[status]
}

function getCitationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    mcl: 'Michigan Compiled Laws',
    mcr: 'Michigan Court Rules',
    usc: 'United States Code',
    cfr: 'Code of Federal Regulations',
    case: 'Case Law',
    unknown: 'Unknown',
  }
  return labels[type] || type
}

function getTreatmentLabel(status: string): string {
  const labels: Record<string, string> = {
    good: 'Good Law',
    questioned: 'Questioned',
    negative: 'Negative Treatment',
    superseded: 'Superseded',
    unknown: 'Unknown',
  }
  return labels[status] || status
}

function getTreatmentColor(status: string): string {
  const colors: Record<string, string> = {
    good: 'text-green-600',
    questioned: 'text-yellow-600',
    negative: 'text-red-600',
    superseded: 'text-red-600',
    unknown: 'text-gray-600',
  }
  return colors[status] || 'text-gray-600'
}
