'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Scale, CheckCircle } from 'lucide-react'
import { CitationBadge } from './CitationBadge'
import { CitationPanel } from './CitationPanel'
import { useCitations, useLiveCitationDetection } from '@/hooks/useCitations'
import { cn } from '@/lib/utils'
import type { ExtractedCitation } from '@/lib/services/citation-checker'

export interface TranscriptWithCitationsProps {
  text: string
  onChange?: (text: string) => void
  sessionId?: string
  editable?: boolean
  enableCitationDetection?: boolean
  className?: string
}

export function TranscriptWithCitations({
  text,
  onChange,
  sessionId,
  editable = true,
  enableCitationDetection = true,
  className,
}: TranscriptWithCitationsProps) {
  const [localText, setLocalText] = useState(text)
  const [selectedCitation, setSelectedCitation] = useState<ExtractedCitation | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Live citation detection
  const { citations: detectedCitations } = useLiveCitationDetection(
    enableCitationDetection ? localText : '',
    {
      debounceMs: 1000,
    }
  )

  // Citation management
  const {
    citations,
    verifications,
    isVerifying,
    verificationProgress,
    verifyCitation,
    verifyAllCitations,
    exportCitations,
  } = useCitations({
    text: localText,
    sessionId,
    autoExtract: enableCitationDetection,
  })

  // Handle text changes
  const handleTextChange = useCallback(
    (value: string) => {
      setLocalText(value)
      onChange?.(value)
    },
    [onChange]
  )

  // Verify selected citation
  const handleVerifyCitation = useCallback(
    async (citation: ExtractedCitation) => {
      setSelectedCitation(citation)
      await verifyCitation(citation)
    },
    [verifyCitation]
  )

  // Get citation at cursor position
  const getCitationAtPosition = useCallback(
    (position: number): ExtractedCitation | null => {
      return (
        citations.find(
          (citation) => position >= citation.startIndex && position <= citation.endIndex
        ) || null
      )
    },
    [citations]
  )

  // Handle right-click
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!textareaRef.current) return
      const position = textareaRef.current.selectionStart
      const citation = getCitationAtPosition(position)
      setSelectedCitation(citation)
    },
    [getCitationAtPosition]
  )

  // Render text with citation highlights
  const renderHighlightedText = useMemo(() => {
    if (!enableCitationDetection || citations.length === 0) {
      return null
    }

    const parts: React.ReactNode[] = []
    let lastIndex = 0

    // Sort citations by position
    const sortedCitations = [...citations].sort((a, b) => a.startIndex - b.startIndex)

    sortedCitations.forEach((citation, index) => {
      // Add text before citation
      if (citation.startIndex > lastIndex) {
        parts.push(
          <span key={`text-${index}`}>{localText.slice(lastIndex, citation.startIndex)}</span>
        )
      }

      // Add citation with underline
      const verification = verifications.get(citation.id)
      const status = verification
        ? verification.isValid && verification.isCurrentlyValid
          ? 'verified'
          : 'invalid'
        : 'unverified'

      const underlineColor =
        status === 'verified'
          ? 'decoration-green-500'
          : status === 'invalid'
            ? 'decoration-red-500'
            : 'decoration-blue-500'

      parts.push(
        <span
          key={`citation-${citation.id}`}
          className={cn(
            'underline decoration-2 cursor-pointer hover:bg-muted/50 transition-colors',
            underlineColor
          )}
          onClick={() => setSelectedCitation(citation)}
          title={citation.text}
        >
          {localText.slice(citation.startIndex, citation.endIndex)}
        </span>
      )

      lastIndex = citation.endIndex
    })

    // Add remaining text
    if (lastIndex < localText.length) {
      parts.push(<span key="text-end">{localText.slice(lastIndex)}</span>)
    }

    return <div className="whitespace-pre-wrap font-mono text-sm p-4">{parts}</div>
  }, [localText, citations, verifications, enableCitationDetection])

  return (
    <div className={cn('relative', className)}>
      {/* Header with citation panel */}
      {enableCitationDetection && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {citations.length} {citations.length === 1 ? 'citation' : 'citations'} detected
            </span>
          </div>
          <CitationPanel
            citations={citations}
            verifications={verifications}
            onVerifyAll={verifyAllCitations}
            onVerifySingle={handleVerifyCitation}
            onExport={exportCitations}
            isVerifying={isVerifying}
            verificationProgress={verificationProgress || undefined}
          />
        </div>
      )}

      {/* Text editor with context menu */}
      <ContextMenu>
        <ContextMenuTrigger>
          {editable ? (
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={localText}
                onChange={(e) => handleTextChange(e.target.value)}
                onContextMenu={handleContextMenu}
                className="min-h-[400px] font-mono"
                placeholder="Enter or dictate your transcript here. Citations will be automatically detected."
              />
            </div>
          ) : (
            <div
              className="border rounded-md p-4 min-h-[400px] bg-muted/50"
              onContextMenu={handleContextMenu}
            >
              {renderHighlightedText || localText}
            </div>
          )}
        </ContextMenuTrigger>

        {selectedCitation && (
          <ContextMenuContent>
            <ContextMenuItem
              onClick={() => handleVerifyCitation(selectedCitation)}
              disabled={isVerifying}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Verify Citation
            </ContextMenuItem>
            <ContextMenuItem onClick={() => setSelectedCitation(null)}>
              View Details
            </ContextMenuItem>
          </ContextMenuContent>
        )}
      </ContextMenu>

      {/* Selected citation badge */}
      {selectedCitation && (
        <div className="mt-4 p-4 border rounded-lg bg-muted/50">
          <div className="text-sm font-medium mb-2">Selected Citation:</div>
          <CitationBadge
            citation={selectedCitation}
            verification={verifications.get(selectedCitation.id)}
            onClick={() => handleVerifyCitation(selectedCitation)}
          />
        </div>
      )}

      {/* Citation legend */}
      {enableCitationDetection && citations.length > 0 && !editable && (
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span>Citation Status:</span>
          <div className="flex items-center gap-2">
            <span className="underline decoration-green-500 decoration-2">Verified</span>
            <span className="underline decoration-red-500 decoration-2">Invalid</span>
            <span className="underline decoration-blue-500 decoration-2">Unverified</span>
          </div>
        </div>
      )}
    </div>
  )
}
