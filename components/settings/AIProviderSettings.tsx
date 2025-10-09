'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { useToast } from '@/hooks/use-toast'
import { Save } from 'lucide-react'

export function AIProviderSettings() {
  const { toast } = useToast()
  const [settings, setSettings] = useState({
    defaultProvider: 'anthropic',
    defaultModel: 'claude-3-5-sonnet-20241022',
    enableFailover: true,
    temperature: 0.7,
    maxTokens: 2000,
    streamingEnabled: true,
  })

  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast({
        title: 'AI settings saved',
        description: 'Your AI provider settings have been updated.',
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
          <CardTitle>Default AI Provider</CardTitle>
          <CardDescription>
            Choose your default AI provider for chat and other AI features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select
              value={settings.defaultProvider}
              onValueChange={(value) => setSettings({ ...settings, defaultProvider: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                <SelectItem value="google">Google (Gemini)</SelectItem>
                <SelectItem value="openrouter">OpenRouter</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Model</Label>
            <Select
              value={settings.defaultModel}
              onValueChange={(value) => setSettings({ ...settings, defaultModel: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Provider Failover</Label>
              <p className="text-sm text-muted-foreground">
                Automatically switch to backup providers if primary fails
              </p>
            </div>
            <Switch
              checked={settings.enableFailover}
              onCheckedChange={(checked) => setSettings({ ...settings, enableFailover: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Model Parameters</CardTitle>
          <CardDescription>
            Fine-tune AI model behavior for your use case
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Temperature: {settings.temperature}</Label>
              <span className="text-sm text-muted-foreground">
                {settings.temperature < 0.3 ? 'Focused' : settings.temperature > 0.7 ? 'Creative' : 'Balanced'}
              </span>
            </div>
            <Slider
              value={[settings.temperature]}
              onValueChange={([value]) => setSettings({ ...settings, temperature: value })}
              min={0}
              max={1}
              step={0.1}
            />
            <p className="text-xs text-muted-foreground">
              Lower values make output more focused and deterministic
            </p>
          </div>

          <div className="space-y-2">
            <Label>Max Tokens: {settings.maxTokens}</Label>
            <Slider
              value={[settings.maxTokens]}
              onValueChange={([value]) => setSettings({ ...settings, maxTokens: value })}
              min={500}
              max={4000}
              step={100}
            />
            <p className="text-xs text-muted-foreground">
              Maximum length of AI responses
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Streaming Responses</Label>
              <p className="text-sm text-muted-foreground">
                Show AI responses as they&apos;re generated
              </p>
            </div>
            <Switch
              checked={settings.streamingEnabled}
              onCheckedChange={(checked) => setSettings({ ...settings, streamingEnabled: checked })}
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
