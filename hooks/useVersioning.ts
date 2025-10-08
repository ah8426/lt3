import { useState, useCallback } from 'react'
import { useToast } from './use-toast'

interface Version {
  id: string
  version: number
  changeType: string
  changedBy: string
  changeReason?: string
  diffSummary?: {
    added: number
    removed: number
    modified: number
  }
  createdAt: string
  segments: any[]
}

interface ComparisonResult {
  fromVersion: Version
  toVersion: Version
  diff: {
    added: number
    removed: number
    modified: number
  }
  segmentDiff: {
    summary: {
      added: number
      removed: number
      modified: number
      unchanged: number
    }
    segments: Array<{
      segmentId: string
      type: 'added' | 'removed' | 'modified' | 'unchanged'
      oldText?: string
      newText?: string
      startMs: number
      endMs: number
      changes?: Array<{
        type: 'added' | 'removed' | 'unchanged'
        value: string
      }>
    }>
  }
}

export function useVersioning(sessionId: string) {
  const [versions, setVersions] = useState<Version[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [comparison, setComparison] = useState<ComparisonResult | null>(null)
  const { toast } = useToast()

  /**
   * Fetch version history
   */
  const fetchVersions = useCallback(
    async (limit = 50, offset = 0) => {
      setIsLoading(true)
      try {
        const response = await fetch(
          `/api/sessions/${sessionId}/versions?limit=${limit}&offset=${offset}`
        )

        if (!response.ok) {
          throw new Error('Failed to fetch versions')
        }

        const data = await response.json()
        setVersions(data.versions)
        return data
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to load version history',
          variant: 'destructive',
        })
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [sessionId, toast]
  )

  /**
   * Create a new version
   */
  const createVersion = useCallback(
    async (params: {
      changeType:
        | 'manual_save'
        | 'auto_save'
        | 'segment_edit'
        | 'segment_add'
        | 'segment_delete'
        | 'restore'
        | 'pre_export'
        | 'pre_share'
      changeReason?: string
      segmentIds?: string[]
    }) => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/versions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params),
        })

        if (!response.ok) {
          throw new Error('Failed to create version')
        }

        const version = await response.json()

        // Refresh version list
        await fetchVersions()

        toast({
          title: 'Version Created',
          description: `Version ${version.version} has been created`,
        })

        return version
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to create version',
          variant: 'destructive',
        })
        throw error
      }
    },
    [sessionId, toast, fetchVersions]
  )

  /**
   * Get a specific version
   */
  const getVersion = useCallback(
    async (versionNumber: number) => {
      try {
        const response = await fetch(
          `/api/sessions/${sessionId}/versions/${versionNumber}`
        )

        if (!response.ok) {
          throw new Error('Failed to fetch version')
        }

        return await response.json()
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to load version',
          variant: 'destructive',
        })
        throw error
      }
    },
    [sessionId, toast]
  )

  /**
   * Compare two versions
   */
  const compareVersions = useCallback(
    async (fromVersion: number, toVersion: number) => {
      setIsLoading(true)
      try {
        const response = await fetch(
          `/api/sessions/${sessionId}/versions/${toVersion}?compare=${fromVersion}`
        )

        if (!response.ok) {
          throw new Error('Failed to compare versions')
        }

        const result = await response.json()
        setComparison(result)
        return result
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to compare versions',
          variant: 'destructive',
        })
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [sessionId, toast]
  )

  /**
   * Restore a previous version
   */
  const restoreVersion = useCallback(
    async (versionNumber: number, reason?: string) => {
      try {
        const response = await fetch(
          `/api/sessions/${sessionId}/versions/${versionNumber}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reason }),
          }
        )

        if (!response.ok) {
          throw new Error('Failed to restore version')
        }

        const restoredVersion = await response.json()

        // Refresh version list
        await fetchVersions()

        toast({
          title: 'Version Restored',
          description: `Successfully restored to version ${versionNumber}`,
        })

        return restoredVersion
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to restore version',
          variant: 'destructive',
        })
        throw error
      }
    },
    [sessionId, toast, fetchVersions]
  )

  /**
   * Auto-save current state
   */
  const autoSave = useCallback(async () => {
    try {
      return await createVersion({
        changeType: 'auto_save',
        changeReason: 'Automatic save',
      })
    } catch (error) {
      // Silent fail for auto-save
      console.error('Auto-save failed:', error)
      return null
    }
  }, [createVersion])

  /**
   * Save before export
   */
  const saveBeforeExport = useCallback(async () => {
    return await createVersion({
      changeType: 'pre_export',
      changeReason: 'Saved before export',
    })
  }, [createVersion])

  /**
   * Save before share
   */
  const saveBeforeShare = useCallback(async () => {
    return await createVersion({
      changeType: 'pre_share',
      changeReason: 'Saved before sharing',
    })
  }, [createVersion])

  /**
   * Clear comparison
   */
  const clearComparison = useCallback(() => {
    setComparison(null)
  }, [])

  return {
    versions,
    isLoading,
    comparison,
    fetchVersions,
    createVersion,
    getVersion,
    compareVersions,
    restoreVersion,
    autoSave,
    saveBeforeExport,
    saveBeforeShare,
    clearComparison,
  }
}
