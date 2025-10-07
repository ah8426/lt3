/**
 * Common AI provider types and interfaces
 */

export type AIProvider = 'anthropic' | 'openai' | 'google' | 'openrouter'

export type AIModel = {
  id: string
  name: string
  provider: AIProvider
  contextWindow: number
  maxOutputTokens: number
  inputCostPer1M: number // Cost per 1M input tokens
  outputCostPer1M: number // Cost per 1M output tokens
  supportsStreaming: boolean
  supportsTools: boolean
  supportsVision: boolean
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | AIContentPart[]
  name?: string // For tool messages
  tool_call_id?: string // For tool responses
}

export type AIContentPart =
  | {
      type: 'text'
      text: string
    }
  | {
      type: 'image'
      image: string | { url: string } | { data: string; mimeType: string }
    }

export interface AITool {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
}

export interface AIToolCall {
  id: string
  name: string
  arguments: Record<string, any>
}

export interface AIStreamChunk {
  type: 'content' | 'tool_call' | 'done' | 'error'
  delta?: string
  toolCall?: AIToolCall
  error?: string
  usage?: AIUsage
}

export interface AIUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost: number // Cost in USD
}

export interface AICompletionOptions {
  model: string
  messages: AIMessage[]
  temperature?: number
  maxTokens?: number
  topP?: number
  stream?: boolean
  tools?: AITool[]
  toolChoice?: 'auto' | 'required' | { name: string }
  stopSequences?: string[]
  userId?: string // For tracking
}

export interface AICompletionResult {
  content: string
  toolCalls?: AIToolCall[]
  usage: AIUsage
  model: string
  provider: AIProvider
  finishReason: 'stop' | 'length' | 'tool_calls' | 'error'
  error?: string
}

export interface AIStreamHandler {
  onChunk?: (chunk: AIStreamChunk) => void
  onComplete?: (result: AICompletionResult) => void
  onError?: (error: Error) => void
}

export interface AIProviderConfig {
  apiKey: string
  baseURL?: string
  organization?: string
  defaultModel?: string
  timeout?: number
  maxRetries?: number
}

export interface AIProviderInterface {
  readonly provider: AIProvider
  readonly models: AIModel[]

  complete(options: AICompletionOptions): Promise<AICompletionResult>
  stream(
    options: AICompletionOptions,
    handler: AIStreamHandler
  ): Promise<void>

  calculateCost(usage: {
    promptTokens: number
    completionTokens: number
    model: string
  }): number

  validateConfig(): Promise<boolean>
}

export interface AIUsageRecord {
  id: string
  userId: string
  provider: AIProvider
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost: number
  purpose?: string
  metadata?: Record<string, any>
  createdAt: Date
}

export interface AIProviderStatus {
  provider: AIProvider
  available: boolean
  lastChecked: Date
  error?: string
  latency?: number // ms
}

export interface AIFailoverConfig {
  providers: AIProvider[]
  maxRetries: number
  retryDelay: number
  fallbackModels: Record<AIProvider, string>
}

// Model definitions for each provider
export const AI_MODELS: Record<AIProvider, AIModel[]> = {
  anthropic: [
    {
      id: 'claude-sonnet-4-20250514',
      name: 'Claude Sonnet 4',
      provider: 'anthropic',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      inputCostPer1M: 3.0,
      outputCostPer1M: 15.0,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
    },
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      inputCostPer1M: 3.0,
      outputCostPer1M: 15.0,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      provider: 'anthropic',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      inputCostPer1M: 0.8,
      outputCostPer1M: 4.0,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: false,
    },
  ],
  openai: [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      inputCostPer1M: 2.5,
      outputCostPer1M: 10.0,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      inputCostPer1M: 0.15,
      outputCostPer1M: 0.6,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      inputCostPer1M: 10.0,
      outputCostPer1M: 30.0,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
    },
  ],
  google: [
    {
      id: 'gemini-2.0-flash-exp',
      name: 'Gemini 2.0 Flash',
      provider: 'google',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      inputCostPer1M: 0.0,
      outputCostPer1M: 0.0,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      provider: 'google',
      contextWindow: 2000000,
      maxOutputTokens: 8192,
      inputCostPer1M: 1.25,
      outputCostPer1M: 5.0,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      provider: 'google',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      inputCostPer1M: 0.075,
      outputCostPer1M: 0.3,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
    },
  ],
  openrouter: [
    {
      id: 'anthropic/claude-sonnet-4',
      name: 'Claude Sonnet 4 (OpenRouter)',
      provider: 'openrouter',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      inputCostPer1M: 3.0,
      outputCostPer1M: 15.0,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
    },
    {
      id: 'openai/gpt-4o',
      name: 'GPT-4o (OpenRouter)',
      provider: 'openrouter',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      inputCostPer1M: 2.5,
      outputCostPer1M: 10.0,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
    },
    {
      id: 'google/gemini-pro-1.5',
      name: 'Gemini Pro 1.5 (OpenRouter)',
      provider: 'openrouter',
      contextWindow: 2000000,
      maxOutputTokens: 8192,
      inputCostPer1M: 1.25,
      outputCostPer1M: 5.0,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
    },
    {
      id: 'meta-llama/llama-3.3-70b-instruct',
      name: 'Llama 3.3 70B (OpenRouter)',
      provider: 'openrouter',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      inputCostPer1M: 0.35,
      outputCostPer1M: 0.4,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: false,
    },
    {
      id: 'mistralai/mistral-large',
      name: 'Mistral Large (OpenRouter)',
      provider: 'openrouter',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      inputCostPer1M: 2.0,
      outputCostPer1M: 6.0,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: false,
    },
  ],
}

// Helper to get model by ID
export function getModelById(modelId: string): AIModel | undefined {
  for (const provider of Object.values(AI_MODELS)) {
    const model = provider.find((m) => m.id === modelId)
    if (model) return model
  }
  return undefined
}

// Helper to get all models for a provider
export function getModelsByProvider(provider: AIProvider): AIModel[] {
  return AI_MODELS[provider] || []
}
