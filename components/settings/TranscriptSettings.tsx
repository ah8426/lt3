'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Clock,
  Shield,
  GitBranch,
  CheckCircle2,
  AlertCircle,
  Info,
  Save,
  Users,
  Lock
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface TranscriptPreferences {
  // Timestamp Verification
  enableTimestamps: boolean
  autoTimestamp: boolean
  timestampFrequency: 'realtime' | 'segment' | 'manual'
  preferNTP: boolean
  ntpServers: string[]
  requireVerifiedTimestamps: boolean

  // Version Control
  enableVersioning: boolean
  autoSaveInterval: number // minutes
  maxVersions: number
  saveBeforeExport: boolean
  saveBeforeShare: boolean
  trackSegmentEdits: boolean

  // Speaker Diarization
  enableSpeakerDiarization: boolean
  autoDetectSpeakers: boolean
  maxSpeakers: number
  requireSpeakerNames: boolean
  showSpeakerTimeline: boolean
  colorCodeSpeakers: boolean

  // PII Redaction
  enableRedaction: boolean
  autoDetectPII: boolean
  redactionMinConfidence: number
  requireRedactionReason: boolean
  encryptRedactedContent: boolean
  allowUnredaction: boolean
}

const DEFAULT_PREFERENCES: TranscriptPreferences = {
  enableTimestamps: true,
  autoTimestamp: true,
  timestampFrequency: 'segment',
  preferNTP: true,
  ntpServers: ['time.nist.gov', 'pool.ntp.org'],
  requireVerifiedTimestamps: false,
  enableVersioning: true,
  autoSaveInterval: 5,
  maxVersions: 50,
  saveBeforeExport: true,
  saveBeforeShare: true,
  trackSegmentEdits: true,
  enableSpeakerDiarization: true,
  autoDetectSpeakers: true,
  maxSpeakers: 10,
  requireSpeakerNames: false,
  showSpeakerTimeline: true,
  colorCodeSpeakers: true,
  enableRedaction: true,
  autoDetectPII: false,
  redactionMinConfidence: 0.75,
  requireRedactionReason: true,
  encryptRedactedContent: true,
  allowUnredaction: true,
}

export function TranscriptSettings() {
  const { toast } = useToast()
  const [preferences, setPreferences] = useState<TranscriptPreferences>(DEFAULT_PREFERENCES)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const handleChange = <K extends keyof TranscriptPreferences>(
    key: K,
    value: TranscriptPreferences[K]
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/settings/transcript', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      })

      if (!response.ok) {
        throw new Error('Failed to save preferences')
      }

      toast({
        title: 'Preferences saved',
        description: 'Your transcript preferences have been updated.',
      })
      setHasChanges(false)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save preferences. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Timestamp Verification Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <CardTitle>Timestamp Verification</CardTitle>
          </div>
          <CardDescription>
            Configure cryptographic timestamp proofs for legal compliance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Timestamps */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enable-timestamps">Enable Timestamp Verification</Label>
              <p className="text-sm text-muted-foreground">
                Create cryptographic timestamp proofs for transcript segments
              </p>
            </div>
            <Switch
              id="enable-timestamps"
              checked={preferences.enableTimestamps}
              onCheckedChange={(checked) => handleChange('enableTimestamps', checked)}
            />
          </div>

          {preferences.enableTimestamps && (
            <>
              <Separator />

              {/* Auto Timestamp */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-timestamp">Automatic Timestamping</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically create timestamp proofs during transcription
                  </p>
                </div>
                <Switch
                  id="auto-timestamp"
                  checked={preferences.autoTimestamp}
                  onCheckedChange={(checked) => handleChange('autoTimestamp', checked)}
                />
              </div>

              {/* Timestamp Frequency */}
              {preferences.autoTimestamp && (
                <div className="space-y-2">
                  <Label>Timestamp Frequency</Label>
                  <RadioGroup
                    value={preferences.timestampFrequency}
                    onValueChange={(value) =>
                      handleChange('timestampFrequency', value as TranscriptPreferences['timestampFrequency'])
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="realtime" id="realtime" />
                      <Label htmlFor="realtime" className="font-normal">
                        Real-time (every segment as it's created)
                        <Badge variant="outline" className="ml-2">Highest security</Badge>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="segment" id="segment" />
                      <Label htmlFor="segment" className="font-normal">
                        Per segment (when segment is finalized)
                        <Badge variant="outline" className="ml-2">Recommended</Badge>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="manual" id="manual" />
                      <Label htmlFor="manual" className="font-normal">
                        Manual only (timestamp on demand)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              <Separator />

              {/* NTP Preference */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="prefer-ntp">Prefer NTP Time Servers</Label>
                  <p className="text-sm text-muted-foreground">
                    Use trusted NTP servers for timestamp verification (fallback to local time if unavailable)
                  </p>
                </div>
                <Switch
                  id="prefer-ntp"
                  checked={preferences.preferNTP}
                  onCheckedChange={(checked) => handleChange('preferNTP', checked)}
                />
              </div>

              {/* Require Verified Timestamps */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="require-verified">Require Verified Timestamps</Label>
                  <p className="text-sm text-muted-foreground">
                    Block export/share if any timestamps are unverified
                  </p>
                </div>
                <Switch
                  id="require-verified"
                  checked={preferences.requireVerifiedTimestamps}
                  onCheckedChange={(checked) => handleChange('requireVerifiedTimestamps', checked)}
                />
              </div>

              {preferences.requireVerifiedTimestamps && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    With this enabled, you won't be able to export or share transcripts until all timestamp proofs are verified.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {!preferences.enableTimestamps && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Timestamp verification is disabled. Transcripts will not have cryptographic proof of creation time.
                This may affect legal admissibility.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Version Control Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            <CardTitle>Version Control</CardTitle>
          </div>
          <CardDescription>
            Configure automatic versioning and change tracking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Versioning */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enable-versioning">Enable Version Control</Label>
              <p className="text-sm text-muted-foreground">
                Track all changes to transcripts with automatic versioning
              </p>
            </div>
            <Switch
              id="enable-versioning"
              checked={preferences.enableVersioning}
              onCheckedChange={(checked) => handleChange('enableVersioning', checked)}
            />
          </div>

          {preferences.enableVersioning && (
            <>
              <Separator />

              {/* Auto-save Interval */}
              <div className="space-y-2">
                <Label htmlFor="auto-save-interval">Auto-save Interval (minutes)</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="auto-save-interval"
                    type="number"
                    min="1"
                    max="60"
                    value={preferences.autoSaveInterval}
                    onChange={(e) => handleChange('autoSaveInterval', parseInt(e.target.value) || 5)}
                    className="w-32"
                  />
                  <p className="text-sm text-muted-foreground">
                    Automatically create version every {preferences.autoSaveInterval} minutes during editing
                  </p>
                </div>
              </div>

              {/* Max Versions */}
              <div className="space-y-2">
                <Label htmlFor="max-versions">Maximum Versions per Session</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="max-versions"
                    type="number"
                    min="10"
                    max="1000"
                    value={preferences.maxVersions}
                    onChange={(e) => handleChange('maxVersions', parseInt(e.target.value) || 50)}
                    className="w-32"
                  />
                  <p className="text-sm text-muted-foreground">
                    Older versions will be archived when limit is reached
                  </p>
                </div>
              </div>

              <Separator />

              {/* Save Before Export */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="save-before-export">Save Before Export</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically create version before exporting transcript
                  </p>
                </div>
                <Switch
                  id="save-before-export"
                  checked={preferences.saveBeforeExport}
                  onCheckedChange={(checked) => handleChange('saveBeforeExport', checked)}
                />
              </div>

              {/* Save Before Share */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="save-before-share">Save Before Share</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically create version before sharing transcript
                  </p>
                </div>
                <Switch
                  id="save-before-share"
                  checked={preferences.saveBeforeShare}
                  onCheckedChange={(checked) => handleChange('saveBeforeShare', checked)}
                />
              </div>

              {/* Track Segment Edits */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="track-edits">Track Segment Edits</Label>
                  <p className="text-sm text-muted-foreground">
                    Record detailed history of all segment text changes
                  </p>
                </div>
                <Switch
                  id="track-edits"
                  checked={preferences.trackSegmentEdits}
                  onCheckedChange={(checked) => handleChange('trackSegmentEdits', checked)}
                />
              </div>
            </>
          )}

          {!preferences.enableVersioning && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Version control is disabled. You won't be able to restore previous versions or track changes.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Speaker Diarization Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>Speaker Diarization</CardTitle>
          </div>
          <CardDescription>
            Automatically detect and label different speakers in your transcripts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Speaker Diarization */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enable-speakers">Enable Speaker Diarization</Label>
              <p className="text-sm text-muted-foreground">
                Detect and label different speakers in audio recordings
              </p>
            </div>
            <Switch
              id="enable-speakers"
              checked={preferences.enableSpeakerDiarization}
              onCheckedChange={(checked) => handleChange('enableSpeakerDiarization', checked)}
            />
          </div>

          {preferences.enableSpeakerDiarization && (
            <>
              <Separator />

              {/* Auto-detect Speakers */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-detect">Auto-detect Speakers</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically identify speakers from transcription data
                  </p>
                </div>
                <Switch
                  id="auto-detect"
                  checked={preferences.autoDetectSpeakers}
                  onCheckedChange={(checked) => handleChange('autoDetectSpeakers', checked)}
                />
              </div>

              {/* Max Speakers */}
              <div className="space-y-2">
                <Label htmlFor="max-speakers">Maximum Speakers</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="max-speakers"
                    type="number"
                    min={2}
                    max={20}
                    value={preferences.maxSpeakers}
                    onChange={(e) => handleChange('maxSpeakers', parseInt(e.target.value) || 10)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">
                    Maximum number of speakers to detect (2-20)
                  </span>
                </div>
              </div>

              {/* Show Speaker Timeline */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="show-timeline">Show Speaker Timeline</Label>
                  <p className="text-sm text-muted-foreground">
                    Display visual timeline showing when each speaker spoke
                  </p>
                </div>
                <Switch
                  id="show-timeline"
                  checked={preferences.showSpeakerTimeline}
                  onCheckedChange={(checked) => handleChange('showSpeakerTimeline', checked)}
                />
              </div>

              {/* Color-code Speakers */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="color-code">Color-code Speakers</Label>
                  <p className="text-sm text-muted-foreground">
                    Use distinct colors for each speaker in the transcript
                  </p>
                </div>
                <Switch
                  id="color-code"
                  checked={preferences.colorCodeSpeakers}
                  onCheckedChange={(checked) => handleChange('colorCodeSpeakers', checked)}
                />
              </div>

              {/* Require Speaker Names */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="require-names">Require Speaker Names</Label>
                  <p className="text-sm text-muted-foreground">
                    Require speakers to be named before export
                  </p>
                </div>
                <Switch
                  id="require-names"
                  checked={preferences.requireSpeakerNames}
                  onCheckedChange={(checked) => handleChange('requireSpeakerNames', checked)}
                />
              </div>
            </>
          )}

          {!preferences.enableSpeakerDiarization && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Speaker diarization is disabled. All transcribed text will be unlabeled.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* PII Redaction Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            <CardTitle>PII Redaction</CardTitle>
          </div>
          <CardDescription>
            Automatically detect and redact personally identifiable information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Redaction */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enable-redaction">Enable PII Redaction</Label>
              <p className="text-sm text-muted-foreground">
                Detect and redact sensitive personal information in transcripts
              </p>
            </div>
            <Switch
              id="enable-redaction"
              checked={preferences.enableRedaction}
              onCheckedChange={(checked) => handleChange('enableRedaction', checked)}
            />
          </div>

          {preferences.enableRedaction && (
            <>
              <Separator />

              {/* Auto-detect PII */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-detect-pii">Auto-detect PII</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically scan for PII when transcript is created
                  </p>
                </div>
                <Switch
                  id="auto-detect-pii"
                  checked={preferences.autoDetectPII}
                  onCheckedChange={(checked) => handleChange('autoDetectPII', checked)}
                />
              </div>

              {/* Minimum Confidence */}
              <div className="space-y-2">
                <Label htmlFor="min-confidence">Minimum Detection Confidence</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="min-confidence"
                    type="number"
                    min={0.5}
                    max={1.0}
                    step={0.05}
                    value={preferences.redactionMinConfidence}
                    onChange={(e) =>
                      handleChange('redactionMinConfidence', parseFloat(e.target.value) || 0.75)
                    }
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">
                    {Math.round(preferences.redactionMinConfidence * 100)}% confidence threshold
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Higher values reduce false positives but may miss some PII
                </p>
              </div>

              {/* Require Redaction Reason */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="require-reason">Require Redaction Reason</Label>
                  <p className="text-sm text-muted-foreground">
                    Require users to provide a reason when creating redactions
                  </p>
                </div>
                <Switch
                  id="require-reason"
                  checked={preferences.requireRedactionReason}
                  onCheckedChange={(checked) => handleChange('requireRedactionReason', checked)}
                />
              </div>

              {/* Encrypt Redacted Content */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="encrypt-content">Encrypt Original Content</Label>
                  <p className="text-sm text-muted-foreground">
                    Store original text encrypted (required for compliance)
                  </p>
                </div>
                <Switch
                  id="encrypt-content"
                  checked={preferences.encryptRedactedContent}
                  onCheckedChange={(checked) => handleChange('encryptRedactedContent', checked)}
                  disabled={true} // Always required
                />
              </div>

              {/* Allow Unredaction */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="allow-unredact">Allow Unredaction</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow authorized users to view original redacted content
                  </p>
                </div>
                <Switch
                  id="allow-unredact"
                  checked={preferences.allowUnredaction}
                  onCheckedChange={(checked) => handleChange('allowUnredaction', checked)}
                />
              </div>
            </>
          )}

          {!preferences.enableRedaction && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                PII redaction is disabled. Sensitive information will not be protected automatically.
              </AlertDescription>
            </Alert>
          )}

          {preferences.enableRedaction && (
            <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <strong>Legal Notice:</strong> Redaction does not delete information. Original content
                is encrypted and stored. Ensure your encryption key (REDACTION_ENCRYPTION_KEY) is
                properly secured. All unredaction actions are logged for audit purposes.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Security Recommendations */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Security Recommendations</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className={`h-5 w-5 mt-0.5 ${
                preferences.enableTimestamps && preferences.autoTimestamp && preferences.preferNTP
                  ? 'text-green-600'
                  : 'text-muted-foreground'
              }`} />
              <div>
                <p className="font-medium">Enable NTP Timestamps</p>
                <p className="text-sm text-muted-foreground">
                  For maximum legal compliance, use NTP-verified timestamps
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className={`h-5 w-5 mt-0.5 ${
                preferences.enableVersioning && preferences.saveBeforeExport && preferences.saveBeforeShare
                  ? 'text-green-600'
                  : 'text-muted-foreground'
              }`} />
              <div>
                <p className="font-medium">Auto-save Before Actions</p>
                <p className="text-sm text-muted-foreground">
                  Protect against accidental changes with automatic versioning
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className={`h-5 w-5 mt-0.5 ${
                preferences.trackSegmentEdits
                  ? 'text-green-600'
                  : 'text-muted-foreground'
              }`} />
              <div>
                <p className="font-medium">Track All Changes</p>
                <p className="text-sm text-muted-foreground">
                  Maintain complete audit trail of transcript modifications
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      {hasChanges && (
        <div className="flex items-center justify-end gap-4 sticky bottom-4 p-4 bg-background border rounded-lg shadow-lg">
          <p className="text-sm text-muted-foreground">You have unsaved changes</p>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>
      )}
    </div>
  )
}
