'use client'

import { useState, useMemo } from 'react'
import { Redaction, useRedaction } from '@/hooks/useRedaction'
import { PIIType, PIIMatch, getRedactionLabel } from '@/lib/redaction/pii-detector'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Shield,
  Search,
  Trash2,
  Eye,
  Download,
  Scan,
  Filter,
  AlertCircle,
  CheckCircle2,
  Lock,
  Unlock,
} from 'lucide-react'
import { format } from 'date-fns'

export interface RedactionPanelProps {
  sessionId: string
  transcriptText?: string
  onDetectComplete?: (matches: PIIMatch[]) => void
  onBulkRedact?: (matches: PIIMatch[]) => void
}

export function RedactionPanel({
  sessionId,
  transcriptText,
  onDetectComplete,
  onBulkRedact,
}: RedactionPanelProps) {
  const [selectedType, setSelectedType] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [isDetecting, setIsDetecting] = useState(false)
  const [detectedMatches, setDetectedMatches] = useState<PIIMatch[]>([])

  const {
    redactions,
    isLoading,
    detectPII,
    deleteRedaction,
    unredact,
    createBulkRedactions,
  } = useRedaction({ sessionId })

  // Filter redactions
  const filteredRedactions = useMemo(() => {
    let filtered = redactions

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter((r) => r.piiType === selectedType)
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (r) =>
          r.redactedText.toLowerCase().includes(query) ||
          r.reason?.toLowerCase().includes(query) ||
          r.piiType.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [redactions, selectedType, searchQuery])

  // Get statistics
  const stats = useMemo(() => {
    const byType: Record<string, number> = {}

    redactions.forEach((r) => {
      byType[r.piiType] = (byType[r.piiType] || 0) + 1
    })

    return {
      total: redactions.length,
      byType,
    }
  }, [redactions])

  // Handle auto-detect PII
  const handleAutoDetect = async () => {
    if (!transcriptText) return

    setIsDetecting(true)
    try {
      const matches = await detectPII({
        text: transcriptText,
        options: {
          includeNames: true,
          includeAddresses: true,
          includeEmails: true,
          includePhones: true,
          includeFinancial: true,
          includeDates: true,
          minConfidence: 0.75,
        },
      })

      setDetectedMatches(matches)
      onDetectComplete?.(matches)
    } catch (error) {
      console.error('Failed to detect PII:', error)
    } finally {
      setIsDetecting(false)
    }
  }

  // Handle bulk redaction
  const handleBulkRedact = async () => {
    if (detectedMatches.length === 0) return

    try {
      await createBulkRedactions(detectedMatches)
      setDetectedMatches([])
      onBulkRedact?.(detectedMatches)
    } catch (error) {
      console.error('Failed to create bulk redactions:', error)
    }
  }

  // Handle delete
  const handleDelete = async (redactionId: string) => {
    try {
      await deleteRedaction(redactionId)
      setDeleteConfirm(null)
    } catch (error) {
      console.error('Failed to delete redaction:', error)
    }
  }

  // Handle unredact
  const handleUnredact = async (redactionId: string, reason: string) => {
    try {
      return await unredact(redactionId, reason)
    } catch (error) {
      console.error('Failed to unredact:', error)
      throw error
    }
  }

  // Export redactions report
  const handleExport = () => {
    const report = redactions.map((r) => ({
      type: getRedactionLabel(r.piiType as PIIType),
      redactedText: r.redactedText,
      reason: r.reason || 'N/A',
      legalBasis: r.legalBasis || 'N/A',
      createdAt: format(new Date(r.createdAt), 'PPpp'),
    }))

    const csv = [
      ['Type', 'Redacted Text', 'Reason', 'Legal Basis', 'Created At'],
      ...report.map((r) => [
        r.type,
        r.redactedText,
        r.reason,
        r.legalBasis,
        r.createdAt,
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `redactions-${sessionId}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Redactions
              </CardTitle>
              <CardDescription>
                Manage protected information in this transcript
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-lg px-3 py-1">
              {stats.total}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.byType).map(([type, count]) => (
              <div key={type} className="flex flex-col">
                <span className="text-2xl font-bold">{count}</span>
                <span className="text-xs text-muted-foreground">
                  {getRedactionLabel(type as PIIType)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Auto-Detect PII */}
      {transcriptText && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Auto-Detect PII</CardTitle>
            <CardDescription>
              Automatically scan the transcript for personally identifiable information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={handleAutoDetect}
                disabled={isDetecting}
                className="flex-1"
              >
                <Scan className="h-4 w-4 mr-2" />
                {isDetecting ? 'Scanning...' : 'Scan for PII'}
              </Button>
              {detectedMatches.length > 0 && (
                <Button
                  onClick={handleBulkRedact}
                  variant="destructive"
                >
                  Redact All ({detectedMatches.length})
                </Button>
              )}
            </div>

            {detectedMatches.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Found {detectedMatches.length} potential PII matches:
                </p>
                <ScrollArea className="h-32 border rounded-md p-2">
                  {detectedMatches.map((match, index) => (
                    <div key={index} className="flex items-center justify-between py-1">
                      <span className="text-sm">
                        <Badge variant="outline" className="mr-2">
                          {getRedactionLabel(match.type)}
                        </Badge>
                        {match.text}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(match.confidence * 100)}%
                      </span>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filters and Actions */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search redactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Type Filter */}
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-full md:w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value={PIIType.SSN}>SSN</SelectItem>
            <SelectItem value={PIIType.CREDIT_CARD}>Credit Card</SelectItem>
            <SelectItem value={PIIType.EMAIL}>Email</SelectItem>
            <SelectItem value={PIIType.PHONE}>Phone</SelectItem>
            <SelectItem value={PIIType.ADDRESS}>Address</SelectItem>
            <SelectItem value={PIIType.NAME}>Name</SelectItem>
            <SelectItem value={PIIType.DATE_OF_BIRTH}>DOB</SelectItem>
          </SelectContent>
        </Select>

        {/* Export */}
        <Button variant="outline" onClick={handleExport} disabled={redactions.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Redactions List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Redaction List ({filteredRedactions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading redactions...
            </div>
          ) : filteredRedactions.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {searchQuery || selectedType !== 'all'
                  ? 'No redactions match your filters'
                  : 'No redactions yet'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {filteredRedactions.map((redaction) => (
                  <div
                    key={redaction.id}
                    className="p-4 border rounded-lg hover:border-primary transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {getRedactionLabel(redaction.piiType as PIIType)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(redaction.createdAt), 'PPp')}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm(redaction.id)}
                          className="h-7 px-2"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-sm font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded mb-2">
                      {redaction.redactedText}
                    </p>

                    {redaction.reason && (
                      <p className="text-xs text-muted-foreground mb-1">
                        <AlertCircle className="h-3 w-3 inline mr-1" />
                        {redaction.reason}
                      </p>
                    )}

                    {redaction.legalBasis && (
                      <p className="text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 inline mr-1" />
                        {redaction.legalBasis}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Redaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the redaction. The original text will remain encrypted
              but the redaction marker will be removed from the transcript.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
