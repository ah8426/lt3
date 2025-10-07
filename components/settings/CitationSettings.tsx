'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { Save } from 'lucide-react'

export function CitationSettings() {
  const { toast } = useToast()
  const [settings, setSettings] = useState({
    enableCitationVerification: true,
    autoDetect: true,
    autoVerify: false,
    highlightCitations: true,
    showInlineTooltips: true,
    preferredProvider: 'anthropic',
    preferredModel: 'claude-3-5-sonnet-20241022',
    costTracking: true,
    batchSize: 10,
  })

  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // TODO: Save to API
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast({
        title: 'Citation settings saved',
        description: 'Your citation verification settings have been updated.',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save settings. Please try again.',
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
          <CardTitle>Citation Verification</CardTitle>
          <CardDescription>
            Configure AI-powered citation checking and verification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enable-citations">Enable Citation Verification</Label>
              <p className="text-sm text-muted-foreground">
                Turn on AI-powered citation detection and verification
              </p>
            </div>
            <Switch
              id="enable-citations"
              checked={settings.enableCitationVerification}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, enableCitationVerification: checked })
              }
            />
          </div>

          {settings.enableCitationVerification && (
            <>
              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-detect">Auto-Detect Citations</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically detect citations while typing or dictating
                  </p>
                </div>
                <Switch
                  id="auto-detect"
                  checked={settings.autoDetect}
                  onCheckedChange={(checked) => setSettings({ ...settings, autoDetect: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-verify">Auto-Verify Citations</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically verify citations when detected (uses AI credits)
                  </p>
                </div>
                <Switch
                  id="auto-verify"
                  checked={settings.autoVerify}
                  onCheckedChange={(checked) => setSettings({ ...settings, autoVerify: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="highlight">Highlight Citations</Label>
                  <p className="text-sm text-muted-foreground">
                    Show visual indicators for citations in transcripts
                  </p>
                </div>
                <Switch
                  id="highlight"
                  checked={settings.highlightCitations}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, highlightCitations: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="tooltips">Show Inline Tooltips</Label>
                  <p className="text-sm text-muted-foreground">
                    Display verification details when hovering over citations
                  </p>
                </div>
                <Switch
                  id="tooltips"
                  checked={settings.showInlineTooltips}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, showInlineTooltips: checked })
                  }
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {settings.enableCitationVerification && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>AI Provider Settings</CardTitle>
              <CardDescription>
                Choose which AI provider to use for citation verification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Preferred Provider</Label>
                <Select
                  value={settings.preferredProvider}
                  onValueChange={(value) => setSettings({ ...settings, preferredProvider: value })}
                >
                  <SelectTrigger id="provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                    <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                    <SelectItem value="google">Google (Gemini)</SelectItem>
                    <SelectItem value="openrouter">OpenRouter</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  The system will automatically fallback to other providers if the preferred one
                  fails
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Preferred Model</Label>
                <Select
                  value={settings.preferredModel}
                  onValueChange={(value) => setSettings({ ...settings, preferredModel: value })}
                >
                  <SelectTrigger id="model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {settings.preferredProvider === 'anthropic' && (
                      <>
                        <SelectItem value="claude-3-5-sonnet-20241022">
                          Claude 3.5 Sonnet (Best)
                        </SelectItem>
                        <SelectItem value="claude-3-5-haiku-20241022">
                          Claude 3.5 Haiku (Fastest)
                        </SelectItem>
                      </>
                    )}
                    {settings.preferredProvider === 'openai' && (
                      <>
                        <SelectItem value="gpt-4o">GPT-4o (Best)</SelectItem>
                        <SelectItem value="gpt-4o-mini">GPT-4o Mini (Fastest)</SelectItem>
                      </>
                    )}
                    {settings.preferredProvider === 'google' && (
                      <>
                        <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro (Best)</SelectItem>
                        <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash (Fastest)</SelectItem>
                      </>
                    )}
                    {settings.preferredProvider === 'openrouter' && (
                      <>
                        <SelectItem value="openai/gpt-4o">GPT-4o via OpenRouter</SelectItem>
                        <SelectItem value="anthropic/claude-3.5-sonnet">
                          Claude 3.5 Sonnet via OpenRouter
                        </SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="batch-size">Batch Size</Label>
                <Select
                  value={settings.batchSize.toString()}
                  onValueChange={(value) =>
                    setSettings({ ...settings, batchSize: parseInt(value) })
                  }
                >
                  <SelectTrigger id="batch-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 citations</SelectItem>
                    <SelectItem value="10">10 citations</SelectItem>
                    <SelectItem value="20">20 citations</SelectItem>
                    <SelectItem value="50">50 citations</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Maximum number of citations to verify in a single batch
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cost Management</CardTitle>
              <CardDescription>
                Track and manage AI usage costs for citation verification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="cost-tracking">Enable Cost Tracking</Label>
                  <p className="text-sm text-muted-foreground">
                    Track costs for citation verification requests
                  </p>
                </div>
                <Switch
                  id="cost-tracking"
                  checked={settings.costTracking}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, costTracking: checked })
                  }
                />
              </div>

              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estimated cost per citation:</span>
                  <span className="font-mono">$0.001 - $0.003</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estimated cost for 10 citations:</span>
                  <span className="font-mono">$0.01 - $0.03</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estimated cost for 100 citations:</span>
                  <span className="font-mono">$0.10 - $0.30</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
