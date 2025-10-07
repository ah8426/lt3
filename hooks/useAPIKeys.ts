'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

export type Provider = 'deepgram' | 'assemblyai' | 'anthropic' | 'openai' | 'google' | 'openrouter';

export interface APIKey {
  id: string;
  provider: Provider;
  maskedKey: string | null;
  lastUsedAt: string | null;
  lastTestedAt: string | null;
  testStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useAPIKeys() {
  const { user, isLoading: authLoading } = useAuth();
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAPIKeys = async () => {
    if (!user) {
      setApiKeys([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch('/api/api-keys');

      if (!response.ok) {
        throw new Error('Failed to fetch API keys');
      }

      const data = await response.json();
      setApiKeys(data.apiKeys || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching API keys:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchAPIKeys();
    }
  }, [user, authLoading]);

  const addOrUpdateKey = async (provider: Provider, apiKey: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider, apiKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to save API key' };
      }

      await fetchAPIKeys(); // Refresh the list
      return { success: true };
    } catch (err) {
      console.error('Error saving API key:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  };

  const deleteKey = async (provider: Provider): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/api-keys?provider=${provider}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to delete API key' };
      }

      await fetchAPIKeys(); // Refresh the list
      return { success: true };
    } catch (err) {
      console.error('Error deleting API key:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  };

  const testConnection = async (provider: Provider): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/api-keys/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider }),
      });

      const data = await response.json();

      await fetchAPIKeys(); // Refresh to get updated test status

      return {
        success: data.success,
        error: data.error || (!data.success ? 'Connection test failed' : undefined),
      };
    } catch (err) {
      console.error('Error testing connection:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  };

  const getKeyByProvider = (provider: Provider): APIKey | undefined => {
    return apiKeys.find((key) => key.provider === provider);
  };

  return {
    apiKeys,
    isLoading: authLoading || isLoading,
    error,
    addOrUpdateKey,
    deleteKey,
    testConnection,
    getKeyByProvider,
    refetch: fetchAPIKeys,
  };
}
