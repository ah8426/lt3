/**
 * useConflicts Hook
 *
 * React hook for conflict checking with React Query
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import {
  ConflictCheckResult,
  ConflictStatus,
} from '@/lib/conflicts/conflict-checker'

export interface RunConflictCheckParams {
  clientName?: string
  adverseParties?: string[]
  companyNames?: string[]
  matterDescription?: string
  excludeMatterId?: string
  saveResult?: boolean
}

export interface UseConflictsOptions {
  conflictCheckId?: string
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export interface UseConflictsReturn {
  // Conflict check data
  conflictCheck: any | null
  isLoading: boolean
  error: Error | null

  // Mutations
  runConflictCheck: (params: RunConflictCheckParams) => Promise<ConflictCheckResult & { conflictCheckId?: string }>
  updateResolution: (status: ConflictStatus, notes?: string) => Promise<void>

  // Utilities
  refresh: () => void
}

/**
 * Main useConflicts hook
 */
export function useConflicts(options: UseConflictsOptions = {}): UseConflictsReturn {
  const { conflictCheckId, onSuccess, onError } = options
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const queryKey = ['conflict-check', conflictCheckId]

  // Fetch conflict check details
  const {
    data: conflictCheck = null,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!conflictCheckId) return null

      const response = await fetch(`/api/conflicts/${conflictCheckId}`)

      if (!response.ok) {
        throw new Error('Failed to fetch conflict check')
      }

      const data = await response.json()
      return data.conflictCheck
    },
    enabled: !!conflictCheckId,
  })

  // Run conflict check mutation
  const runConflictCheckMutation = useMutation({
    mutationFn: async (params: RunConflictCheckParams) => {
      const response = await fetch('/api/conflicts/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to run conflict check')
      }

      return await response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conflict-check'] })

      // Show appropriate toast based on risk level
      if (data.riskLevel === 'critical' || data.riskLevel === 'high') {
        toast({
          title: 'Conflicts Detected',
          description: data.summary,
          variant: 'destructive',
        })
      } else if (data.riskLevel === 'medium') {
        toast({
          title: 'Potential Conflicts',
          description: data.summary,
        })
      } else if (data.totalMatches > 0) {
        toast({
          title: 'Low-Risk Matches Found',
          description: data.summary,
        })
      } else {
        toast({
          title: 'No Conflicts',
          description: 'No conflicts detected. Safe to proceed.',
        })
      }

      onSuccess?.()
    },
    onError: (error: Error) => {
      toast({
        title: 'Conflict Check Failed',
        description: error.message,
        variant: 'destructive',
      })
      onError?.(error)
    },
  })

  // Update resolution mutation
  const updateResolutionMutation = useMutation({
    mutationFn: async ({ status, notes }: { status: ConflictStatus; notes?: string }) => {
      if (!conflictCheckId) {
        throw new Error('No conflict check ID provided')
      }

      const response = await fetch(`/api/conflicts/${conflictCheckId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      })

      if (!response.ok) {
        throw new Error('Failed to update conflict resolution')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      toast({
        title: 'Resolution Updated',
        description: 'Conflict resolution has been updated.',
      })
      onSuccess?.()
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      })
      onError?.(error)
    },
  })

  return {
    conflictCheck,
    isLoading,
    error: error as Error | null,
    runConflictCheck: (params) => runConflictCheckMutation.mutateAsync(params),
    updateResolution: (status, notes) =>
      updateResolutionMutation.mutateAsync({ status, notes }),
    refresh: () => refetch(),
  }
}

/**
 * Hook for fetching conflict history
 */
export function useConflictHistory(userId?: string) {
  return useQuery({
    queryKey: ['conflict-history', userId],
    queryFn: async () => {
      const response = await fetch('/api/conflicts/history')
      if (!response.ok) {
        throw new Error('Failed to fetch conflict history')
      }
      return await response.json()
    },
    enabled: !!userId,
  })
}
