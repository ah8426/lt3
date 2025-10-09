import OpenAI from 'openai'
import type {
  AIProvider,
  AIProviderInterface,
  AICompletionOptions,
  AICompletionResult,
  AIStreamHandler,
  AIProviderConfig,
  AIModel,
  AIMessage,
  AITool,
  AIToolCall,
  AIUsage,
} from '@/types/ai'
import { AI_MODELS } from '@/types/ai'

/**
 * OpenRouter provider using OpenAI SDK with custom baseURL
 * Supports multiple models from different providers
 */
export class OpenRouterProvider implements AIProviderInterface {
  readonly provider: AIProvider = 'openrouter'
  readonly models: AIModel[] = AI_MODELS.openrouter

  private client: OpenAI

  constructor(config: AIProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Law Transcribed',
      },
      maxRetries: config.maxRetries ?? 2,
      timeout: config.timeout ?? 60000,
    })
  }

  /**
   * Complete a chat completion request
   */
  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    try {
      const params: OpenAI.ChatCompletionCreateParamsNonStreaming = {
        model: options.model,
        messages: this.formatMessages(options.messages),
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        stop: options.stopSequences,
      }

      if (options.tools && options.tools.length > 0) {
        params.tools = this.formatTools(options.tools)
        if (options.toolChoice) {
          params.tool_choice =
            options.toolChoice === 'auto'
              ? 'auto'
              : options.toolChoice === 'required'
              ? 'required'
              : { type: 'function', function: { name: options.toolChoice.name } }
        }
      }

      const response = await this.client.chat.completions.create(params)

      return this.formatResponse(response, options.model)
    } catch (error) {
      console.error('OpenRouter completion error:', error)
      return {
        content: '',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 },
        model: options.model,
        provider: this.provider,
        finishReason: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Stream a chat completion request
   */
  async stream(options: AICompletionOptions, handler: AIStreamHandler): Promise<void> {
    try {
      const params: OpenAI.ChatCompletionCreateParamsStreaming = {
        model: options.model,
        messages: this.formatMessages(options.messages),
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        stop: options.stopSequences,
        stream: true,
      }

      if (options.tools && options.tools.length > 0) {
        params.tools = this.formatTools(options.tools)
        if (options.toolChoice) {
          params.tool_choice =
            options.toolChoice === 'auto'
              ? 'auto'
              : options.toolChoice === 'required'
              ? 'required'
              : { type: 'function', function: { name: options.toolChoice.name } }
        }
      }

      const stream = await this.client.chat.completions.create(params)

      let fullContent = ''
      const toolCalls: AIToolCall[] = []
      const toolCallsMap = new Map<number, Partial<AIToolCall>>()
      let usage: OpenAI.CompletionUsage | undefined

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta

        // Handle content
        if (delta?.content) {
          fullContent += delta.content
          handler.onChunk?.({
            type: 'content',
            delta: delta.content,
          })
        }

        // Handle tool calls
        if (delta?.tool_calls) {
          for (const toolCallDelta of delta.tool_calls) {
            const index = toolCallDelta.index
            let toolCall = toolCallsMap.get(index)

            if (!toolCall) {
              toolCall = {
                id: toolCallDelta.id,
                name: toolCallDelta.function?.name,
                arguments: '' as any,
              }
              toolCallsMap.set(index, toolCall)
            }

            if (toolCallDelta.function?.arguments) {
              const existingArgs =
                typeof toolCall.arguments === 'string'
                  ? toolCall.arguments
                  : JSON.stringify(toolCall.arguments || {})
              toolCall.arguments = (existingArgs + toolCallDelta.function.arguments) as any
            }
          }
        }

        // Handle usage (final chunk)
        if (chunk.usage) {
          usage = chunk.usage
        }

        // Check for finish reason
        if (chunk.choices[0]?.finish_reason) {
          // Parse tool call arguments
          for (const toolCall of toolCallsMap.values()) {
            if (toolCall.id && toolCall.name) {
              try {
                const parsedArgs =
                  typeof toolCall.arguments === 'string'
                    ? JSON.parse(toolCall.arguments)
                    : toolCall.arguments

                const finalToolCall: AIToolCall = {
                  id: toolCall.id,
                  name: toolCall.name,
                  arguments: parsedArgs,
                }
                toolCalls.push(finalToolCall)

                handler.onChunk?.({
                  type: 'tool_call',
                  toolCall: finalToolCall,
                })
              } catch (error) {
                console.error('Failed to parse tool call arguments:', error)
              }
            }
          }
        }
      }

      const finalUsage = this.formatUsage(usage, options.model)
      const result: AICompletionResult = {
        content: fullContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: finalUsage,
        model: options.model,
        provider: this.provider,
        finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
      }

      handler.onChunk?.({
        type: 'done',
        usage: finalUsage,
      })

      handler.onComplete?.(result)
    } catch (error) {
      console.error('OpenRouter streaming error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      handler.onChunk?.({
        type: 'error',
        error: errorMessage,
      })
      handler.onError?.(error instanceof Error ? error : new Error(errorMessage))
    }
  }

  /**
   * Calculate cost for usage
   */
  calculateCost(usage: {
    promptTokens: number
    completionTokens: number
    model: string
  }): number {
    const model = this.models.find((m) => m.id === usage.model)
    if (!model) return 0

    const inputCost = (usage.promptTokens / 1_000_000) * model.inputCostPer1M
    const outputCost = (usage.completionTokens / 1_000_000) * model.outputCostPer1M

    return inputCost + outputCost
  }

  /**
   * Validate API configuration
   */
  async validateConfig(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 10,
      })
      return true
    } catch (error) {
      console.error('OpenRouter config validation failed:', error)
      return false
    }
  }

  /**
   * Format messages for OpenRouter API (same as OpenAI)
   */
  private formatMessages(
    messages: AIMessage[]
  ): OpenAI.ChatCompletionMessageParam[] {
    return messages.map((msg) => {
      if (msg.role === 'system') {
        return {
          role: 'system',
          content: typeof msg.content === 'string' ? msg.content : '',
        }
      } else if (msg.role === 'user') {
        if (typeof msg.content === 'string') {
          return {
            role: 'user',
            content: msg.content,
          }
        } else {
          // Handle multi-part content
          const content = msg.content.map((part) => {
            if (part.type === 'text') {
              return { type: 'text' as const, text: part.text }
            } else if (part.type === 'image') {
              if (typeof part.image === 'string') {
                return { type: 'image_url' as const, image_url: { url: part.image } }
              } else if ('url' in part.image) {
                return { type: 'image_url' as const, image_url: { url: part.image.url } }
              } else {
                return {
                  type: 'image_url' as const,
                  image_url: {
                    url: `data:${part.image.mimeType};base64,${part.image.data}`,
                  },
                }
              }
            }
            return { type: 'text' as const, text: '' }
          })
          return {
            role: 'user',
            content,
          }
        }
      } else if (msg.role === 'assistant') {
        return {
          role: 'assistant',
          content: typeof msg.content === 'string' ? msg.content : '',
        }
      } else if (msg.role === 'tool') {
        return {
          role: 'tool',
          content: typeof msg.content === 'string' ? msg.content : '',
          tool_call_id: msg.tool_call_id || '',
        }
      }

      return {
        role: 'user',
        content: '',
      }
    })
  }

  /**
   * Format tools for OpenRouter API (same as OpenAI)
   */
  private formatTools(tools: AITool[]): OpenAI.ChatCompletionTool[] {
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }))
  }

  /**
   * Format response from OpenRouter API
   */
  private formatResponse(
    response: OpenAI.ChatCompletion,
    model: string
  ): AICompletionResult {
    const choice = response.choices[0]
    const message = choice?.message

    let content = message?.content || ''
    const toolCalls: AIToolCall[] = []

    if (message?.tool_calls) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.type === 'function') {
          try {
            toolCalls.push({
              id: toolCall.id,
              name: toolCall.function.name,
              arguments: JSON.parse(toolCall.function.arguments),
            })
          } catch (error) {
            console.error('Failed to parse tool call arguments:', error)
          }
        }
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: this.formatUsage(response.usage, model),
      model,
      provider: this.provider,
      finishReason:
        choice?.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
    }
  }

  /**
   * Format usage information
   */
  private formatUsage(
    usage: OpenAI.CompletionUsage | undefined,
    model: string
  ): AIUsage {
    const promptTokens = usage?.prompt_tokens ?? 0
    const completionTokens = usage?.completion_tokens ?? 0
    const totalTokens = usage?.total_tokens ?? 0

    return {
      promptTokens,
      completionTokens,
      totalTokens,
      cost: this.calculateCost({ promptTokens, completionTokens, model }),
    }
  }
}
