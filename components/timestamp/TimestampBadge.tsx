'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Shield, ShieldCheck, ShieldAlert, Clock, Info } from 'lucide-react'
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TimestampBadgeProps {
  timestamp: Date
  isVerified?: boolean
  timestampSource?: 'ntp' | 'local'
  contentHash?: string
  proofId?: string
  onVerify?: () => Promise<void>
  onViewDetails?: () => void
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'outline' | 'minimal'
}

export function TimestampBadge({
  timestamp,
  isVerified = false,
  timestampSource = 'local',
  contentHash,
  proofId,
  onVerify,
  onViewDetails,
  size = 'sm',
  variant = 'default',
}: TimestampBadgeProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)

  const handleVerify = async () => {
    if (!onVerify) return

    setIsVerifying(true)
    try {
      await onVerify()
    } finally {
      setIsVerifying(false)
    }
  }

  const getIcon = () => {
    if (isVerified && timestampSource === 'ntp') {
      return <ShieldCheck className="h-3 w-3" />
    } else if (timestampSource === 'ntp') {
      return <Shield className="h-3 w-3" />
    } else if (timestampSource === 'local') {
      return <Clock className="h-3 w-3" />
    } else {
      return <ShieldAlert className="h-3 w-3" />
    }
  }

  const getColor = () => {
    if (isVerified && timestampSource === 'ntp') {
      return 'bg-green-100 text-green-800 hover:bg-green-200'
    } else if (timestampSource === 'ntp') {
      return 'bg-blue-100 text-blue-800 hover:bg-blue-200'
    } else if (timestampSource === 'local') {
      return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
    } else {
      return 'bg-gray-100 text-gray-800 hover:bg-gray-200'
    }
  }

  const getTooltipText = () => {
    if (isVerified && timestampSource === 'ntp') {
      return 'Cryptographically verified timestamp from NTP server'
    } else if (timestampSource === 'ntp') {
      return 'Timestamp from NTP server (not yet verified)'
    } else if (timestampSource === 'local') {
      return 'Timestamp from local system time (lower reliability)'
    } else {
      return 'Unknown timestamp source'
    }
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  }

  if (variant === 'minimal') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setShowDetails(true)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {getIcon()}
              <span>{format(timestamp, 'PPp')}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getTooltipText()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              className={cn(
                'cursor-pointer transition-colors',
                getColor(),
                sizeClasses[size]
              )}
              variant={variant === 'outline' ? 'outline' : 'default'}
              onClick={() => setShowDetails(true)}
            >
              <div className="flex items-center gap-1.5">
                {getIcon()}
                <span>{format(timestamp, 'MMM d, yyyy HH:mm:ss')}</span>
              </div>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getTooltipText()}</p>
            <p className="text-xs mt-1">Click for details</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getIcon()}
              Timestamp Proof Details
            </DialogTitle>
            <DialogDescription>
              Cryptographic timestamp verification information
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Timestamp Info */}
            <div>
              <label className="text-sm font-semibold">Timestamp</label>
              <p className="text-sm text-muted-foreground">
                {format(timestamp, 'PPPPpppp')}
              </p>
            </div>

            {/* Verification Status */}
            <div>
              <label className="text-sm font-semibold">Verification Status</label>
              <div className="flex items-center gap-2 mt-1">
                {isVerified ? (
                  <>
                    <ShieldCheck className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-600">Verified</span>
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm text-yellow-600">Not Verified</span>
                  </>
                )}
              </div>
            </div>

            {/* Timestamp Source */}
            <div>
              <label className="text-sm font-semibold">Source</label>
              <div className="flex items-center gap-2 mt-1">
                {timestampSource === 'ntp' ? (
                  <>
                    <Badge className="bg-blue-100 text-blue-800">NTP Server</Badge>
                    <Info className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Trusted time source
                    </span>
                  </>
                ) : (
                  <>
                    <Badge className="bg-yellow-100 text-yellow-800">
                      Local System
                    </Badge>
                    <Info className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Lower reliability
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Content Hash */}
            {contentHash && (
              <div>
                <label className="text-sm font-semibold">Content Hash</label>
                <p className="text-xs font-mono bg-gray-100 p-2 rounded mt-1 break-all">
                  {contentHash}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  SHA-256 hash of the content at the time of timestamping
                </p>
              </div>
            )}

            {/* Proof ID */}
            {proofId && (
              <div>
                <label className="text-sm font-semibold">Proof ID</label>
                <p className="text-xs font-mono bg-gray-100 p-2 rounded mt-1 break-all">
                  {proofId}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            {!isVerified && onVerify && (
              <Button
                onClick={handleVerify}
                disabled={isVerifying}
                variant="outline"
              >
                {isVerifying ? 'Verifying...' : 'Verify Now'}
              </Button>
            )}
            {onViewDetails && (
              <Button onClick={onViewDetails} variant="outline">
                View Full Details
              </Button>
            )}
            <Button onClick={() => setShowDetails(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
