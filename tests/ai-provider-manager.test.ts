import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIProviderManager } from '@/lib/ai/provider-manager';
import type { AIProvider, AIProviderConfig, AICompletionOptions, AIUsageRecord } from '@/types/ai';

// Mock the provider classes
vi.mock('@/lib/ai/providers/anthropic', () => ({
  AnthropicProvider: vi.fn().mockImplementation(() => ({
    complete: vi.fn(),
    stream: vi.fn(),
    validateConfig: vi.fn(),
  })),
}));

vi.mock('@/lib/ai/providers/openai', () => ({
  OpenAIProvider: vi.fn().mockImplementation(() => ({
    complete: vi.fn(),
    stream: vi.fn(),
    validateConfig: vi.fn(),
  })),
}));

vi.mock('@/lib/ai/providers/google', () => ({
  GoogleProvider: vi.fn().mockImplementation(() => ({
    complete: vi.fn(),
    stream: vi.fn(),
    validateConfig: vi.fn(),
  })),
}));

vi.mock('@/lib/ai/providers/openrouter', () => ({
  OpenRouterProvider: vi.fn().mockImplementation(() => ({
    complete: vi.fn(),
    stream: vi.fn(),
    validateConfig: vi.fn(),
  })),
}));

describe('AIProviderManager', () => {
  let manager: AIProviderManager;
  let mockProviders: Map<AIProvider, any>;
  let mockUsageRecord: AIUsageRecord[];

  beforeEach(() => {
    mockUsageRecord = [];
    
    const config: AIProviderConfig = {
      apiKey: 'test-key',
      model: 'test-model',
      maxTokens: 1000,
      temperature: 0.7,
    };

    const providers = new Map<AIProvider, AIProviderConfig>([
      ['anthropic', config],
      ['openai', config],
      ['google', config],
      ['openrouter', config],
    ]);

    manager = new AIProviderManager({
      providers,
      failover: {
        providers: ['anthropic', 'openai', 'google', 'openrouter'],
        maxRetries: 2,
        retryDelay: 1000,
      },
      onUsageRecord: async (record) => {
        mockUsageRecord.push(record);
      },
    });

    // Get the mock providers
    mockProviders = new Map();
    for (const [provider, instance] of (manager as any).providers) {
      mockProviders.set(provider, instance);
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize all providers', () => {
      expect(mockProviders.has('anthropic')).toBe(true);
      expect(mockProviders.has('openai')).toBe(true);
      expect(mockProviders.has('google')).toBe(true);
      expect(mockProviders.has('openrouter')).toBe(true);
    });

    it('should set initial provider status', () => {
      const statuses = manager.getAllProviderStatuses();
      expect(statuses).toHaveLength(4);
      expect(statuses.every(status => status.available)).toBe(true);
    });
  });

  describe('Provider Selection', () => {
    it('should use preferred provider when available', async () => {
      const mockComplete = vi.fn().mockResolvedValue({
        content: 'Test response',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, cost: 0.01 },
        error: null,
      });

      mockProviders.get('openai').complete = mockComplete;

      const options: AICompletionOptions = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'test-model',
        userId: 'test-user',
      };

      await manager.complete(options, 'openai');

      expect(mockComplete).toHaveBeenCalledWith(options);
    });

    it('should fallback to next provider on failure', async () => {
      const mockComplete1 = vi.fn().mockRejectedValue(new Error('Provider 1 failed'));
      const mockComplete2 = vi.fn().mockResolvedValue({
        content: 'Test response',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, cost: 0.01 },
        error: null,
      });

      mockProviders.get('anthropic').complete = mockComplete1;
      mockProviders.get('openai').complete = mockComplete2;

      const options: AICompletionOptions = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'test-model',
        userId: 'test-user',
      };

      const result = await manager.complete(options, 'anthropic');

      expect(mockComplete1).toHaveBeenCalled();
      expect(mockComplete2).toHaveBeenCalled();
      expect(result.content).toBe('Test response');
    });

    it('should throw error when all providers fail', async () => {
      const mockComplete = vi.fn().mockRejectedValue(new Error('All providers failed'));
      
      for (const provider of mockProviders.values()) {
        provider.complete = mockComplete;
      }

      const options: AICompletionOptions = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'test-model',
        userId: 'test-user',
      };

      await expect(manager.complete(options)).rejects.toThrow('All providers failed');
    });
  });

  describe('Usage Tracking', () => {
    it('should record usage on successful completion', async () => {
      const mockComplete = vi.fn().mockResolvedValue({
        content: 'Test response',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, cost: 0.01 },
        error: null,
      });

      mockProviders.get('anthropic').complete = mockComplete;

      const options: AICompletionOptions = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'test-model',
        userId: 'test-user',
      };

      await manager.complete(options, 'anthropic');

      expect(mockUsageRecord).toHaveLength(1);
      expect(mockUsageRecord[0].provider).toBe('anthropic');
      expect(mockUsageRecord[0].userId).toBe('test-user');
      expect(mockUsageRecord[0].totalTokens).toBe(15);
      expect(mockUsageRecord[0].cost).toBe(0.01);
    });

    it('should track usage statistics correctly', async () => {
      // Mock successful completions
      const mockComplete = vi.fn().mockResolvedValue({
        content: 'Test response',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, cost: 0.01 },
        error: null,
      });

      for (const provider of mockProviders.values()) {
        provider.complete = mockComplete;
      }

      const options: AICompletionOptions = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'test-model',
        userId: 'test-user',
      };

      // Make multiple requests
      await manager.complete(options, 'anthropic');
      await manager.complete(options, 'openai');

      const stats = manager.getUsageStats();
      expect(stats.requestCount).toBe(2);
      expect(stats.totalCost).toBe(0.02);
      expect(stats.totalTokens).toBe(30);
      expect(stats.byProvider.anthropic.requests).toBe(1);
      expect(stats.byProvider.openai.requests).toBe(1);
    });
  });

  describe('Provider Status Management', () => {
    it('should update provider status on failure', async () => {
      const mockComplete = vi.fn().mockRejectedValue(new Error('Provider failed'));
      mockProviders.get('anthropic').complete = mockComplete;

      const options: AICompletionOptions = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'test-model',
        userId: 'test-user',
      };

      try {
        await manager.complete(options, 'anthropic');
      } catch (error) {
        // Expected to fail
      }

      const status = manager.getProviderStatus('anthropic');
      expect(status?.available).toBe(false);
      expect(status?.error).toBe('Provider failed');
    });

    it('should validate all providers', async () => {
      const mockValidate = vi.fn().mockResolvedValue(true);
      for (const provider of mockProviders.values()) {
        provider.validateConfig = mockValidate;
      }

      const results = await manager.validateAllProviders();
      
      expect(results.anthropic.valid).toBe(true);
      expect(results.openai.valid).toBe(true);
      expect(results.google.valid).toBe(true);
      expect(results.openrouter.valid).toBe(true);
    });
  });

  describe('Streaming', () => {
    it('should handle streaming with failover', async () => {
      const mockStream = vi.fn().mockImplementation(async (options, handler) => {
        handler.onChunk?.('chunk1');
        handler.onChunk?.('chunk2');
        handler.onComplete?.({
          content: 'Stream complete',
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, cost: 0.01 },
          error: null,
        });
      });

      mockProviders.get('anthropic').stream = mockStream;

      const options: AICompletionOptions = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'test-model',
        userId: 'test-user',
      };

      const chunks: string[] = [];
      const handler = {
        onChunk: (chunk: string) => chunks.push(chunk),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      await manager.stream(options, handler, 'anthropic');

      expect(chunks).toEqual(['chunk1', 'chunk2']);
      expect(handler.onComplete).toHaveBeenCalled();
      expect(mockUsageRecord).toHaveLength(1);
    });

    it('should handle streaming errors with failover', async () => {
      const mockStream1 = vi.fn().mockRejectedValue(new Error('Stream failed'));
      const mockStream2 = vi.fn().mockImplementation(async (options, handler) => {
        handler.onChunk?.('chunk1');
        handler.onComplete?.({
          content: 'Stream complete',
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, cost: 0.01 },
          error: null,
        });
      });

      mockProviders.get('anthropic').stream = mockStream1;
      mockProviders.get('openai').stream = mockStream2;

      const options: AICompletionOptions = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'test-model',
        userId: 'test-user',
      };

      const handler = {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      await manager.stream(options, handler, 'anthropic');

      expect(mockStream1).toHaveBeenCalled();
      expect(mockStream2).toHaveBeenCalled();
      expect(handler.onComplete).toHaveBeenCalled();
    });
  });

  describe('Provider Availability', () => {
    it('should return available providers', () => {
      const available = manager.getAvailableProviders();
      expect(available).toContain('anthropic');
      expect(available).toContain('openai');
      expect(available).toContain('google');
      expect(available).toContain('openrouter');
    });

    it('should check if specific provider is available', () => {
      expect(manager.isProviderAvailable('anthropic')).toBe(true);
      expect(manager.isProviderAvailable('openai')).toBe(true);
    });

    it('should get specific provider instance', () => {
      const provider = manager.getProvider('anthropic');
      expect(provider).toBeDefined();
    });
  });

  describe('Usage Records Filtering', () => {
    beforeEach(async () => {
      // Create some test usage records
      const mockComplete = vi.fn().mockResolvedValue({
        content: 'Test response',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, cost: 0.01 },
        error: null,
      });

      for (const provider of mockProviders.values()) {
        provider.complete = mockComplete;
      }

      const options: AICompletionOptions = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'test-model',
        userId: 'user1',
      };

      await manager.complete(options, 'anthropic');
      await manager.complete(options, 'openai');
    });

    it('should filter usage records by user', () => {
      const records = manager.getUsageRecords({ userId: 'user1' });
      expect(records).toHaveLength(2);
      expect(records.every(r => r.userId === 'user1')).toBe(true);
    });

    it('should filter usage records by provider', () => {
      const records = manager.getUsageRecords({ provider: 'anthropic' });
      expect(records).toHaveLength(1);
      expect(records[0].provider).toBe('anthropic');
    });

    it('should filter usage records by date range', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const records = manager.getUsageRecords({ 
        startDate: yesterday,
        endDate: now 
      });
      expect(records).toHaveLength(2);
    });
  });
});
