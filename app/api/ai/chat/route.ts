import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { AIProviderManager } from '@/lib/ai/provider-manager'
import type { AIProvider, AIMessage, AIStreamChunk } from '@/types/ai'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/ai/chat
 * Stream a chat completion with optional transcript context
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()

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
      provider: preferredProvider,
      temperature,
      maxTokens,
      transcriptContext,
    } = body as {
      messages: AIMessage[]
      model: string
      provider?: AIProvider
      temperature?: number
      maxTokens?: number
      transcriptContext?: string
    }

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

    // Get API keys from environment (in production, get from encrypted storage)
    const apiKeys = await getDecryptedApiKeys(user.id)

    // Initialize provider manager
    const manager = new AIProviderManager({
      providers: createProviderConfigs(apiKeys),
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
              purpose: 'chat',
              metadata: {
                hasTranscriptContext: !!transcriptContext,
                contextLength: transcriptContext?.length || 0,
              } as any,
            },
          })
        } catch (error) {
          console.error('Failed to save usage:', error)
        }
      },
    })

    // Build messages with context if provided
    const finalMessages: AIMessage[] = [...messages]

    // If transcript context is provided, inject it into the conversation
    if (transcriptContext && transcriptContext.trim()) {
      // Find if there's already a system message
      const systemMessageIndex = finalMessages.findIndex((m) => m.role === 'system')

      const contextPrompt = `
You are an AI assistant helping with legal dictation and transcription. You have access to the following transcript context:

---TRANSCRIPT CONTEXT---
${transcriptContext}
---END TRANSCRIPT CONTEXT---

Use this context to provide helpful, accurate, and relevant responses. When referencing the transcript, be specific about what you're referring to.
`

      if (systemMessageIndex >= 0) {
        // Append to existing system message
        const existingContent =
          typeof finalMessages[systemMessageIndex].content === 'string'
            ? finalMessages[systemMessageIndex].content
            : ''
        finalMessages[systemMessageIndex].content = existingContent + '\n\n' + contextPrompt
      } else {
        // Add new system message at the beginning
        finalMessages.unshift({
          role: 'system',
          content: contextPrompt,
        })
      }
    }

    // Create readable stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await manager.stream(
            {
              messages: finalMessages,
              model,
              temperature: temperature ?? 0.7,
              maxTokens: maxTokens ?? 2000,
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
    console.error('Chat API error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Chat request failed',
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
async function getDecryptedApiKeys(userId: string): Promise<Record<string, string>> {
  const keys: Record<string, string> = {}

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
function createProviderConfigs(apiKeys: Record<string, string>) {
  const configs = new Map()

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
