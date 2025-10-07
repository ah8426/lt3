'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { Save } from 'lucide-react'

export function NotificationSettings() {
  const { toast } = useToast()
  const [settings, setSettings] = useState({
    emailNotifications: true,
    transcriptionComplete: true,
    exportReady: true,
    citationVerificationComplete: true,
    weeklyDigest: false,
    productUpdates: true,
    securityAlerts: true,
  })

  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast({
        title: 'Notification settings saved',
        description: 'Your notification preferences have been updated.',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save settings.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>
            Manage which email notifications you receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications via email
              </p>
            </div>
            <Switch
              checked={settings.emailNotifications}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, emailNotifications: checked })
              }
            />
          </div>

          {settings.emailNotifications && (
            <>
              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Transcription Complete</Label>
                  <p className="text-sm text-muted-foreground">
                    When a transcription finishes processing
                  </p>
                </div>
                <Switch
                  checked={settings.transcriptionComplete}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, transcriptionComplete: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Export Ready</Label>
                  <p className="text-sm text-muted-foreground">
                    When a document export is ready to download
                  </p>
                </div>
                <Switch
                  checked={settings.exportReady}
                  onCheckedChange={(checked) => setSettings({ ...settings, exportReady: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Citation Verification Complete</Label>
                  <p className="text-sm text-muted-foreground">
                    When batch citation verification finishes
                  </p>
                </div>
                <Switch
                  checked={settings.citationVerificationComplete}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, citationVerificationComplete: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Weekly Digest</Label>
                  <p className="text-sm text-muted-foreground">
                    Weekly summary of your activity and sessions
                  </p>
                </div>
                <Switch
                  checked={settings.weeklyDigest}
                  onCheckedChange={(checked) => setSettings({ ...settings, weeklyDigest: checked })}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Product Updates</CardTitle>
          <CardDescription>
            Stay informed about new features and improvements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Product Updates</Label>
              <p className="text-sm text-muted-foreground">
                Get notified about new features and updates
              </p>
            </div>
            <Switch
              checked={settings.productUpdates}
              onCheckedChange={(checked) => setSettings({ ...settings, productUpdates: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Security Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Important security updates and alerts
              </p>
            </div>
            <Switch
              checked={settings.securityAlerts}
              onCheckedChange={(checked) => setSettings({ ...settings, securityAlerts: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
