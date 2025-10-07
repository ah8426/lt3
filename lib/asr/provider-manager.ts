import { DeepgramProvider } from './providers/deepgram';
import { AssemblyAIProvider } from './providers/assemblyai';
import { GoogleSpeechProvider } from './providers/google-speech';
import type { TranscriptionSegment } from './providers/deepgram';

export type ASRProviderType = 'deepgram' | 'assemblyai' | 'google-speech';

export interface ProviderConfig {
  type: ASRProviderType;
  apiKey: string;
  priority: number; // Lower number = higher priority
  enabled: boolean;
}

export interface StreamCallbacks {
  onTranscript?: (segment: TranscriptionSegment) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
  onOpen?: () => void;
  onProviderSwitch?: (fromProvider: ASRProviderType, toProvider: ASRProviderType) => void;
}

export interface UsageMetrics {
  provider: ASRProviderType;
  durationMs: number;
  cost: number;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

export interface ProviderStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalDurationMs: number;
  totalCost: number;
  averageConfidence: number;
  lastUsed: Date | null;
}

/**
 * ASR Provider Manager
 * Handles provider selection, automatic failover, cost tracking, and usage metrics
 */
export class ASRProviderManager {
  private providers: Map<
    ASRProviderType,
    DeepgramProvider | AssemblyAIProvider | GoogleSpeechProvider
  > = new Map();
  private providerConfigs: ProviderConfig[] = [];
  private currentProvider: ASRProviderType | null = null;
  private usageMetrics: UsageMetrics[] = [];
  private providerStats: Map<ASRProviderType, ProviderStats> = new Map();
  private failoverAttempts: number = 0;
  private maxFailoverAttempts: number = 3;

  constructor(configs: ProviderConfig[]) {
    this.providerConfigs = configs.sort((a, b) => a.priority - b.priority);
    this.initializeProviders();
    this.initializeStats();
  }

  /**
   * Initialize provider instances
   */
  private initializeProviders(): void {
    for (const config of this.providerConfigs) {
      if (!config.enabled) continue;

      switch (config.type) {
        case 'deepgram':
          this.providers.set(config.type, new DeepgramProvider({ apiKey: config.apiKey }));
          break;
        case 'assemblyai':
          this.providers.set(
            config.type,
            new AssemblyAIProvider({ apiKey: config.apiKey })
          );
          break;
        case 'google-speech':
          this.providers.set(
            config.type,
            new GoogleSpeechProvider({ apiKey: config.apiKey })
          );
          break;
      }
    }
  }

  /**
   * Initialize stats for each provider
   */
  private initializeStats(): void {
    for (const config of this.providerConfigs) {
      this.providerStats.set(config.type, {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        totalDurationMs: 0,
        totalCost: 0,
        averageConfidence: 0,
        lastUsed: null,
      });
    }
  }

  /**
   * Get the best available provider based on priority and health
   */
  private getBestProvider(): ASRProviderType | null {
    // Try providers in priority order
    for (const config of this.providerConfigs) {
      if (!config.enabled) continue;

      const provider = this.providers.get(config.type);
      if (!provider) continue;

      const stats = this.providerStats.get(config.type);
      if (!stats) continue;

      // Check provider health (success rate)
      const successRate =
        stats.totalCalls > 0 ? stats.successfulCalls / stats.totalCalls : 1;

      // Use provider if success rate is above 50% or hasn't been used yet
      if (successRate >= 0.5 || stats.totalCalls === 0) {
        return config.type;
      }
    }

    // If all providers have poor health, try the highest priority one anyway
    const firstEnabled = this.providerConfigs.find((c) => c.enabled);
    return firstEnabled ? firstEnabled.type : null;
  }

  /**
   * Start streaming transcription with automatic failover
   */
  async startStream(callbacks: StreamCallbacks): Promise<void> {
    const providerType = this.getBestProvider();
    if (!providerType) {
      throw new Error('No ASR providers available');
    }

    await this.startStreamWithProvider(providerType, callbacks);
  }

  /**
   * Start stream with specific provider
   */
  private async startStreamWithProvider(
    providerType: ASRProviderType,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new Error(`Provider ${providerType} not initialized`);
    }

    this.currentProvider = providerType;
    this.failoverAttempts = 0;

    // Wrap callbacks with failover logic
    const wrappedCallbacks = {
      ...callbacks,
      onError: async (error: Error) => {
        console.error(`Error from ${providerType}:`, error);

        // Record failed attempt
        this.recordFailure(providerType, error.message);

        // Attempt failover
        if (this.failoverAttempts < this.maxFailoverAttempts) {
          this.failoverAttempts++;

          const nextProvider = this.getNextProvider(providerType);
          if (nextProvider) {
            console.log(`Failing over from ${providerType} to ${nextProvider}`);

            if (callbacks.onProviderSwitch) {
              callbacks.onProviderSwitch(providerType, nextProvider);
            }

            // Stop current provider
            await provider.stopStream();

            // Start with next provider
            await this.startStreamWithProvider(nextProvider, callbacks);
            return;
          }
        }

        // Call original error callback if failover exhausted
        if (callbacks.onError) {
          callbacks.onError(error);
        }
      },
      onOpen: () => {
        console.log(`Stream opened with ${providerType}`);
        if (callbacks.onOpen) {
          callbacks.onOpen();
        }
      },
    };

    // Start stream with provider
    await provider.startStream(wrappedCallbacks);
  }

  /**
   * Get next available provider for failover
   */
  private getNextProvider(currentProvider: ASRProviderType): ASRProviderType | null {
    const currentIndex = this.providerConfigs.findIndex(
      (c) => c.type === currentProvider
    );

    // Try providers after current one
    for (let i = currentIndex + 1; i < this.providerConfigs.length; i++) {
      const config = this.providerConfigs[i];
      if (config.enabled && this.providers.has(config.type)) {
        return config.type;
      }
    }

    // Try providers before current one
    for (let i = 0; i < currentIndex; i++) {
      const config = this.providerConfigs[i];
      if (config.enabled && this.providers.has(config.type)) {
        return config.type;
      }
    }

    return null;
  }

  /**
   * Send audio to current provider
   */
  sendAudio(audioData: Buffer | Uint8Array): void {
    if (!this.currentProvider) {
      throw new Error('No active stream');
    }

    const provider = this.providers.get(this.currentProvider);
    if (!provider) {
      throw new Error('Current provider not found');
    }

    provider.sendAudio(audioData);
  }

  /**
   * Stop current stream
   */
  async stopStream(): Promise<void> {
    if (!this.currentProvider) {
      return;
    }

    const provider = this.providers.get(this.currentProvider);
    if (provider) {
      await provider.stopStream();
    }

    this.currentProvider = null;
  }

  /**
   * Record usage metrics
   */
  recordUsage(
    provider: ASRProviderType,
    durationMs: number,
    success: boolean,
    errorMessage?: string
  ): void {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) return;

    const cost = providerInstance.calculateCost(durationMs, true);

    const metric: UsageMetrics = {
      provider,
      durationMs,
      cost,
      timestamp: new Date(),
      success,
      errorMessage,
    };

    this.usageMetrics.push(metric);

    // Update provider stats
    const stats = this.providerStats.get(provider);
    if (stats) {
      stats.totalCalls++;
      if (success) {
        stats.successfulCalls++;
      } else {
        stats.failedCalls++;
      }
      stats.totalDurationMs += durationMs;
      stats.totalCost += cost;
      stats.lastUsed = new Date();
    }
  }

  /**
   * Record failure
   */
  private recordFailure(provider: ASRProviderType, errorMessage: string): void {
    const stats = this.providerStats.get(provider);
    if (stats) {
      stats.totalCalls++;
      stats.failedCalls++;
      stats.lastUsed = new Date();
    }

    this.usageMetrics.push({
      provider,
      durationMs: 0,
      cost: 0,
      timestamp: new Date(),
      success: false,
      errorMessage,
    });
  }

  /**
   * Get usage metrics for a time period
   */
  getUsageMetrics(startDate?: Date, endDate?: Date): UsageMetrics[] {
    let metrics = this.usageMetrics;

    if (startDate) {
      metrics = metrics.filter((m) => m.timestamp >= startDate);
    }

    if (endDate) {
      metrics = metrics.filter((m) => m.timestamp <= endDate);
    }

    return metrics;
  }

  /**
   * Get stats for a provider
   */
  getProviderStats(provider: ASRProviderType): ProviderStats | null {
    return this.providerStats.get(provider) || null;
  }

  /**
   * Get all provider stats
   */
  getAllProviderStats(): Map<ASRProviderType, ProviderStats> {
    return new Map(this.providerStats);
  }

  /**
   * Get total cost for a time period
   */
  getTotalCost(startDate?: Date, endDate?: Date): number {
    const metrics = this.getUsageMetrics(startDate, endDate);
    return metrics.reduce((sum, m) => sum + m.cost, 0);
  }

  /**
   * Get total duration for a time period
   */
  getTotalDuration(startDate?: Date, endDate?: Date): number {
    const metrics = this.getUsageMetrics(startDate, endDate);
    return metrics.reduce((sum, m) => sum + m.durationMs, 0);
  }

  /**
   * Get cost breakdown by provider
   */
  getCostBreakdown(
    startDate?: Date,
    endDate?: Date
  ): Map<ASRProviderType, number> {
    const metrics = this.getUsageMetrics(startDate, endDate);
    const breakdown = new Map<ASRProviderType, number>();

    for (const metric of metrics) {
      const current = breakdown.get(metric.provider) || 0;
      breakdown.set(metric.provider, current + metric.cost);
    }

    return breakdown;
  }

  /**
   * Get current provider
   */
  getCurrentProvider(): ASRProviderType | null {
    return this.currentProvider;
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): ASRProviderType[] {
    return this.providerConfigs
      .filter((c) => c.enabled && this.providers.has(c.type))
      .map((c) => c.type);
  }

  /**
   * Check if a provider is available
   */
  isProviderAvailable(provider: ASRProviderType): boolean {
    return this.providers.has(provider);
  }

  /**
   * Get provider pricing comparison
   */
  getPricingComparison(): Array<{
    provider: ASRProviderType;
    streaming: number;
    batch: number;
  }> {
    const comparison: Array<{
      provider: ASRProviderType;
      streaming: number;
      batch: number;
    }> = [];

    for (const [type, provider] of this.providers) {
      const pricing = provider.getPricing();
      comparison.push({
        provider: type,
        streaming: pricing.streaming,
        batch: pricing.batch,
      });
    }

    return comparison.sort((a, b) => a.streaming - b.streaming);
  }

  /**
   * Clear usage metrics
   */
  clearMetrics(): void {
    this.usageMetrics = [];
    this.initializeStats();
  }

  /**
   * Cleanup all providers
   */
  async cleanup(): Promise<void> {
    for (const [, provider] of this.providers) {
      await provider.stopStream();
    }
    this.providers.clear();
    this.currentProvider = null;
  }
}

/**
 * Create ASR provider manager with user's API keys
 */
export function createASRProviderManager(
  userApiKeys: Array<{ provider: ASRProviderType; apiKey: string; priority?: number }>
): ASRProviderManager {
  const configs: ProviderConfig[] = userApiKeys.map((key, index) => ({
    type: key.provider,
    apiKey: key.apiKey,
    priority: key.priority ?? index,
    enabled: true,
  }));

  return new ASRProviderManager(configs);
}
