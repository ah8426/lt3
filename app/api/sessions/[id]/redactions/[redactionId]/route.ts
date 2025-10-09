import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  deleteRedaction,
  unredact,
  getRedaction,
  updateAccessControl,
} from '@/lib/redaction/redaction-manager'
import { z } from 'zod'

const unredactSchema = z.object({
  reason: z.string().min(1, 'Reason for unredaction is required'),
})

const updateAccessSchema = z.object({
  accessControl: z.array(z.string()),
})

/**
 * GET /api/sessions/[id]/redactions/[redactionId]
 * Get redaction details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; redactionId: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, redactionId } = await params

    const redaction = await getRedaction(redactionId)

    if (!redaction) {
      return NextResponse.json({ error: 'Redaction not found' }, { status: 404 })
    }

    // Verify session ID matches
    if (redaction.sessionId !== id) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    return NextResponse.json({ redaction })
  } catch (error) {
    console.error('Error fetching redaction:', error)
    return NextResponse.json(
      { error: 'Failed to fetch redaction' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/sessions/[id]/redactions/[redactionId]
 * Delete a redaction
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; redactionId: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { redactionId } = await params

    await deleteRedaction(redactionId, user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting redaction:', error)

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    return NextResponse.json(
      { error: 'Failed to delete redaction' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/sessions/[id]/redactions/[redactionId]/unredact
 * Unredact text (if authorized)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; redactionId: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { redactionId } = await params
    const body = await request.json()

    // Check if this is an access control update
    if (body.action === 'updateAccess') {
      const validated = updateAccessSchema.parse(body)

      const redaction = await updateAccessControl(
        redactionId,
        user.id,
        validated.accessControl
      )

      return NextResponse.json({ redaction })
    }

    // Otherwise, unredact
    const validated = unredactSchema.parse(body)

    const originalText = await unredact({
      redactionId,
      userId: user.id,
      reason: validated.reason,
    })

    return NextResponse.json({ originalText })
  } catch (error) {
    console.error('Error unredacting:', error)

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Failed to unredact' }, { status: 500 })
  }
}
