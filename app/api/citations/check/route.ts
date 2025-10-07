import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { AIProviderManager } from '@/lib/ai/provider-manager'
import {
  CitationChecker,
  extractCitations,
  type ExtractedCitation,
  type CitationVerification,
} from '@/lib/services/citation-checker'
import type { AIProvider } from '@/types/ai'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/citations/check
 * Check citation(s) for validity
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      text,
      citations,
      sessionId,
      provider,
      model,
      storeResults = true,
    } = body as {
      text?: string
      citations?: ExtractedCitation[]
      sessionId?: string
      provider?: AIProvider
      model?: string
      storeResults?: boolean
    }

    // Extract citations from text if not provided
    let citationsToCheck: ExtractedCitation[] = citations || []
    if (text && !citations) {
      citationsToCheck = extractCitations(text)
    }

    if (citationsToCheck.length === 0) {
      return NextResponse.json({
        error: 'No citations found',
        extracted: [],
      })
    }

    // Get API keys
    const apiKeys = await getApiKeys(user.id)

    // Initialize provider manager
    const manager = new AIProviderManager({
      providers: createProviderConfigs(apiKeys),
      failover: {
        providers: ['anthropic', 'openai', 'google', 'openrouter'],
        maxRetries: 2,
        retryDelay: 1000,
        fallbackModels: {
          anthropic: 'claude-3-5-sonnet-20241022',
          openai: 'gpt-4o-mini',
          google: 'gemini-1.5-flash',
          openrouter: 'openai/gpt-4o-mini',
        },
      },
      onUsageRecord: async (record) => {
        try {
          await prisma.ai_usage.create({
            data: {
              user_id: user.id,
              provider: record.provider,
              model: record.model,
              prompt_tokens: record.promptTokens,
              completion_tokens: record.completionTokens,
              total_tokens: record.totalTokens,
              cost: record.cost,
              purpose: 'citation_verification',
              metadata: {
                sessionId,
                citationCount: citationsToCheck.length,
              } as any,
            },
          })
        } catch (error) {
          console.error('Failed to save AI usage:', error)
        }
      },
    })

    // Create citation checker
    const checker = new CitationChecker(manager)

    // Check citations
    let results: CitationVerification[]
    let batchResult

    if (citationsToCheck.length === 1) {
      // Single citation check
      const result = await checker.checkCitation(citationsToCheck[0], { provider, model })
      results = [result]
    } else {
      // Batch check
      batchResult = await checker.batchCheckCitations(citationsToCheck, {
        provider,
        model,
      })
      results = batchResult.results
    }

    // Store results in database if requested
    if (storeResults && sessionId) {
      await storeCitationVerifications(sessionId, citationsToCheck, results)
    }

    return NextResponse.json({
      citations: citationsToCheck,
      verifications: results,
      batch: batchResult
        ? {
            totalChecked: batchResult.totalChecked,
            validCount: batchResult.validCount,
            invalidCount: batchResult.invalidCount,
            unknownCount: batchResult.unknownCount,
            cost: batchResult.cost,
          }
        : undefined,
    })
  } catch (error) {
    console.error('Citation check API error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Citation check failed',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/citations/check?sessionId=xxx
 * Get citation verification history
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const sessionId = searchParams.get('sessionId')
    const documentId = searchParams.get('documentId')

    if (!sessionId && !documentId) {
      return NextResponse.json(
        { error: 'sessionId or documentId required' },
        { status: 400 }
      )
    }

    // Fetch citation verifications
    const where: any = {}
    if (sessionId) where.sessionId = sessionId
    if (documentId) where.documentId = documentId

    const citations = await prisma.citation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ citations })
  } catch (error) {
    console.error('Get citations error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch citations',
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getApiKeys(userId: string): Promise<Record<string, string>> {
  const keys: Record<string, string> = {}

  // Get from environment variables for now
  if (process.env.ANTHROPIC_API_KEY) {
    keys.anthropic = process.env.ANTHROPIC_API_KEY
  }
  if (process.env.OPENAI_API_KEY) {
    keys.openai = process.env.OPENAI_API_KEY
  }
  if (process.env.GOOGLE_API_KEY) {
    keys.google = process.env.GOOGLE_API_KEY
  }
  if (process.env.OPENROUTER_API_KEY) {
    keys.openrouter = process.env.OPENROUTER_API_KEY
  }

  // TODO: Get user-specific keys from encrypted_api_keys table

  return keys
}

function createProviderConfigs(apiKeys: Record<string, string>) {
  const configs = new Map()

  if (apiKeys.anthropic) {
    configs.set('anthropic', {
      apiKey: apiKeys.anthropic,
      maxRetries: 2,
      timeout: 60000,
    })
  }

  if (apiKeys.openai) {
    configs.set('openai', {
      apiKey: apiKeys.openai,
      maxRetries: 2,
      timeout: 60000,
    })
  }

  if (apiKeys.google) {
    configs.set('google', {
      apiKey: apiKeys.google,
      maxRetries: 2,
      timeout: 60000,
    })
  }

  if (apiKeys.openrouter) {
    configs.set('openrouter', {
      apiKey: apiKeys.openrouter,
      baseURL: 'https://openrouter.ai/api/v1',
      maxRetries: 2,
      timeout: 60000,
    })
  }

  return configs
}

async function storeCitationVerifications(
  sessionId: string,
  citations: ExtractedCitation[],
  verifications: CitationVerification[]
) {
  const citationRecords = citations.map((citation, index) => {
    const verification = verifications[index]

    return {
      sessionId,
      citationType: citation.type,
      fullCitation: citation.text,
      shortCitation: citation.text.substring(0, 100),
      jurisdiction: citation.jurisdiction,
      volume: citation.volume ? parseInt(citation.volume) : null,
      reporter: citation.reporter,
      page: citation.page ? parseInt(citation.page) : null,
      year: citation.year ? parseInt(citation.year) : null,
      caseName: citation.caseName,
      statuteCode: citation.statute?.title,
      section: citation.statute?.section,
      isVerified: verification.isValid,
      verificationStatus: verification.treatmentStatus || 'unknown',
      verifiedAt: verification.verifiedAt,
      verifiedBy: 'ai',
      verificationNotes: JSON.stringify({
        isFormatCorrect: verification.isFormatCorrect,
        isCurrentlyValid: verification.isCurrentlyValid,
        bluebookFormat: verification.bluebookFormat,
        suggestions: verification.suggestions,
        errors: verification.errors,
        confidence: verification.confidence,
        details: verification.details,
      }),
      treatmentStatus: verification.treatmentStatus,
    }
  })

  // Use createMany for better performance
  await prisma.citation.createMany({
    data: citationRecords,
    skipDuplicates: true,
  })
}
