import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * GET /api/ai/usage
 * Get AI usage statistics for the current user
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const provider = searchParams.get('provider')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '100')

    // Build where clause
    const where: any = {
      user_id: user.id,
    }

    if (provider) {
      where.provider = provider
    }

    if (startDate) {
      where.created_at = {
        ...where.created_at,
        gte: new Date(startDate),
      }
    }

    if (endDate) {
      where.created_at = {
        ...where.created_at,
        lte: new Date(endDate),
      }
    }

    // Get usage records
    const records = await prisma.ai_usage.findMany({
      where,
      orderBy: {
        created_at: 'desc',
      },
      take: limit,
    })

    // Calculate aggregated stats
    const stats = {
      totalCost: 0,
      totalTokens: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      requestCount: records.length,
      byProvider: {} as Record<string, { cost: number; tokens: number; requests: number }>,
      byModel: {} as Record<string, { cost: number; tokens: number; requests: number }>,
    }

    for (const record of records) {
      stats.totalCost += record.cost
      stats.totalTokens += record.total_tokens
      stats.totalPromptTokens += record.prompt_tokens
      stats.totalCompletionTokens += record.completion_tokens

      // By provider
      if (!stats.byProvider[record.provider]) {
        stats.byProvider[record.provider] = { cost: 0, tokens: 0, requests: 0 }
      }
      stats.byProvider[record.provider].cost += record.cost
      stats.byProvider[record.provider].tokens += record.total_tokens
      stats.byProvider[record.provider].requests += 1

      // By model
      if (!stats.byModel[record.model]) {
        stats.byModel[record.model] = { cost: 0, tokens: 0, requests: 0 }
      }
      stats.byModel[record.model].cost += record.cost
      stats.byModel[record.model].tokens += record.total_tokens
      stats.byModel[record.model].requests += 1
    }

    return NextResponse.json({
      stats,
      records: records.map((r) => ({
        id: r.id,
        provider: r.provider,
        model: r.model,
        promptTokens: r.prompt_tokens,
        completionTokens: r.completion_tokens,
        totalTokens: r.total_tokens,
        cost: r.cost,
        purpose: r.purpose,
        createdAt: r.created_at,
      })),
    })
  } catch (error) {
    console.error('Get AI usage error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get AI usage',
      },
      { status: 500 }
    )
  }
}
