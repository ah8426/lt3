/**
 * useRedaction Hook
 *
 * React hook for managing redactions with React Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { PIIType, PIIMatch, DetectPIIOptions } from '@/lib/redaction/pii-detector'

export interface Redaction {
  id: string
  sessionId: string
  segmentId: string | null
  encryptedOriginal: string
  redactedText: string
  piiType: PIIType
  startOffset: number
  endOffset: number
  reason: string | null
  legalBasis: string | null
  createdBy: string
  createdAt: Date
  accessControl: string[]
}

export interface CreateRedactionParams {
  segmentId?: string
  originalText: string
  redactedText: string
  piiType: PIIType
  startOffset: number
  endOffset: number
  reason?: string
  legalBasis?: string
  accessControl?: string[]
}

export interface DetectPIIParams {
  text: string
  options?: DetectPIIOptions
}

export interface UseRedactionOptions {
  sessionId: string
  segmentId?: string
  piiType?: PIIType
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export interface UseRedactionReturn {
  // Data
  redactions: Redaction[]
  isLoading: boolean
  error: Error | null

  // Mutations
  detectPII: (params: DetectPIIParams) => Promise<PIIMatch[]>
  createRedaction: (params: CreateRedactionParams) => Promise<Redaction>
  unredact: (redactionId: string, reason: string) => Promise<string>
  deleteRedaction: (redactionId: string) => Promise<void>
  updateAccess: (redactionId: string, accessControl: string[]) => Promise<Redaction>

  // Bulk operations
  createBulkRedactions: (matches: PIIMatch[]) => Promise<Redaction[]>

  // Utilities
  refresh: () => void
}

/**
 * Main useRedaction hook
 */
export function useRedaction(options: UseRedactionOptions): UseRedactionReturn {
  const { sessionId, segmentId, piiType, onSuccess, onError } = options
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const queryKey = ['redactions', sessionId, segmentId, piiType]

  // Fetch redactions
  const {
    data: redactions = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Redaction[]>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (segmentId) params.append('segmentId', segmentId)
      if (piiType) params.append('piiType', piiType)

      const response = await fetch(
        `/api/sessions/${sessionId}/redactions?${params.toString()}`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch redactions')
      }

      const data = await response.json()
      return data.redactions
    },
    enabled: !!sessionId,
  })

  // Detect PII mutation
  const detectPIIMutation = useMutation({
    mutationFn: async (params: DetectPIIParams) => {
      const response = await fetch(`/api/sessions/${sessionId}/redactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'detect',
          text: params.text,
          options: params.options,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to detect PII')
      }

      const data = await response.json()
      return data.matches as PIIMatch[]
    },
    onError: (error: Error) => {
      toast({
        title: 'PII Detection Failed',
        description: error.message,
        variant: 'destructive',
      })
      onError?.(error)
    },
  })

  // Create redaction mutation
  const createRedactionMutation = useMutation({
    mutationFn: async (params: CreateRedactionParams) => {
      const response = await fetch(`/api/sessions/${sessionId}/redactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        throw new Error('Failed to create redaction')
      }

      const data = await response.json()
      return data.redaction as Redaction
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      toast({
        title: 'Redaction Created',
        description: 'Content has been successfully redacted',
      })
      onSuccess?.()
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Create Redaction',
        description: error.message,
        variant: 'destructive',
      })
      onError?.(error)
    },
  })

  // Unredact mutation
  const unredactMutation = useMutation({
    mutationFn: async ({ redactionId, reason }: { redactionId: string; reason: string }) => {
      const response = await fetch(
        `/api/sessions/${sessionId}/redactions/${redactionId}/unredact`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to unredact')
      }

      const data = await response.json()
      return data.originalText as string
    },
    onSuccess: () => {
      toast({
        title: 'Content Unredacted',
        description: 'Original content has been restored',
      })
      onSuccess?.()
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Unredact',
        description: error.message,
        variant: 'destructive',
      })
      onError?.(error)
    },
  })

  // Delete redaction mutation
  const deleteRedactionMutation = useMutation({
    mutationFn: async (redactionId: string) => {
      const response = await fetch(
        `/api/sessions/${sessionId}/redactions/${redactionId}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        throw new Error('Failed to delete redaction')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      toast({
        title: 'Redaction Deleted',
        description: 'Redaction has been removed',
      })
      onSuccess?.()
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Delete Redaction',
        description: error.message,
        variant: 'destructive',
      })
      onError?.(error)
    },
  })

  // Update access control mutation
  const updateAccessMutation = useMutation({
    mutationFn: async ({
      redactionId,
      accessControl,
    }: {
      redactionId: string
      accessControl: string[]
    }) => {
      const response = await fetch(
        `/api/sessions/${sessionId}/redactions/${redactionId}/unredact`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'updateAccess', accessControl }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to update access control')
      }

      const data = await response.json()
      return data.redaction as Redaction
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      toast({
        title: 'Access Control Updated',
        description: 'Redaction access permissions have been updated',
      })
      onSuccess?.()
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Update Access',
        description: error.message,
        variant: 'destructive',
      })
      onError?.(error)
    },
  })

  // Bulk create redactions
  const createBulkRedactions = async (matches: PIIMatch[]): Promise<Redaction[]> => {
    const results: Redaction[] = []

    for (const match of matches) {
      try {
        const redaction = await createRedactionMutation.mutateAsync({
          originalText: match.text,
          redactedText: `[REDACTED: ${match.type.toUpperCase()}]`,
          piiType: match.type,
          startOffset: match.start,
          endOffset: match.end,
          reason: `Auto-detected PII (${(match.confidence * 100).toFixed(0)}% confidence)`,
        })
        results.push(redaction)
      } catch (error) {
        console.error(`Failed to create redaction for ${match.type}:`, error)
      }
    }

    return results
  }

  return {
    redactions,
    isLoading,
    error: error as Error | null,
    detectPII: (params) => detectPIIMutation.mutateAsync(params),
    createRedaction: (params) => createRedactionMutation.mutateAsync(params),
    unredact: (redactionId, reason) => unredactMutation.mutateAsync({ redactionId, reason }),
    deleteRedaction: (redactionId) => deleteRedactionMutation.mutateAsync(redactionId),
    updateAccess: (redactionId, accessControl) =>
      updateAccessMutation.mutateAsync({ redactionId, accessControl }),
    createBulkRedactions,
    refresh: () => refetch(),
  }
}
