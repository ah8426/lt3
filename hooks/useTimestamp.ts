'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface TimestampProof {
  id: string
  segmentId: string
  contentHash: string
  timestamp: Date
  timestampSource: 'ntp' | 'local'
  nonce: string
  signature: string
  isVerified: boolean
  verifiedAt?: Date
  ntpServer?: string
  ntpOffsetMs?: number
  ntpRoundTripMs?: number
  segment?: {
    text: string
    startTime: number
    endTime: number
  }
}

interface VerificationResult {
  isValid: boolean
  proofId: string
  segmentId: string
  checks: {
    contentMatch: boolean
    timestampValid: boolean
    signatureValid: boolean
  }
  errors: string[]
  warnings: string[]
  verifiedAt: Date
}

interface ChainVerificationResult {
  isValid: boolean
  sessionId: string
  proofCount: number
  verifiedCount: number
  chainIntegrity: boolean
  results: VerificationResult[]
  errors: string[]
}

interface UseTimestampOptions {
  sessionId?: string
  segmentId?: string
  autoRefresh?: boolean
  refreshInterval?: number
}

interface UseTimestampReturn {
  // State
  proofs: TimestampProof[]
  isLoading: boolean
  error: Error | null

  // Single proof operations
  generateProof: (params: {
    segmentId: string
    useMultipleSamples?: boolean
  }) => Promise<TimestampProof>
  verifyProof: (proofId: string) => Promise<VerificationResult>
  deleteProof: (proofId: string) => Promise<void>

  // Bulk operations
  generateBulkProofs: (segmentIds: string[]) => Promise<{
    successful: TimestampProof[]
    failed: Array<{ segmentId: string; error: string }>
  }>
  verifyBulkProofs: (proofIds: string[]) => Promise<VerificationResult[]>
  deleteBulkProofs: (proofIds: string[]) => Promise<void>

  // Chain operations
  verifyChain: () => Promise<ChainVerificationResult>
  exportChain: (format?: 'json' | 'pdf') => Promise<Blob>

  // Utilities
  refresh: () => Promise<void>
  getProofById: (proofId: string) => TimestampProof | undefined
}

export function useTimestamp(options: UseTimestampOptions = {}): UseTimestampReturn {
  const { sessionId, segmentId, autoRefresh = false, refreshInterval = 30000 } = options
  const queryClient = useQueryClient()
  const [error, setError] = useState<Error | null>(null)

  // Fetch proofs for session or segment
  const { data: proofs = [], isLoading } = useQuery({
    queryKey: ['timestamp-proofs', sessionId, segmentId],
    queryFn: async () => {
      if (segmentId) {
        // Fetch single proof for segment
        const response = await fetch(`/api/timestamp/proofs?segmentId=${segmentId}`)
        if (!response.ok) throw new Error('Failed to fetch timestamp proof')
        const data = await response.json()
        return data.proofs ? [data.proofs] : []
      } else if (sessionId) {
        // Fetch all proofs for session
        const response = await fetch(`/api/timestamp/proofs?sessionId=${sessionId}`)
        if (!response.ok) throw new Error('Failed to fetch timestamp proofs')
        const data = await response.json()
        return data.proofs || []
      }
      return []
    },
    enabled: Boolean(sessionId || segmentId),
    refetchInterval: autoRefresh ? refreshInterval : false,
    refetchOnWindowFocus: false,
  })

  // Generate single proof
  const generateProofMutation = useMutation({
    mutationFn: async (params: { segmentId: string; useMultipleSamples?: boolean }) => {
      const response = await fetch('/api/timestamp/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segmentId: params.segmentId,
          useMultipleSamples: params.useMultipleSamples,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate timestamp proof')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timestamp-proofs'] })
    },
    onError: (err) => setError(err as Error),
  })

  // Generate bulk proofs
  const generateBulkProofsMutation = useMutation({
    mutationFn: async (segmentIds: string[]) => {
      const response = await fetch('/api/timestamp/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segmentIds }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate bulk timestamp proofs')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timestamp-proofs'] })
    },
    onError: (err) => setError(err as Error),
  })

  // Verify single proof
  const verifyProofMutation = useMutation({
    mutationFn: async (proofId: string) => {
      const response = await fetch(`/api/timestamp/verify/${proofId}`, {
        method: 'POST',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to verify timestamp proof')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timestamp-proofs'] })
    },
    onError: (err) => setError(err as Error),
  })

  // Verify bulk proofs
  const verifyBulkProofsMutation = useMutation({
    mutationFn: async (proofIds: string[]) => {
      const results = await Promise.all(
        proofIds.map(async (proofId) => {
          const response = await fetch(`/api/timestamp/verify/${proofId}`, {
            method: 'POST',
          })
          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || `Failed to verify proof ${proofId}`)
          }
          return response.json()
        })
      )
      return results
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timestamp-proofs'] })
    },
    onError: (err) => setError(err as Error),
  })

  // Delete proof
  const deleteProofMutation = useMutation({
    mutationFn: async (proofId: string) => {
      const response = await fetch(`/api/timestamp/proofs/${proofId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete timestamp proof')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timestamp-proofs'] })
    },
    onError: (err) => setError(err as Error),
  })

  // Delete bulk proofs
  const deleteBulkProofsMutation = useMutation({
    mutationFn: async (proofIds: string[]) => {
      await Promise.all(
        proofIds.map(async (proofId) => {
          const response = await fetch(`/api/timestamp/proofs/${proofId}`, {
            method: 'DELETE',
          })
          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || `Failed to delete proof ${proofId}`)
          }
        })
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timestamp-proofs'] })
    },
    onError: (err) => setError(err as Error),
  })

  // Verify chain of custody
  const verifyChain = useCallback(async (): Promise<ChainVerificationResult> => {
    if (!sessionId) {
      throw new Error('Session ID required for chain verification')
    }

    const response = await fetch(`/api/timestamp/verify/${sessionId}?chain=true`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to verify chain of custody')
    }

    return response.json()
  }, [sessionId])

  // Export chain
  const exportChain = useCallback(
    async (format: 'json' | 'pdf' = 'json'): Promise<Blob> => {
      if (!sessionId) {
        throw new Error('Session ID required for chain export')
      }

      const response = await fetch(`/api/timestamp/export/${sessionId}?format=${format}`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to export chain of custody')
      }

      return response.blob()
    },
    [sessionId]
  )

  // Refresh proofs
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['timestamp-proofs', sessionId, segmentId] })
  }, [queryClient, sessionId, segmentId])

  // Get proof by ID
  const getProofById = useCallback(
    (proofId: string) => {
      return proofs.find((p: any) => p.id === proofId)
    },
    [proofs]
  )

  return {
    // State
    proofs,
    isLoading,
    error,

    // Single proof operations
    generateProof: generateProofMutation.mutateAsync,
    verifyProof: verifyProofMutation.mutateAsync,
    deleteProof: deleteProofMutation.mutateAsync,

    // Bulk operations
    generateBulkProofs: generateBulkProofsMutation.mutateAsync,
    verifyBulkProofs: verifyBulkProofsMutation.mutateAsync,
    deleteBulkProofs: deleteBulkProofsMutation.mutateAsync,

    // Chain operations
    verifyChain,
    exportChain,

    // Utilities
    refresh,
    getProofById,
  }
}
