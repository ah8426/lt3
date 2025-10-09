import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createRedaction,
  getRedactions,
  CreateRedactionParams,
} from '@/lib/redaction/redaction-manager'
import { detectPII, PIIType, DetectPIIOptions } from '@/lib/redaction/pii-detector'
import { AuditAction, AuditResource, logAction } from '@/lib/audit/logger'
import { z } from 'zod'

const createRedactionSchema = z.object({
  segmentId: z.string().optional(),
  originalText: z.string(),
  redactedText: z.string(),
  piiType: z.nativeEnum(PIIType),
  startOffset: z.number().int().min(0),
  endOffset: z.number().int().min(0),
  reason: z.string().optional(),
  legalBasis: z.string().optional(),
  accessControl: z.array(z.string()).optional(),
})

const detectPIISchema = z.object({
  text: z.string(),
  options: z.object({
    includeNames: z.boolean().optional(),
    includeAddresses: z.boolean().optional(),
    includeEmails: z.boolean().optional(),
    includePhones: z.boolean().optional(),
    includeFinancial: z.boolean().optional(),
    includeDates: z.boolean().optional(),
    minConfidence: z.number().min(0).max(1).optional(),
  }).optional(),
})

/**
 * GET /api/sessions/[id]/redactions
 * List all redactions for a session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: sessionId } = await params
    const { searchParams } = new URL(request.url)
    const segmentId = searchParams.get('segmentId') || undefined
    const piiType = searchParams.get('piiType') as PIIType | undefined

    // Get redactions
    const redactions = await getRedactions(sessionId, {
      segmentId,
      piiType,
    })

    return NextResponse.json({ redactions })
  } catch (error) {
    console.error('Error fetching redactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch redactions' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/sessions/[id]/redactions
 * Create a new redaction or detect PII
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: sessionId } = await params
    const body = await request.json()

    // Check if this is a PII detection request
    if (body.action === 'detect') {
      const validated = detectPIISchema.parse(body)

      // Detect PII
      const matches = await detectPII(validated.text, validated.options)

      // Log PII detection
      await logAction({
        userId: user.id,
        action: AuditAction.PII_DETECT,
        resource: AuditResource.TRANSCRIPT,
        resourceId: sessionId,
        metadata: {
          matchCount: matches.length,
          piiTypes: [...new Set(matches.map((m) => m.type))],
        },
      })

      return NextResponse.json({ matches })
    }

    // Otherwise, create a redaction
    const validated = createRedactionSchema.parse(body)

    const redaction = await createRedaction({
      sessionId,
      segmentId: validated.segmentId,
      originalText: validated.originalText,
      redactedText: validated.redactedText,
      piiType: validated.piiType,
      startOffset: validated.startOffset,
      endOffset: validated.endOffset,
      reason: validated.reason,
      legalBasis: validated.legalBasis,
      userId: user.id,
      accessControl: validated.accessControl,
    })

    return NextResponse.json({ redaction }, { status: 201 })
  } catch (error) {
    console.error('Error creating redaction:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create redaction' },
      { status: 500 }
    )
  }
}
