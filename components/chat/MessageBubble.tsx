'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, Check, Download, Sparkles } from 'lucide-react'
import { format } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  cost?: number
  tokens?: {
    prompt: number
    completion: number
    total: number
  }
  model?: string
  isAiGenerated?: boolean
}

interface MessageBubbleProps {
  message: ChatMessage
  isStreaming?: boolean
  onInsertToTranscript?: (text: string) => void
}

export function MessageBubble({
  message,
  isStreaming = false,
  onInsertToTranscript,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleInsert = () => {
    if (onInsertToTranscript) {
      onInsertToTranscript(message.content)
    }
  }

  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <div className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}>
      <div
        className={`max-w-[85%] ${
          isUser
            ? 'bg-[#00BFA5] text-white'
            : 'bg-muted'
        } rounded-lg p-3 space-y-2`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">
              {isUser ? 'You' : 'AI Assistant'}
            </span>
            {message.model && !isUser && (
              <Badge variant="outline" className="text-xs">
                {message.model.split('/').pop()}
              </Badge>
            )}
            {message.isAiGenerated && (
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                AI
              </Badge>
            )}
          </div>
          <span className="text-xs opacity-70">
            {format(message.timestamp, 'HH:mm')}
          </span>
        </div>

        {/* Content */}
        <div className={`prose prose-sm max-w-none ${isUser ? 'prose-invert' : 'dark:prose-invert'}`}>
          <ReactMarkdown
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '')
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                )
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Footer with actions */}
        {!isUser && (
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="flex items-center gap-2">
              {message.cost !== undefined && (
                <span className="text-xs opacity-70">
                  ${message.cost.toFixed(6)}
                </span>
              )}
              {message.tokens && (
                <span className="text-xs opacity-70">
                  {message.tokens.total} tokens
                </span>
              )}
              {isStreaming && (
                <span className="text-xs opacity-70 animate-pulse">
                  Streaming...
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCopy}
                title="Copy message"
              >
                {copied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>

              {onInsertToTranscript && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleInsert}
                  title="Insert to transcript"
                >
                  <Download className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
