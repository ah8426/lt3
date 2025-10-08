'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import {
  Download,
  MoreVertical,
  Trash2,
  RefreshCw,
  Shield,
  HardDrive,
  Calendar,
  CheckCircle2,
} from 'lucide-react'
import { format } from 'date-fns'
import { useState } from 'react'
import { Backup } from '@/hooks/useBackup'
import { cn } from '@/lib/utils'

interface BackupCardProps {
  backup: Backup
  onDownload: (backupId: string) => void
  onRestore: (backupId: string) => void
  onDelete: (backupId: string) => void
  className?: string
}

const typeConfig = {
  full: {
    label: 'Full Backup',
    color: 'bg-blue-500',
    description: 'Complete account backup',
  },
  matter: {
    label: 'Matter Backup',
    color: 'bg-purple-500',
    description: 'Single matter backup',
  },
  session: {
    label: 'Session Backup',
    color: 'bg-green-500',
    description: 'Single session backup',
  },
}

export function BackupCard({
  backup,
  onDownload,
  onRestore,
  onDelete,
  className,
}: BackupCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)

  const typeInfo = typeConfig[backup.type as keyof typeof typeConfig]

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  const handleDelete = () => {
    onDelete(backup.id)
    setShowDeleteDialog(false)
  }

  const handleRestore = () => {
    onRestore(backup.id)
    setShowRestoreDialog(false)
  }

  return (
    <>
      <Card className={cn('hover:shadow-md transition-shadow', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={cn(typeInfo.color, 'text-white')}>
                  {typeInfo.label}
                </Badge>
                {backup.encryptedWith && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Encrypted
                  </Badge>
                )}
                {backup.status === 'completed' && (
                  <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Complete
                  </Badge>
                )}
              </div>
              <CardTitle className="text-lg">
                {typeInfo.description}
              </CardTitle>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onDownload(backup.id)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowRestoreDialog(true)}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Restore
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {/* Size */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <HardDrive className="h-4 w-4" />
                <span>Size</span>
              </div>
              <p className="text-sm font-medium">{formatSize(backup.size)}</p>
            </div>

            {/* Created */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Created</span>
              </div>
              <p className="text-sm font-medium">
                {format(new Date(backup.createdAt), 'MMM dd, yyyy')}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(backup.createdAt), 'HH:mm:ss')}
              </p>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-4 pt-4 border-t space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Audio Files:</span>
              <span className={backup.includesAudio ? 'text-green-600' : 'text-gray-400'}>
                {backup.includesAudio ? 'Included' : 'Not included'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Documents:</span>
              <span className={backup.includesDocuments ? 'text-green-600' : 'text-gray-400'}>
                {backup.includesDocuments ? 'Included' : 'Not included'}
              </span>
            </div>
            {backup.restoreCount > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Restored:</span>
                <span>{backup.restoreCount} time{backup.restoreCount !== 1 ? 's' : ''}</span>
              </div>
            )}
            {backup.lastRestoredAt && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Last Restored:</span>
                <span>{format(new Date(backup.lastRestoredAt), 'MMM dd, yyyy')}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDownload(backup.id)}
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRestoreDialog(true)}
              className="flex-1"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Restore
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the backup
              file created on {format(new Date(backup.createdAt), 'PPP')}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore from Backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore your data from the backup created on{' '}
              {format(new Date(backup.createdAt), 'PPP')}. Existing data may be
              overwritten.
              {backup.encryptedWith && (
                <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <Shield className="h-4 w-4 inline mr-1" />
                    This backup is encrypted. Make sure you have the encryption key.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
