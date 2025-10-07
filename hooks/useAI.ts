import { useState, useCallback } from 'react'
import type {
  AIMessage,
  AICompletionResult,
  AIStreamChunk,
  AIProvider,
  AITool,
} from '@/types/ai'

export interface UseAIOptions {
  model: string
  provider?: AIProvider
  temperature?: number
  maxTokens?: number
  tools?: AITool[]
  onChunk?: (chunk: AIStreamChunk) => void
  onComplete?: (result: AICompletionResult) => void
  onError?: (error: Error) => void
}

export function useAI() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  /**
   * Complete a chat request (non-streaming)
   */
  const complete = useCallback(
    async (messages: AIMessage[], options: UseAIOptions): Promise<AICompletionResult> => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/ai/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages,
            model: options.model,
            provider: options.provider,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            tools: options.tools,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'AI request failed')
        }

        const result: AICompletionResult = await response.json()

        if (result.finishReason === 'error' && result.error) {
          throw new Error(result.error)
        }

        options.onComplete?.(result)
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error')
        setError(error)
        options.onError?.(error)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  /**
   * Stream a chat request
   */
  const stream = useCallback(
    async (messages: AIMessage[], options: UseAIOptions): Promise<void> => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/ai/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages,
            model: options.model,
            provider: options.provider,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            tools: options.tools,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'AI streaming failed')
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Process complete lines
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              try {
                const chunk: AIStreamChunk = JSON.parse(data)

                options.onChunk?.(chunk)

                if (chunk.type === 'error') {
                  throw new Error(chunk.error || 'Streaming error')
                }
              } catch (parseError) {
                console.error('Failed to parse chunk:', parseError)
              }
            }
          }
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error')
        setError(error)
        options.onError?.(error)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  /**
   * Simple text completion helper
   */
  const chat = useCallback(
    async (
      prompt: string,
      options: Omit<UseAIOptions, 'onChunk' | 'onComplete'>
    ): Promise<string> => {
      const result = await complete(
        [{ role: 'user', content: prompt }],
        options as UseAIOptions
      )
      return result.content
    },
    [complete]
  )

  return {
    complete,
    stream,
    chat,
    isLoading,
    error,
  }
}

/**
 * Hook for AI usage statistics
 */
export function useAIUsage(options?: {
  provider?: string
  startDate?: string
  endDate?: string
  limit?: number
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [data, setData] = useState<any>(null)

  const fetchUsage = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (options?.provider) params.append('provider', options.provider)
      if (options?.startDate) params.append('startDate', options.startDate)
      if (options?.endDate) params.append('endDate', options.endDate)
      if (options?.limit) params.append('limit', options.limit.toString())

      const response = await fetch(`/api/ai/usage?${params}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch usage')
      }

      const result = await response.json()
      setData(result)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [options?.provider, options?.startDate, options?.endDate, options?.limit])

  return {
    data,
    isLoading,
    error,
    fetchUsage,
  }
}
