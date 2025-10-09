'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react'
import type { ConflictCheckResult } from '@/lib/conflicts/types'
import { RiskLevel, ConflictStatus } from '@/lib/conflicts/types'
import { ConflictCard } from './ConflictCard'
import { cn } from '@/lib/utils'

interface ConflictReportProps {
  result: ConflictCheckResult
  onResolve?: (status: ConflictStatus) => void | Promise<void>
  className?: string
}

const riskConfig = {
  critical: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    alertVariant: 'destructive' as const,
  },
  high: {
    icon: AlertTriangle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    alertVariant: 'destructive' as const,
  },
  medium: {
    icon: AlertCircle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    alertVariant: 'default' as const,
  },
  low: {
    icon: Info,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    alertVariant: 'default' as const,
  },
  none: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    alertVariant: 'default' as const,
  },
}

export function ConflictReport({ result, onResolve, className }: ConflictReportProps) {
  const risk = riskConfig[result.riskLevel as keyof typeof riskConfig]
  const RiskIcon = risk.icon

  const getRecommendationText = () => {
    switch (result.recommendation) {
      case 'decline':
        return 'Recommend declining this matter due to critical conflicts'
      case 'review':
        return 'Manual review required before proceeding'
      case 'proceed':
        return 'Safe to proceed with appropriate disclosures'
      default:
        return 'Review conflicts before proceeding'
    }
  }

  const getRecommendationColor = () => {
    switch (result.recommendation) {
      case 'decline':
        return 'text-red-600'
      case 'review':
        return 'text-yellow-600'
      case 'proceed':
        return 'text-green-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Summary Alert */}
      <Alert variant={risk.alertVariant} className={cn(risk.bgColor, risk.borderColor)}>
        <RiskIcon className={cn('h-5 w-5', risk.color)} />
        <AlertTitle className="text-lg font-semibold">
          {result.riskLevel === 'none'
            ? 'No Conflicts Detected'
            : `${result.riskLevel.charAt(0).toUpperCase() + result.riskLevel.slice(1)} Risk Conflicts Detected`}
        </AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-2">{result.summary}</p>
          <p className={cn('font-semibold', getRecommendationColor())}>
            {getRecommendationText()}
          </p>
        </AlertDescription>
      </Alert>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Total Matches</CardDescription>
            <CardTitle className="text-3xl font-bold">{result.totalMatches}</CardTitle>
          </CardHeader>
        </Card>

        <Card className={result.highRiskCount > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">High Risk</CardDescription>
            <CardTitle className={cn('text-3xl font-bold', result.highRiskCount > 0 && 'text-red-600')}>
              {result.highRiskCount}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className={result.mediumRiskCount > 0 ? 'border-yellow-200 bg-yellow-50' : ''}>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Medium Risk</CardDescription>
            <CardTitle className={cn('text-3xl font-bold', result.mediumRiskCount > 0 && 'text-yellow-600')}>
              {result.mediumRiskCount}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className={result.lowRiskCount > 0 ? 'border-blue-200 bg-blue-50' : ''}>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Low Risk</CardDescription>
            <CardTitle className={cn('text-3xl font-bold', result.lowRiskCount > 0 && 'text-blue-600')}>
              {result.lowRiskCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Resolution Actions */}
      {onResolve && result.conflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resolution Actions</CardTitle>
            <CardDescription>
              Choose how to handle these conflicts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="destructive"
                onClick={() => onResolve(ConflictStatus.DECLINED)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Decline Matter
              </Button>
              <Button
                variant="outline"
                onClick={() => onResolve(ConflictStatus.WAIVED)}
                className="border-yellow-500 text-yellow-700 hover:bg-yellow-50"
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Waive Conflicts
              </Button>
              <Button
                variant="outline"
                onClick={() => onResolve(ConflictStatus.CLEARED)}
                className="border-green-500 text-green-700 hover:bg-green-50"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark as Cleared
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conflict List */}
      {result.conflicts.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Detected Conflicts</h3>
            <Badge variant="outline">{result.conflicts.length} total</Badge>
          </div>
          <div className="space-y-4">
            {result.conflicts.map((conflict) => (
              <ConflictCard key={conflict.id} conflict={conflict} />
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <div>
                <CardTitle>No Conflicts Found</CardTitle>
                <CardDescription>
                  This matter appears to be clear of any conflicts of interest
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}
    </div>
  )
}
