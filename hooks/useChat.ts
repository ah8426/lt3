import { useState, useCallback, useRef } from 'react'
import type { AIProvider, AIMessage as AIMessageType, AIStreamChunk } from '@/types/ai'
import type { ChatMessage } from '@/components/chat/MessageBubble'

export interface UseChatOptions {
  provider?: AIProvider
  model: string
  temperature?: number
  maxTokens?: number
  onError?: (error: Error) => void
}

export function useChat(options: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [totalCost, setTotalCost] = useState(0)

  const abortControllerRef = useRef<AbortController | null>(null)

  /**
   * Send a message and stream the response
   */
  const sendMessage = useCallback(
    async (content: string, transcriptContext?: string) => {
      setIsLoading(true)

      // Add user message
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMessage])

      // Prepare AI messages for API
      const apiMessages: AIMessageType[] = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))

      // Add the new user message
      apiMessages.push({
        role: 'user',
        content,
      })

      try {
        // Create abort controller for this request
        abortControllerRef.current = new AbortController()

        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: apiMessages,
            model: options.model,
            provider: options.provider,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            transcriptContext,
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Chat request failed')
        }

        // Set up streaming message
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          model: options.model,
          isAiGenerated: true,
        }

        setStreamingMessage(assistantMessage)

        // Read the stream
        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let buffer = ''
        let fullContent = ''
        let usage: any = null

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

                if (chunk.type === 'content' && chunk.delta) {
                  fullContent += chunk.delta
                  setStreamingMessage((prev) =>
                    prev
                      ? {
                          ...prev,
                          content: fullContent,
                        }
                      : null
                  )
                } else if (chunk.type === 'done' && chunk.usage) {
                  usage = chunk.usage
                } else if (chunk.type === 'error') {
                  throw new Error(chunk.error || 'Streaming error')
                }
              } catch (parseError) {
                console.error('Failed to parse chunk:', parseError)
              }
            }
          }
        }

        // Finalize the message
        const finalMessage: ChatMessage = {
          ...assistantMessage,
          content: fullContent,
          cost: usage?.cost,
          tokens: usage
            ? {
                prompt: usage.promptTokens,
                completion: usage.completionTokens,
                total: usage.totalTokens,
              }
            : undefined,
        }

        setMessages((prev) => [...prev, finalMessage])
        setStreamingMessage(null)

        // Update total cost
        if (usage?.cost) {
          setTotalCost((prev) => prev + usage.cost)
        }
      } catch (error) {
        console.error('Chat error:', error)

        if (error instanceof Error && error.name !== 'AbortError') {
          // Add error message
          const errorMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `Error: ${error.message}`,
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, errorMessage])
          setStreamingMessage(null)

          options.onError?.(error)
        }
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    },
    [messages, options]
  )

  /**
   * Clear all messages
   */
  const clearChat = useCallback(() => {
    setMessages([])
    setStreamingMessage(null)
    setTotalCost(0)
  }, [])

  /**
   * Stop current streaming
   */
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsLoading(false)
      setStreamingMessage(null)
    }
  }, [])

  /**
   * Retry last message
   */
  const retryLastMessage = useCallback(() => {
    if (messages.length === 0) return

    // Find last user message
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUserMessage) return

    // Remove messages after last user message
    const lastUserIndex = messages.findIndex((m) => m.id === lastUserMessage.id)
    setMessages(messages.slice(0, lastUserIndex + 1))

    // Resend
    sendMessage(lastUserMessage.content)
  }, [messages, sendMessage])

  return {
    messages,
    streamingMessage,
    sendMessage,
    clearChat,
    stopStreaming,
    retryLastMessage,
    isLoading,
    totalCost,
  }
}
