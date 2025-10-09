'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Calendar, User, FileText, Loader2, Save } from 'lucide-react'
import { ConflictReport } from '@/components/conflicts/ConflictReport'
import { useConflicts } from '@/hooks/useConflicts'
import { ConflictStatus } from '@/lib/conflicts/types'
import { format } from 'date-fns'

const statusConfig = {
  pending: {
    label: 'Pending Review',
    color: 'bg-yellow-500',
  },
  waived: {
    label: 'Conflict Waived',
    color: 'bg-blue-500',
  },
  declined: {
    label: 'Matter Declined',
    color: 'bg-red-500',
  },
  screened: {
    label: 'Screened',
    color: 'bg-purple-500',
  },
  cleared: {
    label: 'Cleared',
    color: 'bg-green-500',
  },
}

export default function ConflictDetailPage() {
  const params = useParams()
  const router = useRouter()
  const conflictCheckId = params.id as string

  const [resolutionNotes, setResolutionNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const { conflictCheck, isLoading, updateResolution, refresh } = useConflicts({
    conflictCheckId,
  })

  useEffect(() => {
    if (conflictCheck?.resolutionNotes) {
      setResolutionNotes(conflictCheck.resolutionNotes)
    }
  }, [conflictCheck])

  const handleResolve = async (status: ConflictStatus) => {
    setIsSaving(true)
    try {
      await updateResolution(status, resolutionNotes.trim() || undefined)
      await refresh()
    } catch (error) {
      console.error('Failed to update resolution:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveNotes = async () => {
    if (!conflictCheck) return
    setIsSaving(true)
    try {
      await updateResolution(conflictCheck.status as ConflictStatus, resolutionNotes.trim() || undefined)
      await refresh()
    } catch (error) {
      console.error('Failed to save notes:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!conflictCheck) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">Conflict check not found</p>
            <Button
              variant="outline"
              onClick={() => router.push('/conflicts')}
              className="mt-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Conflicts
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const statusInfo = statusConfig[conflictCheck.status as keyof typeof statusConfig]

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => router.push('/conflicts')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Conflicts
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Conflict Check Details</h1>
            <p className="text-muted-foreground">
              Review and manage this conflict of interest check
            </p>
          </div>
          <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Conflict Report */}
          <ConflictReport
            result={{
              conflicts: conflictCheck.conflicts || [],
              riskLevel: conflictCheck.riskLevel,
              totalMatches: conflictCheck.totalMatches,
              highRiskCount: conflictCheck.highRiskCount,
              mediumRiskCount: conflictCheck.mediumRiskCount,
              lowRiskCount: conflictCheck.lowRiskCount,
              recommendation: conflictCheck.recommendation,
              summary: conflictCheck.summary,
            }}
            onResolve={handleResolve}
          />

          {/* Resolution Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Resolution Notes</CardTitle>
              <CardDescription>
                Document the reasoning and actions taken for this conflict check
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resolutionNotes">Notes</Label>
                <Textarea
                  id="resolutionNotes"
                  placeholder="Enter notes about how this conflict was resolved or screened..."
                  rows={6}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                />
              </div>
              <Button
                onClick={handleSaveNotes}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Notes
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Check Information */}
          <Card>
            <CardHeader>
              <CardTitle>Check Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Created:</span>
                </div>
                <p className="text-sm font-medium">
                  {format(new Date(conflictCheck.createdAt), 'PPp')}
                </p>
              </div>

              {conflictCheck.resolvedAt && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Resolved:</span>
                  </div>
                  <p className="text-sm font-medium">
                    {format(new Date(conflictCheck.resolvedAt), 'PPp')}
                  </p>
                </div>
              )}

              <Separator />

              {conflictCheck.clientName && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Client:</span>
                  </div>
                  <p className="text-sm font-medium">{conflictCheck.clientName}</p>
                </div>
              )}

              {conflictCheck.adverseParties && conflictCheck.adverseParties.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Adverse Parties:</span>
                  </div>
                  <ul className="text-sm space-y-1">
                    {conflictCheck.adverseParties.map((party: string, index: number) => (
                      <li key={index} className="font-medium">
                        • {party}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {conflictCheck.matterDescription && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Description:</span>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {conflictCheck.matterDescription.substring(0, 150)}
                    {conflictCheck.matterDescription.length > 150 && '...'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit Trail */}
          {conflictCheck.resolvedBy && (
            <Card>
              <CardHeader>
                <CardTitle>Audit Trail</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Resolved by:</span>
                  <p className="font-medium">{conflictCheck.resolvedBy}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
