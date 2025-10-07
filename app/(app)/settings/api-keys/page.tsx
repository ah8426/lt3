'use client';

import { useState } from 'react';
import { useAPIKeys, Provider } from '@/hooks/useAPIKeys';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Key,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Eye,
  EyeOff,
  TestTube,
  Loader2,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';

const PROVIDERS = [
  {
    id: 'deepgram' as Provider,
    name: 'Deepgram',
    description: 'Real-time transcription and speech recognition',
    icon: '🎤',
  },
  {
    id: 'assemblyai' as Provider,
    name: 'AssemblyAI',
    description: 'AI-powered transcription service',
    icon: '📝',
  },
  {
    id: 'anthropic' as Provider,
    name: 'Anthropic (Claude)',
    description: 'Claude AI for intelligent assistance',
    icon: '🤖',
  },
  {
    id: 'openai' as Provider,
    name: 'OpenAI',
    description: 'GPT models for AI processing',
    icon: '✨',
  },
  {
    id: 'google' as Provider,
    name: 'Google AI',
    description: 'Gemini models for AI assistance',
    icon: '🔍',
  },
  {
    id: 'openrouter' as Provider,
    name: 'OpenRouter',
    description: 'Unified AI model access',
    icon: '🔀',
  },
];

export default function APIKeysPage() {
  const { apiKeys, isLoading, addOrUpdateKey, deleteKey, testConnection, getKeyByProvider } = useAPIKeys();
  const [selectedProvider, setSelectedProvider] = useState<Provider>('deepgram');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState<Provider | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSaveKey = async () => {
    if (!apiKeyInput.trim()) {
      setFeedback({ type: 'error', message: 'API key cannot be empty' });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    const result = await addOrUpdateKey(selectedProvider, apiKeyInput);

    if (result.success) {
      setFeedback({ type: 'success', message: 'API key saved successfully' });
      setApiKeyInput('');
      setShowKey(false);
    } else {
      setFeedback({ type: 'error', message: result.error || 'Failed to save API key' });
    }

    setIsSaving(false);
  };

  const handleTestConnection = async (provider: Provider) => {
    setIsTesting(provider);
    setFeedback(null);

    const result = await testConnection(provider);

    if (result.success) {
      setFeedback({ type: 'success', message: `${provider} connection successful!` });
    } else {
      setFeedback({ type: 'error', message: result.error || 'Connection test failed' });
    }

    setIsTesting(null);
  };

  const handleDeleteKey = async (provider: Provider) => {
    const result = await deleteKey(provider);

    if (result.success) {
      setFeedback({ type: 'success', message: 'API key deleted successfully' });
    } else {
      setFeedback({ type: 'error', message: result.error || 'Failed to delete API key' });
    }
  };

  const getTestStatusIcon = (status: string | null) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="h-8 w-8 animate-spin text-[#00BFA5]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">API Keys</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage your API keys for various AI and transcription services
        </p>
      </div>

      {/* Security Notice */}
      <Alert className="border-[#00BFA5]/20 bg-[#00BFA5]/5">
        <Shield className="h-4 w-4 text-[#00BFA5]" />
        <AlertDescription className="text-sm">
          Your API keys are encrypted using AES-256-GCM and stored securely. They are never exposed to the client.
        </AlertDescription>
      </Alert>

      {feedback && (
        <Alert variant={feedback.type === 'error' ? 'destructive' : 'default'}>
          {feedback.type === 'error' ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <CheckCircle className="h-4 w-4 text-green-600" />
          )}
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      )}

      {/* Add New Key */}
      <Card>
        <CardHeader>
          <CardTitle>Add or Update API Key</CardTitle>
          <CardDescription>
            Select a provider and enter your API key to enable the service
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Select value={selectedProvider} onValueChange={(value) => setSelectedProvider(value as Provider)}>
                <SelectTrigger id="provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      <div className="flex items-center gap-2">
                        <span>{provider.icon}</span>
                        <span>{provider.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showKey ? 'text' : 'password'}
                  placeholder="Enter your API key"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleSaveKey}
              disabled={isSaving || !apiKeyInput.trim()}
              className="bg-[#00BFA5] hover:bg-[#00BFA5]/90"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Key className="mr-2 h-4 w-4" />
                  Save API Key
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-gray-500">
            Selected provider: <strong>{PROVIDERS.find((p) => p.id === selectedProvider)?.name}</strong> -{' '}
            {PROVIDERS.find((p) => p.id === selectedProvider)?.description}
          </p>
        </CardContent>
      </Card>

      {/* Existing Keys */}
      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
          <CardDescription>Manage and test your configured API keys</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {PROVIDERS.map((provider) => {
              const existingKey = getKeyByProvider(provider.id);

              return (
                <div
                  key={provider.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-slate-800"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">{provider.icon}</div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{provider.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{provider.description}</p>
                      {existingKey && (
                        <div className="flex items-center gap-2 mt-2">
                          <code className="text-xs bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded">
                            {existingKey.maskedKey || '••••••••'}
                          </code>
                          {existingKey.lastTestedAt && (
                            <span className="text-xs text-gray-500">
                              Tested {format(new Date(existingKey.lastTestedAt), 'MMM d, yyyy')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {existingKey ? (
                      <>
                        <div className="flex items-center gap-1">
                          {getTestStatusIcon(existingKey.testStatus)}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestConnection(provider.id)}
                          disabled={isTesting === provider.id}
                        >
                          {isTesting === provider.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <TestTube className="mr-2 h-4 w-4" />
                              Test
                            </>
                          )}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete API Key</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the {provider.name} API key? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteKey(provider.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    ) : (
                      <span className="text-sm text-gray-400">Not configured</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
