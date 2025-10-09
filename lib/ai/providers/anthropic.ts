import Anthropic from '@anthropic-ai/sdk'
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
  AIStreamChunk,
} from '@/types/ai'
import { AI_MODELS } from '@/types/ai'

export class AnthropicProvider implements AIProviderInterface {
  readonly provider: AIProvider = 'anthropic'
  readonly models: AIModel[] = AI_MODELS.anthropic

  private client: Anthropic

  constructor(config: AIProviderConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      maxRetries: config.maxRetries ?? 2,
      timeout: config.timeout ?? 60000,
    })
  }

  /**
   * Complete a chat completion request
   */
  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    try {
      const { systemMessage, messages } = this.formatMessages(options.messages)

      const params: Anthropic.MessageCreateParamsNonStreaming = {
        model: options.model,
        max_tokens: options.maxTokens ?? 4096,
        messages: messages as Anthropic.MessageParam[],
        temperature: options.temperature,
        top_p: options.topP,
        stop_sequences: options.stopSequences,
      }

      if (systemMessage) {
        params.system = systemMessage
      }

      if (options.tools && options.tools.length > 0) {
        params.tools = this.formatTools(options.tools)
        if (options.toolChoice) {
          params.tool_choice =
            options.toolChoice === 'auto'
              ? { type: 'auto' }
              : options.toolChoice === 'required'
              ? { type: 'any' }
              : { type: 'tool', name: options.toolChoice.name }
        }
      }

      const response = await this.client.messages.create(params)

      return this.formatResponse(response, options.model)
    } catch (error) {
      console.error('Anthropic completion error:', error)
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
      const { systemMessage, messages } = this.formatMessages(options.messages)

      const params: Anthropic.MessageCreateParamsStreaming = {
        model: options.model,
        max_tokens: options.maxTokens ?? 4096,
        messages: messages as Anthropic.MessageParam[],
        temperature: options.temperature,
        top_p: options.topP,
        stop_sequences: options.stopSequences,
        stream: true,
      }

      if (systemMessage) {
        params.system = systemMessage
      }

      if (options.tools && options.tools.length > 0) {
        params.tools = this.formatTools(options.tools)
        if (options.toolChoice) {
          params.tool_choice =
            options.toolChoice === 'auto'
              ? { type: 'auto' }
              : options.toolChoice === 'required'
              ? { type: 'any' }
              : { type: 'tool', name: options.toolChoice.name }
        }
      }

      const stream = await this.client.messages.create(params)

      let fullContent = ''
      let toolCalls: AIToolCall[] = []
      let currentToolCall: Partial<AIToolCall> | null = null
      let usage: Anthropic.Message['usage'] | Anthropic.MessageDeltaUsage | undefined

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            currentToolCall = {
              id: event.content_block.id,
              name: event.content_block.name,
              arguments: {},
            }
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            fullContent += event.delta.text
            handler.onChunk?.({
              type: 'content',
              delta: event.delta.text,
            })
          } else if (event.delta.type === 'input_json_delta' && currentToolCall) {
            // Accumulate tool call arguments
            try {
              const partialJson = event.delta.partial_json
              currentToolCall.arguments = {
                ...currentToolCall.arguments,
                ...JSON.parse(partialJson),
              }
            } catch {
              // Ignore partial JSON parse errors
            }
          }
        } else if (event.type === 'content_block_stop' && currentToolCall) {
          if (currentToolCall.id && currentToolCall.name) {
            const toolCall: AIToolCall = {
              id: currentToolCall.id,
              name: currentToolCall.name,
              arguments: currentToolCall.arguments || {},
            }
            toolCalls.push(toolCall)
            handler.onChunk?.({
              type: 'tool_call',
              toolCall,
            })
          }
          currentToolCall = null
        } else if (event.type === 'message_delta') {
          usage = event.usage
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
      console.error('Anthropic streaming error:', error)
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
      await this.client.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }],
      })
      return true
    } catch (error) {
      console.error('Anthropic config validation failed:', error)
      return false
    }
  }

  /**
   * Format messages for Anthropic API
   */
  private formatMessages(messages: AIMessage[]): {
    systemMessage?: string
    messages: Array<{ role: 'user' | 'assistant'; content: string | any[] }>
  } {
    let systemMessage: string | undefined
    const formattedMessages: Array<{ role: 'user' | 'assistant'; content: string | any[] }> = []

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemMessage = typeof msg.content === 'string' ? msg.content : ''
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        if (typeof msg.content === 'string') {
          formattedMessages.push({
            role: msg.role,
            content: msg.content,
          })
        } else {
          // Handle multi-part content
          const content = msg.content.map((part) => {
            if (part.type === 'text') {
              return { type: 'text', text: part.text }
            } else if (part.type === 'image') {
              if (typeof part.image === 'string') {
                return { type: 'image', source: { type: 'url', url: part.image } }
              } else if ('url' in part.image) {
                return { type: 'image', source: { type: 'url', url: part.image.url } }
              } else {
                return {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: part.image.mimeType,
                    data: part.image.data,
                  },
                }
              }
            }
            return { type: 'text', text: '' }
          })
          formattedMessages.push({
            role: msg.role,
            content,
          })
        }
      } else if (msg.role === 'tool') {
        // Tool response
        formattedMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.tool_call_id || '',
              content: msg.content as string,
            },
          ],
        })
      }
    }

    return { systemMessage, messages: formattedMessages }
  }

  /**
   * Format tools for Anthropic API
   */
  private formatTools(tools: AITool[]): Anthropic.Tool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }))
  }

  /**
   * Format response from Anthropic API
   */
  private formatResponse(
    response: Anthropic.Message,
    model: string
  ): AICompletionResult {
    let content = ''
    const toolCalls: AIToolCall[] = []

    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, any>,
        })
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: this.formatUsage(response.usage, model),
      model,
      provider: this.provider,
      finishReason: response.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
    }
  }

  /**
   * Format usage information
   */
  private formatUsage(
    usage: Anthropic.Message['usage'] | Anthropic.MessageDeltaUsage | undefined,
    model: string
  ): AIUsage {
    const promptTokens = (usage && 'input_tokens' in usage) ? usage.input_tokens : 0
    const completionTokens = usage?.output_tokens ?? 0
    const totalTokens = promptTokens + completionTokens

    return {
      promptTokens,
      completionTokens,
      totalTokens,
      cost: this.calculateCost({ promptTokens, completionTokens, model }),
    }
  }
}
