# AI Chat Interface

A comprehensive AI chat system integrated with the dictation interface, featuring streaming responses, transcript context awareness, and the ability to insert AI-generated content directly into transcripts.

## Features

- **Real-time Streaming**: Server-Sent Events for streaming AI responses
- **Multi-Provider Support**: Choose from Anthropic, OpenAI, Google, or OpenRouter
- **Model Selection**: Switch between different models per provider
- **Transcript Context**: Optionally include transcript in prompts
- **Flexible Context Selection**:
  - Full transcript
  - Last N segments
  - Custom segment selection
- **Insert to Transcript**: AI responses can be inserted into dictation
- **Markdown Rendering**: Full markdown support with code highlighting
- **Cost Tracking**: Real-time cost display per message and session
- **Message History**: Persistent chat within session
- **Copy Messages**: One-click copy of any message

## Components

### ChatPanel

Main chat interface component with collapsible side panel.

```typescript
import { ChatPanel } from '@/components/chat/ChatPanel'

<ChatPanel
  transcript="Full transcript text..."
  segments={[
    { id: '1', text: 'Segment 1', start_time: 0 },
    { id: '2', text: 'Segment 2', start_time: 5000 },
  ]}
  onInsertToTranscript={(text) => {
    // Insert AI-generated text into transcript
    console.log('Inserting:', text)
  }}
/>
```

**Props**:
- `transcript?: string` - Full transcript text for context
- `segments?: Array<{ id, text, start_time }>` - Individual segments
- `onInsertToTranscript?: (text: string) => void` - Callback when inserting AI content

### MessageBubble

Individual message display with markdown and actions.

```typescript
import { MessageBubble } from '@/components/chat/MessageBubble'

<MessageBubble
  message={{
    id: '1',
    role: 'assistant',
    content: 'This is a **markdown** message',
    timestamp: new Date(),
    cost: 0.0001,
    tokens: { prompt: 10, completion: 20, total: 30 },
    model: 'claude-3-5-sonnet',
    isAiGenerated: true,
  }}
  isStreaming={false}
  onInsertToTranscript={(text) => console.log('Insert:', text)}
/>
```

**Message Types**:
- `user` - User messages (right-aligned, colored)
- `assistant` - AI responses (left-aligned, with metadata)
- `system` - System messages (centered, minimal)

### ContextSelector

Context selection UI for including transcript in prompts.

```typescript
import { ContextSelector } from '@/components/chat/ContextSelector'

<ContextSelector
  transcript={fullTranscript}
  segments={segments}
  includeContext={includeContext}
  onIncludeContextChange={setIncludeContext}
  selectedSegments={selectedSegments}
  onSelectedSegmentsChange={setSelectedSegments}
/>
```

**Context Modes**:
1. **Full Transcript**: Include entire transcript
2. **Last N**: Include last 3, 5, 10, or 20 segments
3. **Custom**: Manually select specific segments

## Hooks

### useChat

Main hook for chat functionality.

```typescript
import { useChat } from '@/hooks/useChat'

const {
  messages,
  streamingMessage,
  sendMessage,
  clearChat,
  stopStreaming,
  retryLastMessage,
  isLoading,
  totalCost,
} = useChat({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.7,
  maxTokens: 2000,
  onError: (error) => console.error(error),
})

// Send a message
await sendMessage('Summarize this transcript', transcriptContext)

// Clear chat history
clearChat()

// Stop current streaming
stopStreaming()

// Retry last message
retryLastMessage()
```

**Returns**:
- `messages: ChatMessage[]` - All chat messages
- `streamingMessage: ChatMessage | null` - Currently streaming message
- `sendMessage: (content: string, context?: string) => Promise<void>`
- `clearChat: () => void` - Clear all messages
- `stopStreaming: () => void` - Abort current request
- `retryLastMessage: () => void` - Retry last user message
- `isLoading: boolean` - Loading state
- `totalCost: number` - Total cost of all messages

## API Routes

### POST /api/ai/chat

Streaming chat endpoint with transcript context support.

**Request**:
```json
{
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "model": "claude-3-5-sonnet-20241022",
  "provider": "anthropic",
  "temperature": 0.7,
  "maxTokens": 2000,
  "transcriptContext": "Optional transcript text..."
}
```

**Response**: Server-Sent Events stream
```
data: {"type":"content","delta":"Hello"}
data: {"type":"content","delta":"!"}
data: {"type":"done","usage":{"promptTokens":10,"completionTokens":2,"totalTokens":12,"cost":0.000036}}
```

## Integration Example

### Basic Integration

```typescript
import { ChatPanel } from '@/components/chat/ChatPanel'

function DictationPage() {
  const [transcript, setTranscript] = useState('')
  const [segments, setSegments] = useState([])

  return (
    <div>
      {/* Your dictation interface */}
      <TranscriptView segments={segments} />

      {/* Chat panel (floating) */}
      <ChatPanel
        transcript={transcript}
        segments={segments}
        onInsertToTranscript={(text) => {
          // Append to transcript
          setTranscript(prev => prev + '\n\n' + text)
        }}
      />
    </div>
  )
}
```

### Advanced Integration with Insert at Cursor

```typescript
import { DictationWithChat } from '@/components/dictation/DictationWithChat'

function AdvancedDictationPage() {
  const [segments, setSegments] = useState([])

  return (
    <DictationWithChat
      segments={segments}
      onSegmentsChange={setSegments}
      isRecording={isRecording}
    />
  )
}
```

This provides:
- Insert at cursor position
- AI-generated content badges
- Segment-level tracking
- Visual differentiation of AI content

## Usage Patterns

### 1. Summarization

```typescript
// User prompt
"Summarize the key points from this transcript"

// With context enabled, AI receives:
// - User message
// - Full transcript as context
// - Returns: Concise summary
```

### 2. Drafting

```typescript
// User prompt
"Draft a legal memo based on this dictation"

// AI generates formatted memo
// User clicks "Insert to Transcript"
// AI-generated content appears with badge
```

### 3. Corrections

```typescript
// User prompt
"Fix grammar and punctuation in the last segment"

// With "Last 1" context mode
// AI corrects and returns improved text
// User replaces original segment
```

### 4. Expansion

```typescript
// User prompt
"Expand on the discussion about contract terms"

// AI provides detailed expansion
// User inserts at specific cursor position
```

## Styling

### Message Bubbles

- **User messages**: Right-aligned, teal background (`#00BFA5`)
- **AI messages**: Left-aligned, muted background
- **AI-generated badges**: Purple accent with sparkle icon

### Chat Panel

- **Position**: Fixed bottom-right corner
- **Size**: Full-height side sheet (500px wide on desktop)
- **Trigger**: Floating action button with message icon
- **Colors**: Matches app theme with teal accents

## Markdown Support

Full markdown rendering including:

- **Headers**: `# H1`, `## H2`, etc.
- **Bold/Italic**: `**bold**`, `*italic*`
- **Lists**: Ordered and unordered
- **Code blocks**: With syntax highlighting
- **Inline code**: \`code\`
- **Links**: `[text](url)`
- **Quotes**: `> quote`

Code blocks support syntax highlighting for:
- JavaScript/TypeScript
- Python
- SQL
- JSON
- And 100+ other languages

## Cost Tracking

Costs are tracked per message and accumulated:

```typescript
// Individual message cost
message.cost // 0.000123 USD

// Total session cost
totalCost // 0.001234 USD

// Displayed in UI
"$0.001234" // Top of chat panel
```

Costs are also saved to database:
```sql
INSERT INTO ai_usage (
  user_id,
  provider,
  model,
  prompt_tokens,
  completion_tokens,
  total_tokens,
  cost,
  purpose,
  metadata
) VALUES (...)
```

## Keyboard Shortcuts

- **Ctrl/Cmd + Enter**: Send message
- **Esc**: Close chat panel
- **Arrow keys**: Navigate messages (future)

## Accessibility

- Semantic HTML structure
- ARIA labels on buttons
- Keyboard navigation
- Screen reader support
- Focus management
- High contrast mode support

## Performance

- **Streaming**: Immediate response starts
- **Incremental rendering**: Smooth text appearance
- **Debounced updates**: Efficient re-renders
- **Lazy loading**: Messages loaded on demand
- **Auto-scroll**: Smart scroll behavior

## Error Handling

```typescript
// Network errors
"Failed to connect to AI service"

// API errors
"AI provider returned an error: [message]"

// Timeout errors
"Request timed out after 60s"

// Streaming errors
"Stream interrupted: [reason]"
```

All errors are:
- Displayed as system messages
- Logged to console
- Reported to error tracking
- Allow retry via `retryLastMessage()`

## Security

- All API calls server-side
- User authentication required
- API keys never exposed to client
- Rate limiting (optional)
- Content sanitization
- XSS protection via markdown library

## Best Practices

1. **Keep context focused**: Use "Last N" or "Custom" for specific questions
2. **Monitor costs**: Check total cost regularly
3. **Clear chat**: Start fresh for new topics
4. **Use markdown**: AI responses look better formatted
5. **Insert selectively**: Not all AI content needs insertion
6. **Review before insert**: Check AI-generated content first
7. **Track provenance**: Keep AI-generated badges visible

## Future Enhancements

- [ ] Message search
- [ ] Export chat history
- [ ] Custom system prompts
- [ ] Multi-turn context management
- [ ] Voice input for chat
- [ ] Image support in chat
- [ ] Tool use (function calling)
- [ ] Chat templates
- [ ] Conversation branching
- [ ] Collaborative chat

## Troubleshooting

### Chat not streaming

- Check network connection
- Verify API keys are set
- Check browser console for errors
- Try different model/provider

### Context not including transcript

- Verify "Include context" is checked
- Check context mode selection
- Ensure segments array is populated
- Verify transcript prop is passed

### Insert not working

- Verify `onInsertToTranscript` callback is provided
- Check cursor position tracking
- Ensure segments are mutable
- Check for TypeScript errors

### High costs

- Use cheaper models (Haiku, Mini, Flash)
- Reduce context size
- Lower `maxTokens`
- Clear chat history frequently

## License

MIT
