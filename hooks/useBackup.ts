import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'

export interface Backup {
  id: string
  type: 'full' | 'matter' | 'session'
  scope: string
  scopeId?: string
  size: number
  checksum: string
  status: string
  encryptedWith?: string
  includesAudio: boolean
  includesDocuments: boolean
  metadata: any
  createdAt: string
  completedAt?: string
  lastRestoredAt?: string
  restoreCount: number
}

export interface CreateBackupParams {
  scope?: 'full' | 'matter' | 'session'
  scopeId?: string
  includeAudioFiles?: boolean
  includeDocuments?: boolean
  encrypt?: boolean
}

export interface RestoreBackupParams {
  backupId: string
  encryptionKey?: string
  verifyOnly?: boolean
  skipTables?: string[]
  overwriteExisting?: boolean
}

export interface UseBackupOptions {
  type?: string
  limit?: number
  offset?: number
}

export function useBackup(options?: UseBackupOptions) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch backups list
  const {
    data: backups,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['backups', options],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (options?.type) params.append('type', options.type)
      if (options?.limit) params.append('limit', options.limit.toString())
      if (options?.offset) params.append('offset', options.offset.toString())

      const response = await fetch(`/api/backups?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch backups')
      }

      const data = await response.json()
      return data.backups as Backup[]
    },
  })

  // Create backup mutation
  const createBackupMutation = useMutation({
    mutationFn: async (params: CreateBackupParams) => {
      const response = await fetch('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create backup')
      }

      return await response.json()
    },
    onSuccess: () => {
      toast({
        title: 'Backup Created',
        description: 'Your data has been successfully backed up',
      })
      queryClient.invalidateQueries({ queryKey: ['backups'] })
    },
    onError: (error: Error) => {
      toast({
        title: 'Backup Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // Delete backup mutation
  const deleteBackupMutation = useMutation({
    mutationFn: async (backupId: string) => {
      const response = await fetch(`/api/backups/${backupId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to delete backup')
      }

      return await response.json()
    },
    onSuccess: () => {
      toast({
        title: 'Backup Deleted',
        description: 'The backup has been successfully deleted',
      })
      queryClient.invalidateQueries({ queryKey: ['backups'] })
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // Restore backup mutation
  const restoreBackupMutation = useMutation({
    mutationFn: async (params: RestoreBackupParams) => {
      const { backupId, ...restoreParams } = params

      const response = await fetch(`/api/backups/${backupId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(restoreParams),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to restore backup')
      }

      return await response.json()
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: 'Restore Complete',
          description: `Restored ${data.restore.tablesRestored.length} tables successfully`,
        })
        queryClient.invalidateQueries({ queryKey: ['backups'] })
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Restore Failed',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  // Download backup
  const downloadBackup = async (backupId: string) => {
    try {
      const response = await fetch(
        `/api/backups/${backupId}?action=download`
      )

      if (!response.ok) {
        throw new Error('Failed to get download URL')
      }

      const data = await response.json()

      // Open download URL in new window
      window.open(data.downloadUrl, '_blank')

      toast({
        title: 'Download Started',
        description: 'Your backup is being downloaded',
      })
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  // Verify backup
  const verifyBackup = async (backupId: string, encryptionKey?: string) => {
    try {
      const params = new URLSearchParams({ action: 'verify' })
      if (encryptionKey) params.append('encryptionKey', encryptionKey)

      const response = await fetch(`/api/backups/${backupId}?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to verify backup')
      }

      const data = await response.json()

      if (data.verification.success) {
        toast({
          title: 'Verification Complete',
          description: 'Backup integrity verified successfully',
        })
      } else {
        toast({
          title: 'Verification Failed',
          description: data.verification.errors.join(', '),
          variant: 'destructive',
        })
      }

      return data.verification
    } catch (error) {
      toast({
        title: 'Verification Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
      throw error
    }
  }

  // Get restore preview
  const getRestorePreview = async (backupId: string, encryptionKey?: string) => {
    try {
      const params = new URLSearchParams({ action: 'preview' })
      if (encryptionKey) params.append('encryptionKey', encryptionKey)

      const response = await fetch(`/api/backups/${backupId}?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to get restore preview')
      }

      const data = await response.json()
      return data.preview
    } catch (error) {
      toast({
        title: 'Preview Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
      throw error
    }
  }

  return {
    // Data
    backups,
    isLoading,
    error,

    // Actions
    createBackup: (params: CreateBackupParams) =>
      createBackupMutation.mutateAsync(params),
    deleteBackup: (backupId: string) => deleteBackupMutation.mutateAsync(backupId),
    restoreBackup: (params: RestoreBackupParams) =>
      restoreBackupMutation.mutateAsync(params),
    downloadBackup,
    verifyBackup,
    getRestorePreview,
    refresh: () => refetch(),

    // Loading states
    isCreating: createBackupMutation.isPending,
    isDeleting: deleteBackupMutation.isPending,
    isRestoring: restoreBackupMutation.isPending,
  }
}
