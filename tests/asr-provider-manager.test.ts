import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ASRProviderManager, createASRProviderManager } from '@/lib/asr/provider-manager';
import type { ASRProviderType, ProviderConfig, StreamCallbacks, UsageMetrics } from '@/lib/asr/provider-manager';

// Mock the provider classes
vi.mock('@/lib/asr/providers/deepgram', () => ({
  DeepgramProvider: vi.fn().mockImplementation(() => ({
    startStream: vi.fn(),
    stopStream: vi.fn(),
    sendAudio: vi.fn(),
    calculateCost: vi.fn().mockReturnValue(0.01),
    getPricing: vi.fn().mockReturnValue({ streaming: 0.01, batch: 0.005 }),
  })),
}));

vi.mock('@/lib/asr/providers/assemblyai', () => ({
  AssemblyAIProvider: vi.fn().mockImplementation(() => ({
    startStream: vi.fn(),
    stopStream: vi.fn(),
    sendAudio: vi.fn(),
    calculateCost: vi.fn().mockReturnValue(0.008),
    getPricing: vi.fn().mockReturnValue({ streaming: 0.008, batch: 0.004 }),
  })),
}));

vi.mock('@/lib/asr/providers/google-speech', () => ({
  GoogleSpeechProvider: vi.fn().mockImplementation(() => ({
    startStream: vi.fn(),
    stopStream: vi.fn(),
    sendAudio: vi.fn(),
    calculateCost: vi.fn().mockReturnValue(0.012),
    getPricing: vi.fn().mockReturnValue({ streaming: 0.012, batch: 0.006 }),
  })),
}));

describe('ASRProviderManager', () => {
  let manager: ASRProviderManager;
  let mockProviders: Map<ASRProviderType, any>;
  let mockCallbacks: StreamCallbacks;

  beforeEach(() => {
    const configs: ProviderConfig[] = [
      { type: 'deepgram', apiKey: 'test-key-1', priority: 1, enabled: true },
      { type: 'assemblyai', apiKey: 'test-key-2', priority: 2, enabled: true },
      { type: 'google-speech', apiKey: 'test-key-3', priority: 3, enabled: true },
    ];

    manager = new ASRProviderManager(configs);

    // Get the mock providers
    mockProviders = new Map();
    for (const [provider, instance] of (manager as any).providers) {
      mockProviders.set(provider, instance);
    }

    mockCallbacks = {
      onTranscript: vi.fn(),
      onError: vi.fn(),
      onClose: vi.fn(),
      onOpen: vi.fn(),
      onProviderSwitch: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize providers in priority order', () => {
      expect(mockProviders.has('deepgram')).toBe(true);
      expect(mockProviders.has('assemblyai')).toBe(true);
      expect(mockProviders.has('google-speech')).toBe(true);
    });

    it('should initialize provider stats', () => {
      const stats = manager.getAllProviderStats();
      expect(stats.size).toBe(3);
      
      for (const [provider, stat] of stats) {
        expect(stat.totalCalls).toBe(0);
        expect(stat.successfulCalls).toBe(0);
        expect(stat.failedCalls).toBe(0);
        expect(stat.totalCost).toBe(0);
      }
    });

    it('should create manager from user API keys', () => {
      const userApiKeys = [
        { provider: 'deepgram' as ASRProviderType, apiKey: 'key1', priority: 1 },
        { provider: 'assemblyai' as ASRProviderType, apiKey: 'key2', priority: 2 },
      ];

      const userManager = createASRProviderManager(userApiKeys);
      expect(userManager).toBeInstanceOf(ASRProviderManager);
    });
  });

  describe('Provider Selection', () => {
    it('should select best provider based on priority', () => {
      const bestProvider = (manager as any).getBestProvider();
      expect(bestProvider).toBe('deepgram');
    });

    it('should handle disabled providers', () => {
      const configs: ProviderConfig[] = [
        { type: 'deepgram', apiKey: 'test-key-1', priority: 1, enabled: false },
        { type: 'assemblyai', apiKey: 'test-key-2', priority: 2, enabled: true },
      ];

      const disabledManager = new ASRProviderManager(configs);
      const available = disabledManager.getAvailableProviders();
      expect(available).toContain('assemblyai');
      expect(available).not.toContain('deepgram');
    });
  });

  describe('Streaming', () => {
    it('should start stream with best provider', async () => {
      const mockStartStream = vi.fn().mockResolvedValue(undefined);
      mockProviders.get('deepgram').startStream = mockStartStream;

      await manager.startStream(mockCallbacks);

      expect(mockStartStream).toHaveBeenCalled();
      expect(manager.getCurrentProvider()).toBe('deepgram');
    });

    it('should handle streaming errors with failover', async () => {
      const mockStartStream1 = vi.fn().mockRejectedValue(new Error('Deepgram failed'));
      const mockStartStream2 = vi.fn().mockResolvedValue(undefined);
      const mockStopStream = vi.fn().mockResolvedValue(undefined);

      mockProviders.get('deepgram').startStream = mockStartStream1;
      mockProviders.get('deepgram').stopStream = mockStopStream;
      mockProviders.get('assemblyai').startStream = mockStartStream2;

      await manager.startStream(mockCallbacks);

      expect(mockStartStream1).toHaveBeenCalled();
      expect(mockStopStream).toHaveBeenCalled();
      expect(mockStartStream2).toHaveBeenCalled();
      expect(mockCallbacks.onProviderSwitch).toHaveBeenCalledWith('deepgram', 'assemblyai');
    });

    it('should throw error when no providers available', async () => {
      const configs: ProviderConfig[] = [
        { type: 'deepgram', apiKey: 'test-key-1', priority: 1, enabled: false },
        { type: 'assemblyai', apiKey: 'test-key-2', priority: 2, enabled: false },
      ];

      const emptyManager = new ASRProviderManager(configs);

      await expect(emptyManager.startStream(mockCallbacks)).rejects.toThrow('No ASR providers available');
    });

    it('should send audio to current provider', () => {
      const mockSendAudio = vi.fn();
      mockProviders.get('deepgram').sendAudio = mockSendAudio;

      // Set current provider
      (manager as any).currentProvider = 'deepgram';

      const audioData = new Uint8Array([1, 2, 3, 4]);
      manager.sendAudio(audioData);

      expect(mockSendAudio).toHaveBeenCalledWith(audioData);
    });

    it('should stop current stream', async () => {
      const mockStopStream = vi.fn().mockResolvedValue(undefined);
      mockProviders.get('deepgram').stopStream = mockStopStream;

      (manager as any).currentProvider = 'deepgram';
      await manager.stopStream();

      expect(mockStopStream).toHaveBeenCalled();
      expect(manager.getCurrentProvider()).toBeNull();
    });
  });

  describe('Usage Tracking', () => {
    it('should record successful usage', () => {
      manager.recordUsage('deepgram', 5000, true);
      
      const stats = manager.getProviderStats('deepgram');
      expect(stats?.totalCalls).toBe(1);
      expect(stats?.successfulCalls).toBe(1);
      expect(stats?.failedCalls).toBe(0);
      expect(stats?.totalCost).toBe(0.01);
    });

    it('should record failed usage', () => {
      manager.recordUsage('deepgram', 5000, false, 'Connection timeout');
      
      const stats = manager.getProviderStats('deepgram');
      expect(stats?.totalCalls).toBe(1);
      expect(stats?.successfulCalls).toBe(0);
      expect(stats?.failedCalls).toBe(1);
    });

    it('should track usage metrics over time', () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = new Date();

      manager.recordUsage('deepgram', 5000, true);
      manager.recordUsage('assemblyai', 3000, true);

      const metrics = manager.getUsageMetrics(startDate, endDate);
      expect(metrics).toHaveLength(2);
      expect(metrics[0].provider).toBe('deepgram');
      expect(metrics[1].provider).toBe('assemblyai');
    });

    it('should calculate total cost for time period', () => {
      manager.recordUsage('deepgram', 5000, true);
      manager.recordUsage('assemblyai', 3000, true);

      const totalCost = manager.getTotalCost();
      expect(totalCost).toBe(0.018); // 0.01 + 0.008
    });

    it('should calculate total duration for time period', () => {
      manager.recordUsage('deepgram', 5000, true);
      manager.recordUsage('assemblyai', 3000, true);

      const totalDuration = manager.getTotalDuration();
      expect(totalDuration).toBe(8000);
    });

    it('should provide cost breakdown by provider', () => {
      manager.recordUsage('deepgram', 5000, true);
      manager.recordUsage('assemblyai', 3000, true);

      const breakdown = manager.getCostBreakdown();
      expect(breakdown.get('deepgram')).toBe(0.01);
      expect(breakdown.get('assemblyai')).toBe(0.008);
    });
  });

  describe('Provider Health', () => {
    it('should select healthy providers over unhealthy ones', () => {
      // Make deepgram unhealthy
      manager.recordUsage('deepgram', 1000, false);
      manager.recordUsage('deepgram', 1000, false);
      manager.recordUsage('deepgram', 1000, false);

      // Make assemblyai healthy
      manager.recordUsage('assemblyai', 1000, true);
      manager.recordUsage('assemblyai', 1000, true);

      const bestProvider = (manager as any).getBestProvider();
      expect(bestProvider).toBe('assemblyai');
    });

    it('should fallback to highest priority when all providers are unhealthy', () => {
      // Make all providers unhealthy
      for (const provider of ['deepgram', 'assemblyai', 'google-speech'] as ASRProviderType[]) {
        manager.recordUsage(provider, 1000, false);
        manager.recordUsage(provider, 1000, false);
        manager.recordUsage(provider, 1000, false);
      }

      const bestProvider = (manager as any).getBestProvider();
      expect(bestProvider).toBe('deepgram'); // Highest priority
    });
  });

  describe('Provider Information', () => {
    it('should return available providers', () => {
      const available = manager.getAvailableProviders();
      expect(available).toContain('deepgram');
      expect(available).toContain('assemblyai');
      expect(available).toContain('google-speech');
    });

    it('should check if provider is available', () => {
      expect(manager.isProviderAvailable('deepgram')).toBe(true);
      expect(manager.isProviderAvailable('nonexistent')).toBe(false);
    });

    it('should get pricing comparison', () => {
      const pricing = manager.getPricingComparison();
      expect(pricing).toHaveLength(3);
      expect(pricing[0].provider).toBe('assemblyai'); // Lowest cost
      expect(pricing[0].streaming).toBe(0.008);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup all providers', async () => {
      const mockStopStream = vi.fn().mockResolvedValue(undefined);
      for (const provider of mockProviders.values()) {
        provider.stopStream = mockStopStream;
      }

      await manager.cleanup();

      expect(mockStopStream).toHaveBeenCalledTimes(3);
      expect(manager.getCurrentProvider()).toBeNull();
    });

    it('should clear metrics', () => {
      manager.recordUsage('deepgram', 1000, true);
      expect(manager.getUsageMetrics()).toHaveLength(1);

      manager.clearMetrics();
      expect(manager.getUsageMetrics()).toHaveLength(0);
    });
  });

  describe('Failover Logic', () => {
    it('should attempt failover on error', async () => {
      const mockStartStream1 = vi.fn().mockRejectedValue(new Error('Provider 1 failed'));
      const mockStartStream2 = vi.fn().mockResolvedValue(undefined);
      const mockStopStream = vi.fn().mockResolvedValue(undefined);

      mockProviders.get('deepgram').startStream = mockStartStream1;
      mockProviders.get('deepgram').stopStream = mockStopStream;
      mockProviders.get('assemblyai').startStream = mockStartStream2;

      await manager.startStream(mockCallbacks);

      expect(mockStartStream1).toHaveBeenCalled();
      expect(mockStopStream).toHaveBeenCalled();
      expect(mockStartStream2).toHaveBeenCalled();
    });

    it('should respect max failover attempts', async () => {
      const mockStartStream = vi.fn().mockRejectedValue(new Error('All providers failed'));
      const mockStopStream = vi.fn().mockResolvedValue(undefined);

      for (const provider of mockProviders.values()) {
        provider.startStream = mockStartStream;
        provider.stopStream = mockStopStream;
      }

      await manager.startStream(mockCallbacks);

      expect(mockCallbacks.onError).toHaveBeenCalled();
    });
  });
});
