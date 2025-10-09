'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Users, FileText, Briefcase } from 'lucide-react'
import type { ConflictMatch } from '@/lib/conflicts/types'
import { RiskLevel } from '@/lib/conflicts/types'
import { cn } from '@/lib/utils'

interface ConflictCardProps {
  conflict: ConflictMatch
  className?: string
}

const riskConfig = {
  critical: {
    label: 'Critical',
    color: 'bg-red-500 hover:bg-red-600',
    textColor: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  high: {
    label: 'High',
    color: 'bg-orange-500 hover:bg-orange-600',
    textColor: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  medium: {
    label: 'Medium',
    color: 'bg-yellow-500 hover:bg-yellow-600',
    textColor: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
  },
  low: {
    label: 'Low',
    color: 'bg-blue-500 hover:bg-blue-600',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  none: {
    label: 'None',
    color: 'bg-gray-500 hover:bg-gray-600',
    textColor: 'text-gray-700',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },
}

const typeConfig = {
  client: {
    label: 'Client Conflict',
    icon: Users,
    description: 'Matches existing client',
  },
  adverse_party: {
    label: 'Adverse Party',
    icon: AlertTriangle,
    description: 'Matches known adverse party',
  },
  matter: {
    label: 'Related Matter',
    icon: FileText,
    description: 'Similar to existing matter',
  },
  session: {
    label: 'Session Content',
    icon: Briefcase,
    description: 'Found in session transcript',
  },
}

export function ConflictCard({ conflict, className }: ConflictCardProps) {
  const risk = riskConfig[conflict.riskLevel as keyof typeof riskConfig]
  const type = typeConfig[conflict.type as keyof typeof typeConfig]
  const TypeIcon = type.icon

  const similarityPercent = Math.round(conflict.similarityScore * 100)

  return (
    <Card
      className={cn(
        'border-l-4 transition-all hover:shadow-md',
        risk.borderColor,
        risk.bgColor,
        className
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className={cn('p-2 rounded-lg', risk.bgColor)}>
              <TypeIcon className={cn('h-5 w-5', risk.textColor)} />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-semibold mb-1">
                {type.label}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{type.description}</p>
            </div>
          </div>
          <Badge className={cn(risk.color, 'text-white shrink-0')}>
            {risk.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Query Name
            </p>
            <p className="text-sm font-medium truncate" title={conflict.queryName}>
              {conflict.queryName}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Matched Name
            </p>
            <p className="text-sm font-medium truncate" title={conflict.matchedName}>
              {conflict.matchedName}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted-foreground">Similarity:</div>
            <div className="flex items-center gap-1">
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    conflict.similarityScore >= 0.9
                      ? 'bg-red-500'
                      : conflict.similarityScore >= 0.8
                        ? 'bg-orange-500'
                        : conflict.similarityScore >= 0.7
                          ? 'bg-yellow-500'
                          : 'bg-blue-500'
                  )}
                  style={{ width: `${similarityPercent}%` }}
                />
              </div>
              <span className="text-sm font-semibold">{similarityPercent}%</span>
            </div>
          </div>

          {conflict.matterId && (
            <a
              href={`/matters/${conflict.matterId}`}
              className="text-xs text-primary hover:underline"
            >
              View Matter →
            </a>
          )}
        </div>

        {conflict.matterTitle && (
          <div className="pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Matter
            </p>
            <p className="text-sm truncate" title={conflict.matterTitle}>
              {conflict.matterTitle}
            </p>
          </div>
        )}

        {conflict.clientName && (
          <div className="pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Client
            </p>
            <p className="text-sm truncate" title={conflict.clientName}>
              {conflict.clientName}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
