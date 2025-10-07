import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
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

export class GoogleProvider implements AIProviderInterface {
  readonly provider: AIProvider = 'google'
  readonly models: AIModel[] = AI_MODELS.google

  private client: GoogleGenerativeAI

  constructor(config: AIProviderConfig) {
    this.client = new GoogleGenerativeAI(config.apiKey)
  }

  /**
   * Complete a chat completion request
   */
  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    try {
      const model = this.client.getGenerativeModel({
        model: options.model,
        generationConfig: {
          temperature: options.temperature,
          maxOutputTokens: options.maxTokens,
          topP: options.topP,
          stopSequences: options.stopSequences,
        },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
        ],
        tools: options.tools ? this.formatTools(options.tools) : undefined,
      })

      const { systemInstruction, contents } = this.formatMessages(options.messages)

      const chat = model.startChat({
        history: contents.slice(0, -1),
        systemInstruction,
      })

      const lastMessage = contents[contents.length - 1]
      const result = await chat.sendMessage(lastMessage.parts)

      return this.formatResponse(result.response, options.model)
    } catch (error) {
      console.error('Google completion error:', error)
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
      const model = this.client.getGenerativeModel({
        model: options.model,
        generationConfig: {
          temperature: options.temperature,
          maxOutputTokens: options.maxTokens,
          topP: options.topP,
          stopSequences: options.stopSequences,
        },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
        ],
        tools: options.tools ? this.formatTools(options.tools) : undefined,
      })

      const { systemInstruction, contents } = this.formatMessages(options.messages)

      const chat = model.startChat({
        history: contents.slice(0, -1),
        systemInstruction,
      })

      const lastMessage = contents[contents.length - 1]
      const result = await chat.sendMessageStream(lastMessage.parts)

      let fullContent = ''
      const toolCalls: AIToolCall[] = []
      let usage: { promptTokens: number; completionTokens: number } = {
        promptTokens: 0,
        completionTokens: 0,
      }

      for await (const chunk of result.stream) {
        // Handle text content
        const text = chunk.text()
        if (text) {
          fullContent += text
          handler.onChunk?.({
            type: 'content',
            delta: text,
          })
        }

        // Handle function calls (tool calls)
        const functionCalls = chunk.functionCalls()
        if (functionCalls) {
          for (const call of functionCalls) {
            const toolCall: AIToolCall = {
              id: crypto.randomUUID(),
              name: call.name,
              arguments: call.args,
            }
            toolCalls.push(toolCall)
            handler.onChunk?.({
              type: 'tool_call',
              toolCall,
            })
          }
        }
      }

      // Get final response for usage
      const response = await result.response
      if (response.usageMetadata) {
        usage = {
          promptTokens: response.usageMetadata.promptTokenCount || 0,
          completionTokens: response.usageMetadata.candidatesTokenCount || 0,
        }
      }

      const finalUsage = this.formatUsage(usage, options.model)
      const finalResult: AICompletionResult = {
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

      handler.onComplete?.(finalResult)
    } catch (error) {
      console.error('Google streaming error:', error)
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
      const model = this.client.getGenerativeModel({ model: 'gemini-1.5-flash' })
      await model.generateContent('test')
      return true
    } catch (error) {
      console.error('Google config validation failed:', error)
      return false
    }
  }

  /**
   * Format messages for Google Gemini API
   */
  private formatMessages(messages: AIMessage[]): {
    systemInstruction?: string
    contents: Array<{ role: string; parts: any[] }>
  } {
    let systemInstruction: string | undefined
    const contents: Array<{ role: string; parts: any[] }> = []

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = typeof msg.content === 'string' ? msg.content : ''
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        const role = msg.role === 'user' ? 'user' : 'model'
        const parts: any[] = []

        if (typeof msg.content === 'string') {
          parts.push({ text: msg.content })
        } else {
          for (const part of msg.content) {
            if (part.type === 'text') {
              parts.push({ text: part.text })
            } else if (part.type === 'image') {
              if (typeof part.image === 'string') {
                parts.push({
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: part.image,
                  },
                })
              } else if ('url' in part.image) {
                // Google doesn't support URLs directly, would need to fetch
                parts.push({ text: `[Image: ${part.image.url}]` })
              } else {
                parts.push({
                  inlineData: {
                    mimeType: part.image.mimeType,
                    data: part.image.data,
                  },
                })
              }
            }
          }
        }

        contents.push({ role, parts })
      } else if (msg.role === 'tool') {
        // Tool response
        contents.push({
          role: 'function',
          parts: [
            {
              functionResponse: {
                name: msg.name || 'unknown',
                response: {
                  content: msg.content,
                },
              },
            },
          ],
        })
      }
    }

    return { systemInstruction, contents }
  }

  /**
   * Format tools for Google Gemini API
   */
  private formatTools(tools: AITool[]): any[] {
    return [
      {
        functionDeclarations: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        })),
      },
    ]
  }

  /**
   * Format response from Google Gemini API
   */
  private formatResponse(response: any, model: string): AICompletionResult {
    let content = ''
    const toolCalls: AIToolCall[] = []

    // Get text content
    try {
      content = response.text() || ''
    } catch {
      // No text content
    }

    // Get function calls (tool calls)
    const functionCalls = response.functionCalls()
    if (functionCalls) {
      for (const call of functionCalls) {
        toolCalls.push({
          id: crypto.randomUUID(),
          name: call.name,
          arguments: call.args,
        })
      }
    }

    // Get usage
    const usage = {
      promptTokens: response.usageMetadata?.promptTokenCount || 0,
      completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: this.formatUsage(usage, model),
      model,
      provider: this.provider,
      finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
    }
  }

  /**
   * Format usage information
   */
  private formatUsage(
    usage: { promptTokens: number; completionTokens: number },
    model: string
  ): AIUsage {
    const totalTokens = usage.promptTokens + usage.completionTokens

    return {
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens,
      cost: this.calculateCost({
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        model,
      }),
    }
  }
}
