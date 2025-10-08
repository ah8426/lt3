'use client'

import { useState } from 'react'
import { Edit2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface Speaker {
  id: string
  speakerNumber: number
  name?: string
  role?: string
  organization?: string
  color?: string
}

interface SpeakerLabelProps {
  speaker?: Speaker
  speakerNumber?: number
  showEdit?: boolean
  onClick?: () => void
  size?: 'sm' | 'md' | 'lg'
  variant?: 'badge' | 'inline' | 'compact'
  className?: string
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

export function SpeakerLabel({
  speaker,
  speakerNumber,
  showEdit = false,
  onClick,
  size = 'md',
  variant = 'badge',
  className = '',
}: SpeakerLabelProps) {
  const [isHovered, setIsHovered] = useState(false)

  // Use speaker object if provided, otherwise create minimal speaker from number
  const displaySpeaker = speaker || {
    id: `speaker-${speakerNumber}`,
    speakerNumber: speakerNumber ?? 0,
    name: undefined,
    role: undefined,
    organization: undefined,
    color: undefined,
  }

  const displayName = displaySpeaker.name || `Speaker ${displaySpeaker.speakerNumber + 1}`
  const color = displaySpeaker.color || '#3B82F6'

  // Size classes
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  }

  const avatarSizes = {
    sm: 'w-4 h-4 text-[10px]',
    md: 'w-5 h-5 text-xs',
    lg: 'w-6 h-6 text-sm',
  }

  // Badge variant
  if (variant === 'badge') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={`inline-flex items-center gap-1.5 cursor-pointer hover:bg-muted transition-colors ${sizeClasses[size]} ${className}`}
              style={{ borderColor: color }}
              onClick={onClick}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <div
                className={`rounded-full flex items-center justify-center text-white font-bold ${avatarSizes[size]}`}
                style={{ backgroundColor: color }}
              >
                {displaySpeaker.speakerNumber + 1}
              </div>
              <span className="font-medium">{displayName}</span>
              {showEdit && isHovered && <Edit2 className="h-3 w-3 ml-1" />}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div className="text-xs space-y-1">
              <p className="font-semibold">{displayName}</p>
              {displaySpeaker.role && (
                <p className="text-muted-foreground">
                  {ROLE_LABELS[displaySpeaker.role] || displaySpeaker.role}
                </p>
              )}
              {displaySpeaker.organization && (
                <p className="text-muted-foreground">{displaySpeaker.organization}</p>
              )}
              {showEdit && <p className="text-muted-foreground italic">Click to edit</p>}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Inline variant (for transcript view)
  if (variant === 'inline') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-semibold cursor-pointer ${className}`}
        style={{ color }}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span>{displayName}:</span>
        {showEdit && isHovered && <Edit2 className="h-3 w-3" />}
      </span>
    )
  }

  // Compact variant (avatar only)
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={`rounded-full flex items-center justify-center text-white font-bold cursor-pointer hover:ring-2 hover:ring-offset-2 transition-all ${avatarSizes[size]} ${className}`}
            style={{ backgroundColor: color, ringColor: color }}
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {displaySpeaker.speakerNumber + 1}
            {showEdit && isHovered && (
              <Edit2 className="absolute h-3 w-3 text-white" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="text-xs">
            <p className="font-semibold">{displayName}</p>
            {displaySpeaker.role && (
              <p className="text-muted-foreground">{ROLE_LABELS[displaySpeaker.role]}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
