'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@/hooks/useChat'
import { MessageBubble } from './MessageBubble'
import { ContextSelector } from './ContextSelector'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  MessageSquare,
  Send,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Settings,
  Sparkles,
} from 'lucide-react'
import { AI_MODELS, type AIProvider } from '@/types/ai'

interface ChatPanelProps {
  transcript?: string
  segments?: Array<{ id: string; text: string; start_time: number }>
  onInsertToTranscript?: (text: string) => void
}

export function ChatPanel({
  transcript = '',
  segments = [],
  onInsertToTranscript,
}: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)
  const [message, setMessage] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('anthropic')
  const [selectedModel, setSelectedModel] = useState('claude-3-5-sonnet-20241022')
  const [includeContext, setIncludeContext] = useState(false)
  const [selectedSegments, setSelectedSegments] = useState<string[]>([])

  const scrollRef = useRef<HTMLDivElement>(null)

  const {
    messages,
    sendMessage,
    clearChat,
    isLoading,
    totalCost,
    streamingMessage,
  } = useChat({
    provider: selectedProvider,
    model: selectedModel,
  })

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingMessage])

  const handleSend = async () => {
    if (!message.trim() || isLoading) return

    // Build context from transcript if enabled
    let context = ''
    if (includeContext) {
      if (selectedSegments.length > 0) {
        // Use selected segments
        const selected = segments.filter((s) => selectedSegments.includes(s.id))
        context = selected.map((s) => s.text).join('\n\n')
      } else {
        // Use full transcript
        context = transcript
      }
    }

    await sendMessage(message, context)
    setMessage('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const availableModels = AI_MODELS[selectedProvider] || []

  return (
    <>
      {/* Floating action button */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            size="lg"
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-[#00BFA5] hover:bg-[#00BFA5]/90 z-50"
          >
            <MessageSquare className="h-6 w-6" />
          </Button>
        </SheetTrigger>

        <SheetContent
          side="right"
          className="w-full sm:w-[500px] p-0 flex flex-col"
        >
          <SheetHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#00BFA5]" />
                <SheetTitle>AI Assistant</SheetTitle>
              </div>
              <div className="flex items-center gap-2">
                {totalCost > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ${totalCost.toFixed(4)}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearChat}
                  disabled={messages.length === 0}
                  title="Clear chat"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Model selector */}
            <div className="flex gap-2 mt-2">
              <Select value={selectedProvider} onValueChange={(v) => setSelectedProvider(v as AIProvider)}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Context selector */}
            {(transcript || segments.length > 0) && (
              <ContextSelector
                transcript={transcript}
                segments={segments}
                includeContext={includeContext}
                onIncludeContextChange={setIncludeContext}
                selectedSegments={selectedSegments}
                onSelectedSegmentsChange={setSelectedSegments}
              />
            )}
          </SheetHeader>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.length === 0 && !streamingMessage && (
                <div className="text-center text-muted-foreground py-12">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">
                    Start a conversation with your AI assistant
                  </p>
                  {transcript && (
                    <p className="text-xs mt-2">
                      Enable context to include your transcript
                    </p>
                  )}
                </div>
              )}

              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onInsertToTranscript={
                    msg.role === 'assistant' ? onInsertToTranscript : undefined
                  }
                />
              ))}

              {streamingMessage && (
                <MessageBubble
                  message={streamingMessage}
                  isStreaming
                  onInsertToTranscript={onInsertToTranscript}
                />
              )}

              {isLoading && !streamingMessage && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything... (Ctrl/Cmd + Enter to send)"
                className="min-h-[80px] resize-none"
                disabled={isLoading}
              />
              <Button
                onClick={handleSend}
                disabled={!message.trim() || isLoading}
                className="self-end bg-[#00BFA5] hover:bg-[#00BFA5]/90"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Press Ctrl/Cmd + Enter to send
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
