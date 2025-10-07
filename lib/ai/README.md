# Unified AI Client System

A comprehensive, provider-agnostic AI client system with support for multiple providers, streaming, tool use, automatic failover, and cost tracking.

## Features

- **Multiple Providers**: Anthropic (Claude), OpenAI (GPT), Google (Gemini), OpenRouter
- **Streaming Support**: Real-time token streaming for all providers
- **Tool Use**: Function calling/tool use support across providers
- **Automatic Failover**: Seamless fallback between providers on failure
- **Cost Tracking**: Automatic usage and cost tracking per request
- **Server-Side Security**: All API calls proxied through secure server routes
- **Usage Analytics**: Comprehensive statistics and reporting

## Supported Models

### Anthropic
- `claude-sonnet-4-20250514` - Claude Sonnet 4 (200K context)
- `claude-3-5-sonnet-20241022` - Claude 3.5 Sonnet (200K context)
- `claude-3-5-haiku-20241022` - Claude 3.5 Haiku (200K context)

### OpenAI
- `gpt-4o` - GPT-4o (128K context)
- `gpt-4o-mini` - GPT-4o Mini (128K context)
- `gpt-4-turbo` - GPT-4 Turbo (128K context)

### Google
- `gemini-2.0-flash-exp` - Gemini 2.0 Flash (1M context, free)
- `gemini-1.5-pro` - Gemini 1.5 Pro (2M context)
- `gemini-1.5-flash` - Gemini 1.5 Flash (1M context)

### OpenRouter
- `anthropic/claude-sonnet-4` - Claude Sonnet 4 via OpenRouter
- `openai/gpt-4o` - GPT-4o via OpenRouter
- `google/gemini-pro-1.5` - Gemini Pro 1.5 via OpenRouter
- `meta-llama/llama-3.3-70b-instruct` - Llama 3.3 70B
- `mistralai/mistral-large` - Mistral Large

## Usage

### Client-Side (React Hook)

```typescript
import { useAI } from '@/hooks/useAI'

function MyComponent() {
  const { chat, stream, isLoading, error } = useAI()

  // Simple text completion
  const handleChat = async () => {
    const response = await chat('Hello, how are you?', {
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      temperature: 0.7,
      maxTokens: 1000,
    })
    console.log(response)
  }

  // Streaming response
  const handleStream = async () => {
    await stream(
      [{ role: 'user', content: 'Write a story' }],
      {
        model: 'gpt-4o',
        provider: 'openai',
        onChunk: (chunk) => {
          if (chunk.type === 'content') {
            console.log(chunk.delta)
          }
        },
        onComplete: (result) => {
          console.log('Done!', result.usage)
        },
      }
    )
  }

  return (
    <div>
      <button onClick={handleChat} disabled={isLoading}>
        Chat
      </button>
      <button onClick={handleStream} disabled={isLoading}>
        Stream
      </button>
      {error && <div>Error: {error.message}</div>}
    </div>
  )
}
```

### Server-Side (Direct Provider Use)

```typescript
import { AIProviderManager } from '@/lib/ai/provider-manager'

// Initialize manager
const manager = new AIProviderManager({
  providers: new Map([
    ['anthropic', { apiKey: process.env.ANTHROPIC_API_KEY! }],
    ['openai', { apiKey: process.env.OPENAI_API_KEY! }],
  ]),
  failover: {
    providers: ['anthropic', 'openai'],
    maxRetries: 3,
    retryDelay: 1000,
    fallbackModels: {
      anthropic: 'claude-3-5-haiku-20241022',
      openai: 'gpt-4o-mini',
    },
  },
})

// Complete request with automatic failover
const result = await manager.complete({
  model: 'claude-sonnet-4-20250514',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' },
  ],
  temperature: 0.7,
  maxTokens: 1000,
})

console.log(result.content)
console.log('Cost:', result.usage.cost)
```

### Tool Use (Function Calling)

```typescript
const result = await manager.complete({
  model: 'gpt-4o',
  messages: [
    { role: 'user', content: 'What is the weather in San Francisco?' },
  ],
  tools: [
    {
      name: 'get_weather',
      description: 'Get the current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City name',
          },
          unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
          },
        },
        required: ['location'],
      },
    },
  ],
  toolChoice: 'auto',
})

if (result.toolCalls) {
  for (const toolCall of result.toolCalls) {
    console.log('Tool:', toolCall.name)
    console.log('Arguments:', toolCall.arguments)
  }
}
```

### Streaming with Tools

```typescript
await manager.stream(
  {
    model: 'claude-3-5-sonnet-20241022',
    messages: [{ role: 'user', content: 'Analyze this data...' }],
    tools: [
      {
        name: 'analyze_data',
        description: 'Analyze numerical data',
        parameters: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'number' } },
          },
        },
      },
    ],
  },
  {
    onChunk: (chunk) => {
      if (chunk.type === 'content') {
        process.stdout.write(chunk.delta)
      } else if (chunk.type === 'tool_call') {
        console.log('\nTool call:', chunk.toolCall)
      }
    },
    onComplete: (result) => {
      console.log('\n\nUsage:', result.usage)
    },
  }
)
```

## API Routes

### POST /api/ai/complete
Non-streaming completion endpoint.

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "model": "claude-3-5-sonnet-20241022",
  "provider": "anthropic",
  "temperature": 0.7,
  "maxTokens": 1000,
  "tools": []
}
```

**Response:**
```json
{
  "content": "Hello! How can I help you?",
  "usage": {
    "promptTokens": 10,
    "completionTokens": 8,
    "totalTokens": 18,
    "cost": 0.000054
  },
  "model": "claude-3-5-sonnet-20241022",
  "provider": "anthropic",
  "finishReason": "stop"
}
```

### POST /api/ai/stream
Streaming completion endpoint (Server-Sent Events).

**Request:** Same as `/api/ai/complete`

**Response:** Stream of SSE events
```
data: {"type":"content","delta":"Hello"}
data: {"type":"content","delta":"!"}
data: {"type":"done","usage":{"promptTokens":10,"completionTokens":2,"totalTokens":12,"cost":0.000036}}
```

### GET /api/ai/usage
Get usage statistics.

**Query Parameters:**
- `provider` - Filter by provider
- `startDate` - Filter from date (ISO 8601)
- `endDate` - Filter to date (ISO 8601)
- `limit` - Max records to return (default: 100)

**Response:**
```json
{
  "stats": {
    "totalCost": 1.25,
    "totalTokens": 50000,
    "requestCount": 100,
    "byProvider": {
      "anthropic": { "cost": 0.75, "tokens": 30000, "requests": 60 },
      "openai": { "cost": 0.50, "tokens": 20000, "requests": 40 }
    }
  },
  "records": [...]
}
```

## Cost Tracking

All requests automatically track:
- Prompt tokens
- Completion tokens
- Total tokens
- Cost in USD
- Provider and model used
- Timestamp

Access via:
```typescript
const { data, fetchUsage } = useAIUsage({
  startDate: '2025-01-01',
  endDate: '2025-01-31',
})

await fetchUsage()
console.log(data.stats.totalCost) // Total spend
```

## Failover Configuration

Configure automatic failover:

```typescript
const manager = new AIProviderManager({
  providers: new Map([...]),
  failover: {
    providers: ['anthropic', 'openai', 'google', 'openrouter'],
    maxRetries: 3,
    retryDelay: 1000, // ms
    fallbackModels: {
      anthropic: 'claude-3-5-haiku-20241022',
      openai: 'gpt-4o-mini',
      google: 'gemini-1.5-flash',
      openrouter: 'openai/gpt-4o-mini',
    },
  },
})
```

If primary provider fails:
1. Try fallback model on same provider
2. Move to next provider in list
3. Repeat until success or all providers exhausted

## Database Schema

The system tracks usage in the `ai_usage` table:

```sql
CREATE TABLE ai_usage (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  cost DECIMAL(10, 6) NOT NULL,
  purpose TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE
);
```

## Environment Variables

Required API keys in `.env`:

```env
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI
OPENAI_API_KEY=sk-...

# Google
GOOGLE_API_KEY=AIza...

# OpenRouter
OPENROUTER_API_KEY=sk-or-...
```

## Security

- All API keys stored server-side only
- Client requests proxied through `/api/ai/*` routes
- Row-level security on usage data
- API keys can be user-specific (encrypted in database)

## Provider-Specific Features

### Anthropic (Claude)
- Best reasoning and analysis
- 200K context window
- Excellent tool use
- Fast streaming

### OpenAI (GPT)
- General-purpose excellence
- Function calling
- Vision support (GPT-4o)
- Structured outputs

### Google (Gemini)
- Massive 2M context (Pro)
- Free tier available
- Multimodal capabilities
- Fast inference

### OpenRouter
- Access to multiple providers
- Flexible model routing
- Cost optimization
- Meta Llama and Mistral support

## Best Practices

1. **Use streaming for long responses** - Better UX
2. **Set appropriate maxTokens** - Cost control
3. **Use cheaper models for simple tasks** - Haiku, Mini, Flash
4. **Implement caching** - Reduce duplicate requests
5. **Monitor usage** - Track costs and patterns
6. **Handle errors gracefully** - Fallback to simpler models
7. **Use tools wisely** - Only when needed

## License

MIT
