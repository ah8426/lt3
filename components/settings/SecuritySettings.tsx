'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Save, Shield, Key, Smartphone } from 'lucide-react'

export function SecuritySettings() {
  const { toast } = useToast()
  const [settings, setSettings] = useState({
    twoFactorEnabled: false,
    sessionTimeout: 60,
    requireReauth: true,
    encryptLocalStorage: true,
    auditLogging: true,
  })

  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast({
        title: 'Security settings saved',
        description: 'Your security settings have been updated.',
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
          <CardTitle>Authentication</CardTitle>
          <CardDescription>
            Manage your account authentication and access settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <div className="flex items-center gap-2">
                <Label>Two-Factor Authentication</Label>
                {settings.twoFactorEnabled && (
                  <Badge variant="default" className="text-xs">
                    Enabled
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security to your account
              </p>
            </div>
            <Button variant="outline" size="sm">
              <Smartphone className="h-4 w-4 mr-2" />
              {settings.twoFactorEnabled ? 'Manage' : 'Enable'}
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Session Timeout (minutes)</Label>
            <Input
              type="number"
              value={settings.sessionTimeout}
              onChange={(e) =>
                setSettings({ ...settings, sessionTimeout: parseInt(e.target.value) })
              }
              min={15}
              max={240}
            />
            <p className="text-sm text-muted-foreground">
              Automatically log out after period of inactivity
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Require Re-authentication</Label>
              <p className="text-sm text-muted-foreground">
                Require password for sensitive operations
              </p>
            </div>
            <Switch
              checked={settings.requireReauth}
              onCheckedChange={(checked) => setSettings({ ...settings, requireReauth: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Security</CardTitle>
          <CardDescription>
            Configure how your data is protected and encrypted
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Encrypt Local Storage</Label>
              <p className="text-sm text-muted-foreground">
                Encrypt sensitive data stored in your browser
              </p>
            </div>
            <Switch
              checked={settings.encryptLocalStorage}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, encryptLocalStorage: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Audit Logging</Label>
              <p className="text-sm text-muted-foreground">
                Track all access to your transcripts and documents
              </p>
            </div>
            <Switch
              checked={settings.auditLogging}
              onCheckedChange={(checked) => setSettings({ ...settings, auditLogging: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>
            Manage devices and sessions with access to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-medium">Current Session</div>
                <div className="text-sm text-muted-foreground">Windows • Chrome • Active now</div>
              </div>
            </div>
            <Badge variant="default">Current</Badge>
          </div>

          <Button variant="outline" className="w-full">
            Revoke All Other Sessions
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions that affect your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-red-600">Delete Account</Label>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data
              </p>
            </div>
            <Button variant="destructive" size="sm">
              Delete Account
            </Button>
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
