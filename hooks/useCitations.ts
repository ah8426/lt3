'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  extractCitations,
  type ExtractedCitation,
  type CitationVerification,
} from '@/lib/services/citation-checker'
import type { AIProvider } from '@/types/ai'

export interface UseCitationsOptions {
  text?: string
  sessionId?: string
  documentId?: string
  autoExtract?: boolean
  provider?: AIProvider
  model?: string
}

export interface UseCitationsReturn {
  citations: ExtractedCitation[]
  verifications: Map<string, CitationVerification>
  isExtracting: boolean
  isVerifying: boolean
  verificationProgress: { current: number; total: number } | null
  extractCitationsFromText: (text: string) => ExtractedCitation[]
  verifyCitation: (citation: ExtractedCitation) => Promise<void>
  verifyAllCitations: () => Promise<void>
  exportCitations: () => void
  getCitationVerification: (citationId: string) => CitationVerification | undefined
  stats: {
    total: number
    verified: number
    invalid: number
    unverified: number
  }
}

export function useCitations(options: UseCitationsOptions = {}): UseCitationsReturn {
  const { text, sessionId, documentId, autoExtract = true, provider, model } = options

  const queryClient = useQueryClient()

  const [citations, setCitations] = useState<ExtractedCitation[]>([])
  const [verifications, setVerifications] = useState<Map<string, CitationVerification>>(new Map())
  const [verificationProgress, setVerificationProgress] = useState<{
    current: number
    total: number
  } | null>(null)

  // Extract citations from text
  const extractCitationsFromText = useCallback((text: string): ExtractedCitation[] => {
    return extractCitations(text)
  }, [])

  // Auto-extract citations when text changes
  useEffect(() => {
    if (autoExtract && text) {
      const extracted = extractCitationsFromText(text)
      setCitations(extracted)
    }
  }, [text, autoExtract, extractCitationsFromText])

  // Fetch verification history from API
  const { data: verificationHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['citation-verifications', sessionId, documentId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (sessionId) params.append('sessionId', sessionId)
      if (documentId) params.append('documentId', documentId)

      const response = await fetch(`/api/citations/check?${params}`)
      if (!response.ok) throw new Error('Failed to fetch citation history')
      return response.json()
    },
    enabled: !!(sessionId || documentId),
  })

  // Load verification history into state
  useEffect(() => {
    if (verificationHistory?.citations) {
      const verificationMap = new Map<string, CitationVerification>()
      // TODO: Map database citations to verification objects
      setVerifications(verificationMap)
    }
  }, [verificationHistory])

  // Verify single citation mutation
  const verifySingleMutation = useMutation({
    mutationFn: async (citation: ExtractedCitation) => {
      const response = await fetch('/api/citations/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          citations: [citation],
          sessionId,
          provider,
          model,
          storeResults: !!sessionId,
        }),
      })

      if (!response.ok) {
        throw new Error('Citation verification failed')
      }

      return response.json()
    },
    onSuccess: (data, citation) => {
      if (data.verifications && data.verifications.length > 0) {
        setVerifications((prev) => {
          const next = new Map(prev)
          next.set(citation.id, data.verifications[0])
          return next
        })
      }
      queryClient.invalidateQueries({ queryKey: ['citation-verifications', sessionId] })
    },
  })

  // Verify all citations mutation
  const verifyAllMutation = useMutation({
    mutationFn: async () => {
      const unverifiedCitations = citations.filter((c) => !verifications.has(c.id))

      if (unverifiedCitations.length === 0) {
        throw new Error('All citations are already verified')
      }

      setVerificationProgress({ current: 0, total: unverifiedCitations.length })

      const response = await fetch('/api/citations/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          citations: unverifiedCitations,
          sessionId,
          provider,
          model,
          storeResults: !!sessionId,
        }),
      })

      if (!response.ok) {
        throw new Error('Batch verification failed')
      }

      return response.json()
    },
    onSuccess: (data) => {
      if (data.verifications) {
        setVerifications((prev) => {
          const next = new Map(prev)
          data.verifications.forEach((verification: CitationVerification, index: number) => {
            const citation = citations[index]
            if (citation) {
              next.set(citation.id, verification)
            }
          })
          return next
        })
      }
      setVerificationProgress(null)
      queryClient.invalidateQueries({ queryKey: ['citation-verifications', sessionId] })
    },
    onError: () => {
      setVerificationProgress(null)
    },
  })

  // Verify single citation
  const verifyCitation = useCallback(
    async (citation: ExtractedCitation) => {
      await verifySingleMutation.mutateAsync(citation)
    },
    [verifySingleMutation]
  )

  // Verify all citations
  const verifyAllCitations = useCallback(async () => {
    await verifyAllMutation.mutateAsync()
  }, [verifyAllMutation])

  // Export citations to CSV
  const exportCitations = useCallback(() => {
    const rows: string[][] = [
      ['Citation', 'Type', 'Jurisdiction', 'Status', 'Treatment', 'Format Correct', 'Currently Valid'],
    ]

    citations.forEach((citation) => {
      const verification = verifications.get(citation.id)
      rows.push([
        citation.text,
        citation.type,
        citation.jurisdiction || '',
        verification ? (verification.isValid ? 'Valid' : 'Invalid') : 'Unverified',
        verification?.treatmentStatus || '',
        verification ? (verification.isFormatCorrect ? 'Yes' : 'No') : '',
        verification ? (verification.isCurrentlyValid ? 'Yes' : 'No') : '',
      ])
    })

    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `citations-${sessionId || 'export'}-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [citations, verifications, sessionId])

  // Get verification for a specific citation
  const getCitationVerification = useCallback(
    (citationId: string): CitationVerification | undefined => {
      return verifications.get(citationId)
    },
    [verifications]
  )

  // Calculate statistics
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

  return {
    citations,
    verifications,
    isExtracting: false, // Extraction is synchronous
    isVerifying: verifySingleMutation.isPending || verifyAllMutation.isPending,
    verificationProgress,
    extractCitationsFromText,
    verifyCitation,
    verifyAllCitations,
    exportCitations,
    getCitationVerification,
    stats,
  }
}

/**
 * Hook to watch for citations in real-time as text changes
 */
export function useLiveCitationDetection(
  text: string,
  options?: {
    debounceMs?: number
    onCitationDetected?: (citations: ExtractedCitation[]) => void
  }
) {
  const [detectedCitations, setDetectedCitations] = useState<ExtractedCitation[]>([])

  useEffect(() => {
    const timer = setTimeout(() => {
      const citations = extractCitations(text)
      setDetectedCitations(citations)
      if (options?.onCitationDetected && citations.length > 0) {
        options.onCitationDetected(citations)
      }
    }, options?.debounceMs || 500)

    return () => clearTimeout(timer)
  }, [text, options])

  return { citations: detectedCitations }
}
