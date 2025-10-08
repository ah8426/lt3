'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback } from 'react'

export interface Speaker {
  id: string
  sessionId: string
  speakerNumber: number
  name?: string
  role?: SpeakerRole
  organization?: string
  color?: string
  createdAt: Date
  updatedAt: Date
}

export type SpeakerRole =
  | 'attorney'
  | 'client'
  | 'witness'
  | 'expert'
  | 'judge'
  | 'court_reporter'
  | 'interpreter'
  | 'other'

export interface SpeakerStats {
  speakerId: string
  speakerNumber: number
  name?: string
  totalSegments: number
  totalWords: number
  speakingTimeMs: number
  averageConfidence: number
  firstAppearance: Date
  lastAppearance: Date
}

interface UseSpeakersOptions {
  sessionId: string
  includeStats?: boolean
  autoDetect?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
}

interface UseSpeakersReturn {
  // State
  speakers: Speaker[]
  stats: SpeakerStats[]
  isLoading: boolean
  error: Error | null

  // Actions
  createSpeaker: (data: {
    speakerNumber: number
    name?: string
    role?: SpeakerRole
    organization?: string
  }) => Promise<Speaker>
  updateSpeaker: (
    speakerId: string,
    data: Partial<Speaker>
  ) => Promise<Speaker>
  deleteSpeaker: (speakerId: string) => Promise<void>
  mergeSpeakers: (
    fromSpeakerId: string,
    toSpeakerId: string
  ) => Promise<void>

  // Utilities
  refresh: () => Promise<void>
  getSpeaker: (speakerId: string) => Speaker | undefined
  getSpeakerByNumber: (speakerNumber: number) => Speaker | undefined
  getSpeakerStats: (speakerId: string) => SpeakerStats | undefined
}

export function useSpeakers(options: UseSpeakersOptions): UseSpeakersReturn {
  const {
    sessionId,
    includeStats = true,
    autoDetect = false,
    autoRefresh = false,
    refreshInterval = 30000,
  } = options

  const queryClient = useQueryClient()
  const [error, setError] = useState<Error | null>(null)

  // Build query params
  const params = new URLSearchParams()
  if (includeStats) params.append('stats', 'true')
  if (autoDetect) params.append('autoDetect', 'true')

  // Fetch speakers
  const { data, isLoading } = useQuery({
    queryKey: ['speakers', sessionId, includeStats, autoDetect],
    queryFn: async () => {
      const response = await fetch(
        `/api/sessions/${sessionId}/speakers?${params.toString()}`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch speakers')
      }

      return response.json()
    },
    refetchInterval: autoRefresh ? refreshInterval : false,
    refetchOnWindowFocus: false,
  })

  const speakers: Speaker[] = data?.speakers || []
  const stats: SpeakerStats[] = data?.stats || []

  // Create speaker mutation
  const createSpeakerMutation = useMutation({
    mutationFn: async (speakerData: {
      speakerNumber: number
      name?: string
      role?: SpeakerRole
      organization?: string
    }) => {
      const response = await fetch(`/api/sessions/${sessionId}/speakers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(speakerData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create speaker')
      }

      const { speaker } = await response.json()
      return speaker
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speakers', sessionId] })
    },
    onError: (err) => setError(err as Error),
  })

  // Update speaker mutation
  const updateSpeakerMutation = useMutation({
    mutationFn: async ({
      speakerId,
      data,
    }: {
      speakerId: string
      data: Partial<Speaker>
    }) => {
      const response = await fetch(
        `/api/sessions/${sessionId}/speakers/${speakerId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update speaker')
      }

      const { speaker } = await response.json()
      return speaker
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speakers', sessionId] })
    },
    onError: (err) => setError(err as Error),
  })

  // Delete speaker mutation
  const deleteSpeakerMutation = useMutation({
    mutationFn: async (speakerId: string) => {
      const response = await fetch(
        `/api/sessions/${sessionId}/speakers/${speakerId}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete speaker')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speakers', sessionId] })
    },
    onError: (err) => setError(err as Error),
  })

  // Merge speakers mutation
  const mergeSpeakersMutation = useMutation({
    mutationFn: async ({
      fromSpeakerId,
      toSpeakerId,
    }: {
      fromSpeakerId: string
      toSpeakerId: string
    }) => {
      const response = await fetch(
        `/api/sessions/${sessionId}/speakers/${fromSpeakerId}/merge`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetSpeakerId: toSpeakerId }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to merge speakers')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speakers', sessionId] })
      // Also invalidate transcript segments since they changed
      queryClient.invalidateQueries({ queryKey: ['segments', sessionId] })
    },
    onError: (err) => setError(err as Error),
  })

  // Refresh speakers
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['speakers', sessionId] })
  }, [queryClient, sessionId])

  // Get speaker by ID
  const getSpeaker = useCallback(
    (speakerId: string) => {
      return speakers.find((s) => s.id === speakerId)
    },
    [speakers]
  )

  // Get speaker by number
  const getSpeakerByNumber = useCallback(
    (speakerNumber: number) => {
      return speakers.find((s) => s.speakerNumber === speakerNumber)
    },
    [speakers]
  )

  // Get speaker statistics
  const getSpeakerStats = useCallback(
    (speakerId: string) => {
      return stats.find((s) => s.speakerId === speakerId)
    },
    [stats]
  )

  return {
    // State
    speakers,
    stats,
    isLoading,
    error,

    // Actions
    createSpeaker: createSpeakerMutation.mutateAsync,
    updateSpeaker: (speakerId, data) =>
      updateSpeakerMutation.mutateAsync({ speakerId, data }),
    deleteSpeaker: deleteSpeakerMutation.mutateAsync,
    mergeSpeakers: (fromSpeakerId, toSpeakerId) =>
      mergeSpeakersMutation.mutateAsync({ fromSpeakerId, toSpeakerId }),

    // Utilities
    refresh,
    getSpeaker,
    getSpeakerByNumber,
    getSpeakerStats,
  }
}
