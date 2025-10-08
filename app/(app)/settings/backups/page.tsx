'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  HardDrive,
  Plus,
  Loader2,
  Info,
  Calendar,
  Shield,
  Download,
  Clock,
} from 'lucide-react'
import { BackupCard } from '@/components/backup/BackupCard'
import { useBackup } from '@/hooks/useBackup'
import { useSettings } from '@/hooks/useSettings'

const frequencyOptions = [
  { value: 'disabled', label: 'Disabled' },
  { value: 'hourly', label: 'Every Hour' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

const retentionOptions = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
]

export default function BackupsPage() {
  const { settings, updateSettings, isLoading: settingsLoading } = useSettings()
  const {
    backups,
    isLoading,
    createBackup,
    deleteBackup,
    restoreBackup,
    downloadBackup,
    isCreating,
    isRestoring,
    refresh,
  } = useBackup()

  const backupSettings = settings?.backup || {}

  const [autoBackupEnabled, setAutoBackupEnabled] = useState(
    backupSettings.autoBackupEnabled ?? true
  )
  const [frequency, setFrequency] = useState(
    backupSettings.frequency || 'daily'
  )
  const [includeAudioFiles, setIncludeAudioFiles] = useState(
    backupSettings.includeAudioFiles ?? false
  )
  const [includeDocuments, setIncludeDocuments] = useState(
    backupSettings.includeDocuments ?? true
  )
  const [retentionDays, setRetentionDays] = useState(
    backupSettings.retentionDays?.toString() || '30'
  )
  const [maxBackups, setMaxBackups] = useState(
    backupSettings.maxBackups?.toString() || '10'
  )
  const [encryptBackups, setEncryptBackups] = useState(
    backupSettings.encryptBackups ?? true
  )

  const handleSaveSettings = async () => {
    await updateSettings({
      backup: {
        autoBackupEnabled,
        frequency,
        includeAudioFiles,
        includeDocuments,
        retentionDays: parseInt(retentionDays),
        maxBackups: parseInt(maxBackups),
        encryptBackups,
      },
    })
  }

  const handleCreateBackup = async () => {
    await createBackup({
      scope: 'full',
      includeAudioFiles,
      includeDocuments,
      encrypt: encryptBackups,
    })
    refresh()
  }

  const handleRestore = async (backupId: string) => {
    await restoreBackup({
      backupId,
      overwriteExisting: false,
    })
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Backup & Recovery</h1>
        <p className="text-muted-foreground">
          Configure automatic backups and manage your backup files
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Panel */}
        <div className="lg:col-span-1 space-y-6">
          {/* Auto-Backup Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Auto-Backup Settings
              </CardTitle>
              <CardDescription>
                Configure automatic backup schedule
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable Auto-Backup */}
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-backup" className="flex-1">
                  Enable Auto-Backup
                </Label>
                <Switch
                  id="auto-backup"
                  checked={autoBackupEnabled}
                  onCheckedChange={setAutoBackupEnabled}
                />
              </div>

              {/* Frequency */}
              <div className="space-y-2">
                <Label htmlFor="frequency">Backup Frequency</Label>
                <Select
                  value={frequency}
                  onValueChange={setFrequency}
                  disabled={!autoBackupEnabled}
                >
                  <SelectTrigger id="frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {frequencyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Include Options */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="audio" className="flex-1">
                    Include Audio Files
                  </Label>
                  <Switch
                    id="audio"
                    checked={includeAudioFiles}
                    onCheckedChange={setIncludeAudioFiles}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="docs" className="flex-1">
                    Include Documents
                  </Label>
                  <Switch
                    id="docs"
                    checked={includeDocuments}
                    onCheckedChange={setIncludeDocuments}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="encrypt" className="flex-1 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Encrypt Backups
                  </Label>
                  <Switch
                    id="encrypt"
                    checked={encryptBackups}
                    onCheckedChange={setEncryptBackups}
                  />
                </div>
              </div>

              <Separator />

              {/* Retention */}
              <div className="space-y-2">
                <Label htmlFor="retention">Retention Period</Label>
                <Select value={retentionDays} onValueChange={setRetentionDays}>
                  <SelectTrigger id="retention">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {retentionOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Backups older than this will be automatically deleted
                </p>
              </div>

              {/* Max Backups */}
              <div className="space-y-2">
                <Label htmlFor="max-backups">Maximum Backups</Label>
                <Input
                  id="max-backups"
                  type="number"
                  min="1"
                  max="50"
                  value={maxBackups}
                  onChange={(e) => setMaxBackups(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of backups to keep
                </p>
              </div>

              <Button
                onClick={handleSaveSettings}
                className="w-full"
                disabled={settingsLoading}
              >
                {settingsLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Settings'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <p className="font-semibold mb-1">About Backups</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Backups include all your data</li>
                <li>Encrypted backups are more secure</li>
                <li>Audio files increase backup size</li>
                <li>You can restore from any backup</li>
              </ul>
            </AlertDescription>
          </Alert>
        </div>

        {/* Backups List */}
        <div className="lg:col-span-2 space-y-6">
          {/* Manual Backup */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Manual Backup
              </CardTitle>
              <CardDescription>
                Create a backup of your data right now
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleCreateBackup}
                disabled={isCreating}
                className="w-full"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Backup...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Backup Now
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Backup History */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Backup History</h2>
              <Button variant="outline" size="sm" onClick={() => refresh()}>
                Refresh
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : backups && backups.length > 0 ? (
              <div className="space-y-4">
                {backups.map((backup) => (
                  <BackupCard
                    key={backup.id}
                    backup={backup}
                    onDownload={downloadBackup}
                    onRestore={handleRestore}
                    onDelete={deleteBackup}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Download className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-semibold mb-2">No Backups Yet</p>
                  <p className="text-sm text-muted-foreground text-center max-w-sm">
                    Create your first backup to secure your data. Backups will appear
                    here once created.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
