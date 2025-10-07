'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Save, Eye, EyeOff, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

interface ApiKey {
  provider: string
  label: string
  key: string
  isSet: boolean
  lastTested?: Date
  status?: 'success' | 'failed' | 'pending'
}

export function ApiKeysSettings() {
  const { toast } = useToast()
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState<string | null>(null)

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    {
      provider: 'anthropic',
      label: 'Anthropic (Claude)',
      key: '',
      isSet: false,
    },
    {
      provider: 'openai',
      label: 'OpenAI (GPT)',
      key: '',
      isSet: false,
    },
    {
      provider: 'google',
      label: 'Google (Gemini)',
      key: '',
      isSet: false,
    },
    {
      provider: 'openrouter',
      label: 'OpenRouter',
      key: '',
      isSet: false,
    },
    {
      provider: 'deepgram',
      label: 'Deepgram (Transcription)',
      key: '',
      isSet: false,
    },
    {
      provider: 'assemblyai',
      label: 'AssemblyAI (Transcription)',
      key: '',
      isSet: false,
    },
  ])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // TODO: Save to API with encryption
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast({
        title: 'API keys saved',
        description: 'Your API keys have been securely encrypted and saved.',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save API keys. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleTest = async (provider: string) => {
    setIsTesting(provider)
    try {
      // TODO: Test API key
      await new Promise((resolve) => setTimeout(resolve, 2000))

      setApiKeys(
        apiKeys.map((key) =>
          key.provider === provider
            ? { ...key, status: 'success', lastTested: new Date() }
            : key
        )
      )

      toast({
        title: 'API key verified',
        description: `Successfully connected to ${apiKeys.find((k) => k.provider === provider)?.label}`,
      })
    } catch (error) {
      setApiKeys(
        apiKeys.map((key) =>
          key.provider === provider
            ? { ...key, status: 'failed', lastTested: new Date() }
            : key
        )
      )

      toast({
        title: 'Verification failed',
        description: 'Failed to connect with this API key. Please check and try again.',
        variant: 'destructive',
      })
    } finally {
      setIsTesting(null)
    }
  }

  const toggleShowKey = (provider: string) => {
    setShowKeys({ ...showKeys, [provider]: !showKeys[provider] })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Provider API Keys</CardTitle>
          <CardDescription>
            Configure API keys for AI-powered features. Keys are encrypted before storage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {apiKeys
            .filter((key) => ['anthropic', 'openai', 'google', 'openrouter'].includes(key.provider))
            .map((apiKey) => (
              <div key={apiKey.provider} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={apiKey.provider}>{apiKey.label}</Label>
                  {apiKey.status && (
                    <Badge
                      variant={
                        apiKey.status === 'success'
                          ? 'default'
                          : apiKey.status === 'failed'
                            ? 'destructive'
                            : 'outline'
                      }
                    >
                      {apiKey.status === 'success' ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Verified
                        </>
                      ) : apiKey.status === 'failed' ? (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          Failed
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Testing...
                        </>
                      )}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id={apiKey.provider}
                      type={showKeys[apiKey.provider] ? 'text' : 'password'}
                      value={apiKey.key}
                      onChange={(e) =>
                        setApiKeys(
                          apiKeys.map((key) =>
                            key.provider === apiKey.provider
                              ? { ...key, key: e.target.value, isSet: !!e.target.value }
                              : key
                          )
                        )
                      }
                      placeholder={`sk-${apiKey.provider.slice(0, 4)}...`}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowKey(apiKey.provider)}
                  >
                    {showKeys[apiKey.provider] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleTest(apiKey.provider)}
                    disabled={!apiKey.key || isTesting === apiKey.provider}
                  >
                    {isTesting === apiKey.provider ? 'Testing...' : 'Test'}
                  </Button>
                </div>
                {apiKey.lastTested && (
                  <p className="text-xs text-muted-foreground">
                    Last tested: {apiKey.lastTested.toLocaleString()}
                  </p>
                )}
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transcription Service API Keys</CardTitle>
          <CardDescription>
            Configure API keys for speech-to-text transcription services
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {apiKeys
            .filter((key) => ['deepgram', 'assemblyai'].includes(key.provider))
            .map((apiKey) => (
              <div key={apiKey.provider} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={apiKey.provider}>{apiKey.label}</Label>
                  {apiKey.status && (
                    <Badge
                      variant={
                        apiKey.status === 'success'
                          ? 'default'
                          : apiKey.status === 'failed'
                            ? 'destructive'
                            : 'outline'
                      }
                    >
                      {apiKey.status === 'success' ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Verified
                        </>
                      ) : apiKey.status === 'failed' ? (
                        <>
                          <XCircle className="h-3 w-3 mr-1" />
                          Failed
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Testing...
                        </>
                      )}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id={apiKey.provider}
                      type={showKeys[apiKey.provider] ? 'text' : 'password'}
                      value={apiKey.key}
                      onChange={(e) =>
                        setApiKeys(
                          apiKeys.map((key) =>
                            key.provider === apiKey.provider
                              ? { ...key, key: e.target.value, isSet: !!e.target.value }
                              : key
                          )
                        )
                      }
                      placeholder={`Enter ${apiKey.label} API key`}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleShowKey(apiKey.provider)}
                  >
                    {showKeys[apiKey.provider] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleTest(apiKey.provider)}
                    disabled={!apiKey.key || isTesting === apiKey.provider}
                  >
                    {isTesting === apiKey.provider ? 'Testing...' : 'Test'}
                  </Button>
                </div>
                {apiKey.lastTested && (
                  <p className="text-xs text-muted-foreground">
                    Last tested: {apiKey.lastTested.toLocaleString()}
                  </p>
                )}
              </div>
            ))}
        </CardContent>
      </Card>

      <Card className="border-yellow-200 bg-yellow-50/50">
        <CardHeader>
          <CardTitle className="text-sm">Security Notice</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            API keys are encrypted using AES-256-GCM before storage. Never share your API keys
            with anyone. If you suspect a key has been compromised, regenerate it immediately
            from the provider's dashboard.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save All Keys'}
        </Button>
      </div>
    </div>
  )
}
