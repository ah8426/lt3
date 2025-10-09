import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AIProviderManager } from '@/lib/ai/provider-manager'
import type {
  AIProvider,
  AICompletionOptions,
  AIStreamChunk,
  AIProviderConfig,
} from '@/types/ai'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/ai/stream
 * Stream a chat completion request through server-side proxy
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await request.json()
    const {
      messages,
      model,
      temperature,
      maxTokens,
      tools,
      toolChoice,
      provider: preferredProvider,
    } = body as Partial<AICompletionOptions> & { provider?: AIProvider }

    // Validate required fields
    if (!messages || !model) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: messages, model' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Get API keys from database
    const apiKeys = await getDecryptedApiKeys(user.id)
    const providerConfigs = createProviderConfigs(apiKeys)

    if (providerConfigs.size === 0) {
      console.warn('AI stream requested with no providers configured', {
        userId: user.id,
      })

      return new Response(
        JSON.stringify({
          error: 'No AI providers are configured for this workspace',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Initialize provider manager
    const manager = new AIProviderManager({
      providers: providerConfigs,
      failover: {
        providers: ['anthropic', 'openai', 'google', 'openrouter'],
        maxRetries: 3,
        retryDelay: 1000,
        fallbackModels: {
          anthropic: 'claude-3-5-haiku-20241022',
          openai: 'gpt-4o-mini',
          google: 'gemini-1.5-flash',
          openrouter: 'openai/gpt-4o-mini',
        },
      },
      onUsageRecord: async (record) => {
        // Save usage to database
        try {
          await prisma.ai_usage.create({
            data: {
              user_id: user.id,
              provider: record.provider,
              model: record.model,
              prompt_tokens: record.promptTokens,
              completion_tokens: record.completionTokens,
              total_tokens: record.totalTokens,
              cost: record.cost,
              purpose: record.purpose,
              metadata: record.metadata as any,
            },
          })
        } catch (error) {
          console.error('Failed to save usage:', error)
        }
      },
    })

    // Create readable stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await manager.stream(
            {
              messages,
              model,
              temperature,
              maxTokens,
              tools,
              toolChoice,
              userId: user.id,
            },
            {
              onChunk: (chunk: AIStreamChunk) => {
                // Send chunk as Server-Sent Event
                const data = `data: ${JSON.stringify(chunk)}\n\n`
                controller.enqueue(encoder.encode(data))
              },
              onComplete: () => {
                controller.close()
              },
              onError: (error: Error) => {
                const errorChunk: AIStreamChunk = {
                  type: 'error',
                  error: error.message,
                }
                const data = `data: ${JSON.stringify(errorChunk)}\n\n`
                controller.enqueue(encoder.encode(data))
                controller.close()
              },
            },
            preferredProvider
          )
        } catch (error) {
          console.error('Streaming error:', error)
          const errorChunk: AIStreamChunk = {
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          }
          const data = `data: ${JSON.stringify(errorChunk)}\n\n`
          controller.enqueue(encoder.encode(data))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('AI streaming setup error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'AI streaming failed',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

/**
 * Get decrypted API keys for user
 */
async function getDecryptedApiKeys(
  userId: string
): Promise<Partial<Record<AIProvider, string>>> {
  const keys: Partial<Record<AIProvider, string>> = {}

  // Get from environment variables for now
  if (process.env.ANTHROPIC_API_KEY) {
    keys.anthropic = process.env.ANTHROPIC_API_KEY
  }
  if (process.env.OPENAI_API_KEY) {
    keys.openai = process.env.OPENAI_API_KEY
  }
  if (process.env.GOOGLE_API_KEY) {
    keys.google = process.env.GOOGLE_API_KEY
  }
  if (process.env.OPENROUTER_API_KEY) {
    keys.openrouter = process.env.OPENROUTER_API_KEY
  }

  // TODO: Get user-specific keys from encrypted_api_keys table
  // const userKeys = await keyManager.getDecryptedKeys(userId)

  return keys
}

/**
 * Create provider configs from API keys
 */
function createProviderConfigs(
  apiKeys: Partial<Record<AIProvider, string>>
) {
  const configs = new Map<AIProvider, AIProviderConfig>()

  if (apiKeys.anthropic) {
    configs.set('anthropic', {
      apiKey: apiKeys.anthropic,
      maxRetries: 2,
      timeout: 60000,
    })
  }

  if (apiKeys.openai) {
    configs.set('openai', {
      apiKey: apiKeys.openai,
      maxRetries: 2,
      timeout: 60000,
    })
  }

  if (apiKeys.google) {
    configs.set('google', {
      apiKey: apiKeys.google,
      maxRetries: 2,
      timeout: 60000,
    })
  }

  if (apiKeys.openrouter) {
    configs.set('openrouter', {
      apiKey: apiKeys.openrouter,
      baseURL: 'https://openrouter.ai/api/v1',
      maxRetries: 2,
      timeout: 60000,
    })
  }

  return configs
}
