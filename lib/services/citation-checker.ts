/**
 * Citation Checker Service
 * Extracts and verifies legal citations using AI
 */

import { AIProviderManager } from '@/lib/ai/provider-manager'
import type { AIProvider, AIMessage } from '@/types/ai'

// ============================================================================
// TYPES
// ============================================================================

export type CitationType =
  | 'mcl' // Michigan Compiled Laws
  | 'mcr' // Michigan Court Rules
  | 'usc' // United States Code
  | 'cfr' // Code of Federal Regulations
  | 'case' // Case citations
  | 'unknown'

export interface ExtractedCitation {
  id: string
  text: string
  type: CitationType
  startIndex: number
  endIndex: number
  jurisdiction?: string
  volume?: string
  reporter?: string
  page?: string
  year?: string
  statute?: {
    title?: string
    section?: string
    subsection?: string
  }
  caseName?: string
}

export interface CitationVerification {
  citationId: string
  isValid: boolean
  isFormatCorrect: boolean
  isCurrentlyValid: boolean
  treatmentStatus?: 'good' | 'questioned' | 'negative' | 'superseded' | 'unknown'
  bluebookFormat?: string
  suggestions?: string[]
  errors?: string[]
  verifiedAt: Date
  verificationSource: string
  confidence: number
  details?: {
    fullName?: string
    court?: string
    decidedDate?: string
    status?: string
    treatmentNotes?: string
    relatedCases?: string[]
  }
}

export interface BatchVerificationResult {
  results: CitationVerification[]
  totalChecked: number
  validCount: number
  invalidCount: number
  unknownCount: number
  cost: number
}

// ============================================================================
// CITATION PATTERNS
// ============================================================================

/**
 * Comprehensive regex patterns for legal citations
 */
export const CITATION_PATTERNS = {
  // Michigan Compiled Laws: MCL 600.2591, MCL § 600.2591, MCLA 600.2591
  mcl: /\b(?:MCL|MCLA|MSA)\s*(?:§\s*)?(\d+)\.(\d+(?:\([a-z0-9]+\))?(?:\([a-z0-9]+\))?)/gi,

  // Michigan Court Rules: MCR 2.116, MCR 2.116(C)(10)
  mcr: /\bMCR\s*(\d+\.\d+(?:\([A-Z]\))?(?:\(\d+\))?)/gi,

  // United States Code: 42 USC 1983, 42 U.S.C. § 1983
  usc: /\b(\d+)\s+U\.?S\.?C\.?\s*(?:§\s*)?(\d+[a-z]?(?:-\d+)?(?:\([a-z0-9]+\))?)/gi,

  // Code of Federal Regulations: 29 CFR 1910.1200
  cfr: /\b(\d+)\s+C\.?F\.?R\.?\s*(?:§\s*)?(\d+\.\d+)/gi,

  // Michigan Supreme Court: 500 Mich 1, 500 Mich 1, 5
  michSupreme: /\b(\d+)\s+Mich\.?\s+(\d+)(?:,\s*(\d+))?/gi,

  // Michigan Court of Appeals: 300 Mich App 1
  michApp: /\b(\d+)\s+Mich\.?\s+App\.?\s+(\d+)/gi,

  // US Supreme Court: 500 US 1, 500 U.S. 1
  usSupreme: /\b(\d+)\s+U\.?S\.?\s+(\d+)/gi,

  // Federal Reporter (2d, 3d): 900 F.2d 100, 900 F.3d 100
  federal: /\b(\d+)\s+F\.(\d)d\s+(\d+)/gi,

  // NW Reporter (Michigan): 800 NW2d 1, 800 N.W.2d 1
  nwReporter: /\b(\d+)\s+N\.?W\.?2d\s+(\d+)/gi,
}

/**
 * Full case citation pattern with case name
 * Example: Smith v Jones, 500 Mich 1; 800 NW2d 100 (2011)
 */
export const FULL_CASE_PATTERN =
  /\b([A-Z][A-Za-z\s&\.]+)\s+v\.?\s+([A-Z][A-Za-z\s&\.]+),\s*(\d+\s+[A-Za-z\.]+\s+\d+)(?:;\s*(\d+\s+[A-Za-z\.]+\s+\d+))?\s*\((\d{4})\)/gi

// ============================================================================
// CITATION EXTRACTION
// ============================================================================

/**
 * Extract all citations from text
 */
export function extractCitations(text: string): ExtractedCitation[] {
  const citations: ExtractedCitation[] = []
  let idCounter = 0

  // Extract MCL citations
  const mclMatches = Array.from(text.matchAll(CITATION_PATTERNS.mcl))
  for (const match of mclMatches) {
    citations.push({
      id: `citation-${++idCounter}`,
      text: match[0],
      type: 'mcl',
      startIndex: match.index!,
      endIndex: match.index! + match[0].length,
      jurisdiction: 'Michigan',
      statute: {
        title: match[1],
        section: match[2],
      },
    })
  }

  // Extract MCR citations
  const mcrMatches = Array.from(text.matchAll(CITATION_PATTERNS.mcr))
  for (const match of mcrMatches) {
    citations.push({
      id: `citation-${++idCounter}`,
      text: match[0],
      type: 'mcr',
      startIndex: match.index!,
      endIndex: match.index! + match[0].length,
      jurisdiction: 'Michigan',
      statute: {
        section: match[1],
      },
    })
  }

  // Extract USC citations
  const uscMatches = Array.from(text.matchAll(CITATION_PATTERNS.usc))
  for (const match of uscMatches) {
    citations.push({
      id: `citation-${++idCounter}`,
      text: match[0],
      type: 'usc',
      startIndex: match.index!,
      endIndex: match.index! + match[0].length,
      jurisdiction: 'Federal',
      statute: {
        title: match[1],
        section: match[2],
      },
    })
  }

  // Extract CFR citations
  const cfrMatches = Array.from(text.matchAll(CITATION_PATTERNS.cfr))
  for (const match of cfrMatches) {
    citations.push({
      id: `citation-${++idCounter}`,
      text: match[0],
      type: 'cfr',
      startIndex: match.index!,
      endIndex: match.index! + match[0].length,
      jurisdiction: 'Federal',
      statute: {
        title: match[1],
        section: match[2],
      },
    })
  }

  // Extract case citations
  const caseCitations = extractCaseCitations(text)
  citations.push(...caseCitations.map((c) => ({ ...c, id: `citation-${++idCounter}` })))

  // Sort by appearance in text
  citations.sort((a, b) => a.startIndex - b.startIndex)

  return citations
}

/**
 * Extract case citations
 */
function extractCaseCitations(text: string): Omit<ExtractedCitation, 'id'>[] {
  const citations: Omit<ExtractedCitation, 'id'>[] = []

  // Full case citations with case name
  const fullCaseMatches = Array.from(text.matchAll(FULL_CASE_PATTERN))
  for (const match of fullCaseMatches) {
    citations.push({
      text: match[0],
      type: 'case',
      startIndex: match.index!,
      endIndex: match.index! + match[0].length,
      caseName: `${match[1]} v. ${match[2]}`,
      year: match[5],
    })
  }

  // Michigan Supreme Court
  const michSupremeMatches = Array.from(text.matchAll(CITATION_PATTERNS.michSupreme))
  for (const match of michSupremeMatches) {
    // Skip if already captured in full case citation
    if (citations.some((c) => match.index! >= c.startIndex && match.index! < c.endIndex)) {
      continue
    }
    citations.push({
      text: match[0],
      type: 'case',
      startIndex: match.index!,
      endIndex: match.index! + match[0].length,
      jurisdiction: 'Michigan',
      volume: match[1],
      reporter: 'Mich',
      page: match[2],
    })
  }

  // Michigan Court of Appeals
  const michAppMatches = Array.from(text.matchAll(CITATION_PATTERNS.michApp))
  for (const match of michAppMatches) {
    if (citations.some((c) => match.index! >= c.startIndex && match.index! < c.endIndex)) {
      continue
    }
    citations.push({
      text: match[0],
      type: 'case',
      startIndex: match.index!,
      endIndex: match.index! + match[0].length,
      jurisdiction: 'Michigan',
      volume: match[1],
      reporter: 'Mich App',
      page: match[2],
    })
  }

  // US Supreme Court
  const usSupremeMatches = Array.from(text.matchAll(CITATION_PATTERNS.usSupreme))
  for (const match of usSupremeMatches) {
    if (citations.some((c) => match.index! >= c.startIndex && match.index! < c.endIndex)) {
      continue
    }
    citations.push({
      text: match[0],
      type: 'case',
      startIndex: match.index!,
      endIndex: match.index! + match[0].length,
      jurisdiction: 'Federal',
      volume: match[1],
      reporter: 'U.S.',
      page: match[2],
    })
  }

  // Federal Reporter
  const federalMatches = Array.from(text.matchAll(CITATION_PATTERNS.federal))
  for (const match of federalMatches) {
    if (citations.some((c) => match.index! >= c.startIndex && match.index! < c.endIndex)) {
      continue
    }
    citations.push({
      text: match[0],
      type: 'case',
      startIndex: match.index!,
      endIndex: match.index! + match[0].length,
      jurisdiction: 'Federal',
      volume: match[1],
      reporter: `F.${match[2]}d`,
      page: match[3],
    })
  }

  // NW Reporter
  const nwMatches = Array.from(text.matchAll(CITATION_PATTERNS.nwReporter))
  for (const match of nwMatches) {
    if (citations.some((c) => match.index! >= c.startIndex && match.index! < c.endIndex)) {
      continue
    }
    citations.push({
      text: match[0],
      type: 'case',
      startIndex: match.index!,
      endIndex: match.index! + match[0].length,
      jurisdiction: 'Michigan',
      volume: match[1],
      reporter: 'N.W.2d',
      page: match[2],
    })
  }

  return citations
}

// ============================================================================
// CITATION CHECKER CLASS
// ============================================================================

export class CitationChecker {
  private providerManager: AIProviderManager

  constructor(providerManager: AIProviderManager) {
    this.providerManager = providerManager
  }

  /**
   * Check a single citation for validity
   */
  async checkCitation(
    citation: ExtractedCitation,
    options?: {
      provider?: AIProvider
      model?: string
    }
  ): Promise<CitationVerification> {
    const prompt = this.buildVerificationPrompt(citation)

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are a legal citation verification expert specializing in Michigan and Federal law.
You verify citations for:
1. Format correctness (Bluebook compliance)
2. Current validity (still good law)
3. Treatment status (how courts have treated the authority)
4. Proper citation format

Respond in JSON format only.`,
      },
      {
        role: 'user',
        content: prompt,
      },
    ]

    try {
      const result = await this.providerManager.complete(
        {
          messages,
          model: options?.model || 'claude-3-5-sonnet-20241022',
          temperature: 0.1, // Low temperature for consistency
          maxTokens: 1000,
        },
        options?.provider
      )

      const verification = this.parseVerificationResponse(result.content, citation.id)
      return verification
    } catch (error) {
      console.error('Citation verification error:', error)
      return {
        citationId: citation.id,
        isValid: false,
        isFormatCorrect: false,
        isCurrentlyValid: false,
        treatmentStatus: 'unknown',
        errors: [error instanceof Error ? error.message : 'Verification failed'],
        verifiedAt: new Date(),
        verificationSource: 'error',
        confidence: 0,
      }
    }
  }

  /**
   * Check multiple citations in batch
   */
  async batchCheckCitations(
    citations: ExtractedCitation[],
    options?: {
      provider?: AIProvider
      model?: string
      onProgress?: (completed: number, total: number) => void
    }
  ): Promise<BatchVerificationResult> {
    const results: CitationVerification[] = []
    let totalCost = 0

    for (let i = 0; i < citations.length; i++) {
      const citation = citations[i]
      const verification = await this.checkCitation(citation, options)
      results.push(verification)

      // Update progress
      if (options?.onProgress) {
        options.onProgress(i + 1, citations.length)
      }

      // Small delay to avoid rate limits
      if (i < citations.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    const validCount = results.filter((r) => r.isValid).length
    const invalidCount = results.filter((r) => !r.isValid && r.treatmentStatus !== 'unknown').length
    const unknownCount = results.filter((r) => r.treatmentStatus === 'unknown').length

    return {
      results,
      totalChecked: citations.length,
      validCount,
      invalidCount,
      unknownCount,
      cost: totalCost,
    }
  }

  /**
   * Build verification prompt for AI
   */
  private buildVerificationPrompt(citation: ExtractedCitation): string {
    let prompt = `Verify the following legal citation:\n\n`
    prompt += `Citation Text: "${citation.text}"\n`
    prompt += `Type: ${citation.type.toUpperCase()}\n`

    if (citation.jurisdiction) {
      prompt += `Jurisdiction: ${citation.jurisdiction}\n`
    }

    if (citation.type === 'case') {
      if (citation.caseName) prompt += `Case Name: ${citation.caseName}\n`
      if (citation.volume) prompt += `Volume: ${citation.volume}\n`
      if (citation.reporter) prompt += `Reporter: ${citation.reporter}\n`
      if (citation.page) prompt += `Page: ${citation.page}\n`
      if (citation.year) prompt += `Year: ${citation.year}\n`
    }

    if (citation.statute) {
      if (citation.statute.title) prompt += `Title: ${citation.statute.title}\n`
      if (citation.statute.section) prompt += `Section: ${citation.statute.section}\n`
    }

    prompt += `\nPlease verify:\n`
    prompt += `1. Is the citation format correct according to Bluebook standards?\n`
    prompt += `2. Is this citation currently valid (not superseded, repealed, or overruled)?\n`
    prompt += `3. What is the treatment status (good law, questioned, negative treatment, superseded)?\n`
    prompt += `4. What is the proper Bluebook format for this citation?\n`
    prompt += `5. Any suggestions for improvement?\n\n`

    prompt += `Respond in the following JSON format:\n`
    prompt += `{
  "isValid": boolean,
  "isFormatCorrect": boolean,
  "isCurrentlyValid": boolean,
  "treatmentStatus": "good" | "questioned" | "negative" | "superseded" | "unknown",
  "bluebookFormat": "string",
  "suggestions": ["string"],
  "errors": ["string"],
  "confidence": 0-100,
  "details": {
    "fullName": "string (for cases)",
    "court": "string",
    "decidedDate": "string",
    "status": "string",
    "treatmentNotes": "string"
  }
}`

    return prompt
  }

  /**
   * Parse AI response into verification result
   */
  private parseVerificationResponse(
    content: string,
    citationId: string
  ): CitationVerification {
    try {
      // Extract JSON from response (AI might include extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const parsed = JSON.parse(jsonMatch[0])

      return {
        citationId,
        isValid: parsed.isValid ?? false,
        isFormatCorrect: parsed.isFormatCorrect ?? false,
        isCurrentlyValid: parsed.isCurrentlyValid ?? false,
        treatmentStatus: parsed.treatmentStatus || 'unknown',
        bluebookFormat: parsed.bluebookFormat,
        suggestions: parsed.suggestions || [],
        errors: parsed.errors || [],
        verifiedAt: new Date(),
        verificationSource: 'ai',
        confidence: parsed.confidence || 50,
        details: parsed.details,
      }
    } catch (error) {
      console.error('Failed to parse verification response:', error)
      return {
        citationId,
        isValid: false,
        isFormatCorrect: false,
        isCurrentlyValid: false,
        treatmentStatus: 'unknown',
        errors: ['Failed to parse AI response'],
        verifiedAt: new Date(),
        verificationSource: 'error',
        confidence: 0,
      }
    }
  }
}

/**
 * Helper function to get citation type label
 */
export function getCitationTypeLabel(type: CitationType): string {
  const labels: Record<CitationType, string> = {
    mcl: 'Michigan Compiled Laws',
    mcr: 'Michigan Court Rules',
    usc: 'United States Code',
    cfr: 'Code of Federal Regulations',
    case: 'Case Law',
    unknown: 'Unknown',
  }
  return labels[type]
}

/**
 * Helper function to format citation for display
 */
export function formatCitationDisplay(citation: ExtractedCitation): string {
  if (citation.type === 'case' && citation.caseName) {
    return `${citation.caseName}, ${citation.text}`
  }
  return citation.text
}
