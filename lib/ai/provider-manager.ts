import type {
  AIProvider,
  AIProviderInterface,
  AICompletionOptions,
  AICompletionResult,
  AIStreamHandler,
  AIProviderConfig,
  AIProviderStatus,
  AIFailoverConfig,
  AIUsageRecord,
} from '@/types/ai'
import { AnthropicProvider } from './providers/anthropic'
import { OpenAIProvider } from './providers/openai'
import { GoogleProvider } from './providers/google'
import { OpenRouterProvider } from './providers/openrouter'

export interface ProviderManagerConfig {
  providers: Map<AIProvider, AIProviderConfig>
  failover?: AIFailoverConfig
  onUsageRecord?: (record: AIUsageRecord) => Promise<void>
}

/**
 * Manages multiple AI providers with automatic failover and usage tracking
 */
export class AIProviderManager {
  private providers: Map<AIProvider, AIProviderInterface> = new Map()
  private providerStatus: Map<AIProvider, AIProviderStatus> = new Map()
  private failoverConfig?: AIFailoverConfig
  private onUsageRecord?: (record: AIUsageRecord) => Promise<void>
  private usageRecords: AIUsageRecord[] = []

  constructor(config: ProviderManagerConfig) {
    this.failoverConfig = config.failover
    this.onUsageRecord = config.onUsageRecord

    // Initialize providers
    for (const [provider, providerConfig] of config.providers) {
      this.initializeProvider(provider, providerConfig)
    }
  }

  /**
   * Initialize a provider
   */
  private initializeProvider(provider: AIProvider, config: AIProviderConfig): void {
    try {
      let providerInstance: AIProviderInterface

      switch (provider) {
        case 'anthropic':
          providerInstance = new AnthropicProvider(config)
          break
        case 'openai':
          providerInstance = new OpenAIProvider(config)
          break
        case 'google':
          providerInstance = new GoogleProvider(config)
          break
        case 'openrouter':
          providerInstance = new OpenRouterProvider(config)
          break
        default:
          throw new Error(`Unknown provider: ${provider}`)
      }

      this.providers.set(provider, providerInstance)
      this.providerStatus.set(provider, {
        provider,
        available: true,
        lastChecked: new Date(),
      })
    } catch (error) {
      console.error(`Failed to initialize provider ${provider}:`, error)
      this.providerStatus.set(provider, {
        provider,
        available: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Complete a chat completion with automatic provider selection and failover
   */
  async complete(
    options: AICompletionOptions,
    preferredProvider?: AIProvider
  ): Promise<AICompletionResult> {
    const providers = this.getProviderOrder(preferredProvider)
    let lastError: Error | undefined

    for (const provider of providers) {
      const providerInstance = this.providers.get(provider)
      if (!providerInstance) continue

      const status = this.providerStatus.get(provider)
      if (!status?.available) continue

      try {
        const result = await providerInstance.complete(options)

        // Check if there was an error
        if (result.finishReason === 'error' && result.error) {
          throw new Error(result.error)
        }

        // Record usage
        await this.recordUsage({
          id: crypto.randomUUID(),
          userId: options.userId || 'anonymous',
          provider,
          model: options.model,
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
          cost: result.usage.cost,
          createdAt: new Date(),
        })

        // Mark provider as available
        this.updateProviderStatus(provider, true)

        return result
      } catch (error) {
        console.error(`Provider ${provider} failed:`, error)
        lastError = error instanceof Error ? error : new Error('Unknown error')

        // Mark provider as unavailable
        this.updateProviderStatus(provider, false, lastError.message)

        // Continue to next provider
        continue
      }
    }

    // All providers failed
    throw new Error(
      `All providers failed. Last error: ${lastError?.message || 'Unknown error'}`
    )
  }

  /**
   * Stream a chat completion with automatic provider selection and failover
   */
  async stream(
    options: AICompletionOptions,
    handler: AIStreamHandler,
    preferredProvider?: AIProvider
  ): Promise<void> {
    const providers = this.getProviderOrder(preferredProvider)
    let lastError: Error | undefined

    for (const provider of providers) {
      const providerInstance = this.providers.get(provider)
      if (!providerInstance) continue

      const status = this.providerStatus.get(provider)
      if (!status?.available) continue

      try {
        // Wrap handler to record usage
        const wrappedHandler: AIStreamHandler = {
          onChunk: handler.onChunk,
          onComplete: async (result) => {
            // Record usage
            await this.recordUsage({
              id: crypto.randomUUID(),
              userId: options.userId || 'anonymous',
              provider,
              model: options.model,
              promptTokens: result.usage.promptTokens,
              completionTokens: result.usage.completionTokens,
              totalTokens: result.usage.totalTokens,
              cost: result.usage.cost,
              createdAt: new Date(),
            })

            // Mark provider as available
            this.updateProviderStatus(provider, true)

            handler.onComplete?.(result)
          },
          onError: (error) => {
            // Mark provider as unavailable
            this.updateProviderStatus(provider, false, error.message)
            handler.onError?.(error)
          },
        }

        await providerInstance.stream(options, wrappedHandler)
        return // Success
      } catch (error) {
        console.error(`Provider ${provider} failed:`, error)
        lastError = error instanceof Error ? error : new Error('Unknown error')

        // Mark provider as unavailable
        this.updateProviderStatus(provider, false, lastError.message)

        // Continue to next provider
        continue
      }
    }

    // All providers failed
    const error = new Error(
      `All providers failed. Last error: ${lastError?.message || 'Unknown error'}`
    )
    handler.onError?.(error)
    throw error
  }

  /**
   * Get provider order for failover
   */
  private getProviderOrder(preferredProvider?: AIProvider): AIProvider[] {
    if (!this.failoverConfig) {
      // No failover config, just use preferred provider or first available
      if (preferredProvider && this.providers.has(preferredProvider)) {
        return [preferredProvider]
      }
      return Array.from(this.providers.keys())
    }

    const providers = [...this.failoverConfig.providers]

    // Move preferred provider to front if specified
    if (preferredProvider && providers.includes(preferredProvider)) {
      providers.splice(providers.indexOf(preferredProvider), 1)
      providers.unshift(preferredProvider)
    }

    return providers
  }

  /**
   * Update provider status
   */
  private updateProviderStatus(
    provider: AIProvider,
    available: boolean,
    error?: string
  ): void {
    this.providerStatus.set(provider, {
      provider,
      available,
      lastChecked: new Date(),
      error: available ? undefined : error,
    })
  }

  /**
   * Record usage
   */
  private async recordUsage(record: AIUsageRecord): Promise<void> {
    this.usageRecords.push(record)

    // Call custom handler if provided
    if (this.onUsageRecord) {
      try {
        await this.onUsageRecord(record)
      } catch (error) {
        console.error('Failed to record usage:', error)
      }
    }
  }

  /**
   * Get provider status
   */
  getProviderStatus(provider: AIProvider): AIProviderStatus | undefined {
    return this.providerStatus.get(provider)
  }

  /**
   * Get all provider statuses
   */
  getAllProviderStatuses(): AIProviderStatus[] {
    return Array.from(this.providerStatus.values())
  }

  /**
   * Get usage records
   */
  getUsageRecords(
    filters?: {
      userId?: string
      provider?: AIProvider
      startDate?: Date
      endDate?: Date
    }
  ): AIUsageRecord[] {
    let records = [...this.usageRecords]

    if (filters?.userId) {
      records = records.filter((r) => r.userId === filters.userId)
    }

    if (filters?.provider) {
      records = records.filter((r) => r.provider === filters.provider)
    }

    if (filters?.startDate) {
      records = records.filter((r) => r.createdAt >= filters.startDate!)
    }

    if (filters?.endDate) {
      records = records.filter((r) => r.createdAt <= filters.endDate!)
    }

    return records
  }

  /**
   * Get aggregated usage statistics
   */
  getUsageStats(
    filters?: {
      userId?: string
      provider?: AIProvider
      startDate?: Date
      endDate?: Date
    }
  ): {
    totalCost: number
    totalTokens: number
    totalPromptTokens: number
    totalCompletionTokens: number
    requestCount: number
    byProvider: Record<AIProvider, { cost: number; tokens: number; requests: number }>
    byModel: Record<string, { cost: number; tokens: number; requests: number }>
  } {
    const records = this.getUsageRecords(filters)

    const stats = {
      totalCost: 0,
      totalTokens: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      requestCount: records.length,
      byProvider: {} as Record<
        AIProvider,
        { cost: number; tokens: number; requests: number }
      >,
      byModel: {} as Record<string, { cost: number; tokens: number; requests: number }>,
    }

    for (const record of records) {
      stats.totalCost += record.cost
      stats.totalTokens += record.totalTokens
      stats.totalPromptTokens += record.promptTokens
      stats.totalCompletionTokens += record.completionTokens

      // By provider
      if (!stats.byProvider[record.provider]) {
        stats.byProvider[record.provider] = { cost: 0, tokens: 0, requests: 0 }
      }
      stats.byProvider[record.provider].cost += record.cost
      stats.byProvider[record.provider].tokens += record.totalTokens
      stats.byProvider[record.provider].requests += 1

      // By model
      if (!stats.byModel[record.model]) {
        stats.byModel[record.model] = { cost: 0, tokens: 0, requests: 0 }
      }
      stats.byModel[record.model].cost += record.cost
      stats.byModel[record.model].tokens += record.totalTokens
      stats.byModel[record.model].requests += 1
    }

    return stats
  }

  /**
   * Validate all provider configurations
   */
  async validateAllProviders(): Promise<
    Record<AIProvider, { valid: boolean; error?: string }>
  > {
    const results: Record<AIProvider, { valid: boolean; error?: string }> = {} as any

    for (const [provider, instance] of this.providers) {
      try {
        const valid = await instance.validateConfig()
        results[provider] = { valid }

        // Update status
        this.updateProviderStatus(provider, valid, valid ? undefined : 'Validation failed')
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results[provider] = { valid: false, error: errorMessage }
        this.updateProviderStatus(provider, false, errorMessage)
      }
    }

    return results
  }

  /**
   * Get a specific provider instance
   */
  getProvider(provider: AIProvider): AIProviderInterface | undefined {
    return this.providers.get(provider)
  }

  /**
   * Check if a provider is available
   */
  isProviderAvailable(provider: AIProvider): boolean {
    return this.providerStatus.get(provider)?.available ?? false
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): AIProvider[] {
    return Array.from(this.providerStatus.entries())
      .filter(([, status]) => status.available)
      .map(([provider]) => provider)
  }
}
