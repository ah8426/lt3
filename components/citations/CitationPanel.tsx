'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Scale,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Download,
  Search,
  Filter,
} from 'lucide-react'
import { CitationBadge } from './CitationBadge'
import type { ExtractedCitation, CitationVerification } from '@/lib/services/citation-checker'

export interface CitationPanelProps {
  citations: ExtractedCitation[]
  verifications: Map<string, CitationVerification>
  onVerifyAll?: () => Promise<void>
  onVerifySingle?: (citation: ExtractedCitation) => Promise<void>
  onExport?: () => void
  isVerifying?: boolean
  verificationProgress?: { current: number; total: number }
}

export function CitationPanel({
  citations,
  verifications,
  onVerifyAll,
  onVerifySingle,
  onExport,
  isVerifying = false,
  verificationProgress,
}: CitationPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'verified' | 'invalid' | 'unverified'>(
    'all'
  )
  const [filterType, setFilterType] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Statistics
  const stats = useMemo(() => {
    const total = citations.length
    const verified = citations.filter((c) => {
      const v = verifications.get(c.id)
      return v && v.isValid && v.isCurrentlyValid
    }).length
    const invalid = citations.filter((c) => {
      const v = verifications.get(c.id)
      return v && (!v.isValid || !v.isCurrentlyValid)
    }).length
    const unverified = total - verified - invalid

    return { total, verified, invalid, unverified }
  }, [citations, verifications])

  // Filtered citations
  const filteredCitations = useMemo(() => {
    return citations.filter((citation) => {
      // Filter by status
      if (filterStatus !== 'all') {
        const verification = verifications.get(citation.id)
        if (filterStatus === 'verified') {
          if (!verification || !verification.isValid || !verification.isCurrentlyValid)
            return false
        } else if (filterStatus === 'invalid') {
          if (!verification || verification.isValid) return false
        } else if (filterStatus === 'unverified') {
          if (verification) return false
        }
      }

      // Filter by type
      if (filterType !== 'all' && citation.type !== filterType) {
        return false
      }

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          citation.text.toLowerCase().includes(query) ||
          citation.caseName?.toLowerCase().includes(query) ||
          citation.jurisdiction?.toLowerCase().includes(query)
        )
      }

      return true
    })
  }, [citations, verifications, filterStatus, filterType, searchQuery])

  // Get unique citation types
  const citationTypes = useMemo(() => {
    const types = new Set(citations.map((c) => c.type))
    return Array.from(types)
  }, [citations])

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Scale className="h-4 w-4" />
          Citations
          {stats.total > 0 && (
            <Badge variant="secondary" className="ml-1">
              {stats.total}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:w-[600px] sm:max-w-[600px]">
        <SheetHeader>
          <SheetTitle>Citation Verification</SheetTitle>
          <SheetDescription>
            AI-powered citation checking for legal accuracy
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Statistics */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-muted p-3 rounded-lg text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg text-center border border-green-200">
              <div className="text-2xl font-bold text-green-600">{stats.verified}</div>
              <div className="text-xs text-green-700">Verified</div>
            </div>
            <div className="bg-red-50 p-3 rounded-lg text-center border border-red-200">
              <div className="text-2xl font-bold text-red-600">{stats.invalid}</div>
              <div className="text-xs text-red-700">Invalid</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg text-center border border-gray-200">
              <div className="text-2xl font-bold text-gray-600">{stats.unverified}</div>
              <div className="text-xs text-gray-700">Unverified</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              onClick={onVerifyAll}
              disabled={isVerifying || stats.total === 0}
              className="flex-1"
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Verify All ({stats.unverified})
                </>
              )}
            </Button>
            <Button variant="outline" onClick={onExport} disabled={stats.total === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>

          {/* Verification Progress */}
          {isVerifying && verificationProgress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Verifying citation {verificationProgress.current} of {verificationProgress.total}
                </span>
                <span className="font-medium">
                  {Math.round((verificationProgress.current / verificationProgress.total) * 100)}%
                </span>
              </div>
              <Progress
                value={(verificationProgress.current / verificationProgress.total) * 100}
              />
            </div>
          )}

          {/* Filters */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search citations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Citations</SelectItem>
                  <SelectItem value="verified">Verified Only</SelectItem>
                  <SelectItem value="invalid">Invalid Only</SelectItem>
                  <SelectItem value="unverified">Unverified Only</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {citationTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Citations List */}
          <ScrollArea className="h-[calc(100vh-450px)]">
            <div className="space-y-3">
              {filteredCitations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {citations.length === 0 ? (
                    <>
                      <Scale className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p>No citations found in this document</p>
                    </>
                  ) : (
                    <p>No citations match the current filters</p>
                  )}
                </div>
              ) : (
                filteredCitations.map((citation) => {
                  const verification = verifications.get(citation.id)
                  return (
                    <div
                      key={citation.id}
                      className="border rounded-lg p-3 hover:bg-muted/50 transition-colors space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CitationBadge
                            citation={citation}
                            verification={verification}
                            showTooltip={false}
                            className="mb-2"
                          />
                          {citation.caseName && (
                            <div className="text-sm font-medium mt-1">{citation.caseName}</div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            {getCitationTypeLabel(citation.type)}
                            {citation.jurisdiction && ` • ${citation.jurisdiction}`}
                          </div>
                        </div>
                        {!verification && onVerifySingle && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onVerifySingle(citation)}
                            disabled={isVerifying}
                          >
                            Verify
                          </Button>
                        )}
                      </div>

                      {/* Verification Status */}
                      {verification && (
                        <div className="space-y-2 pt-2 border-t">
                          <div className="flex items-center gap-2 text-xs">
                            {verification.isValid ? (
                              <CheckCircle2 className="h-3 w-3 text-green-600" />
                            ) : (
                              <XCircle className="h-3 w-3 text-red-600" />
                            )}
                            <span
                              className={
                                verification.isValid ? 'text-green-600' : 'text-red-600'
                              }
                            >
                              {verification.isValid ? 'Valid' : 'Invalid'}
                            </span>
                            {verification.treatmentStatus && (
                              <>
                                <span className="text-muted-foreground">•</span>
                                <span className={getTreatmentColor(verification.treatmentStatus)}>
                                  {getTreatmentLabel(verification.treatmentStatus)}
                                </span>
                              </>
                            )}
                            {verification.confidence > 0 && (
                              <>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-muted-foreground">
                                  {verification.confidence}% confidence
                                </span>
                              </>
                            )}
                          </div>

                          {verification.bluebookFormat && (
                            <div className="text-xs">
                              <div className="text-muted-foreground mb-1">Bluebook:</div>
                              <div className="font-mono bg-muted p-2 rounded">
                                {verification.bluebookFormat}
                              </div>
                            </div>
                          )}

                          {verification.errors && verification.errors.length > 0 && (
                            <div className="text-xs text-red-600">
                              {verification.errors.join('; ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
    negative: 'Negative',
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
