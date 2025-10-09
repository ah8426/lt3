import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import {
  updateConflictResolution,
  ConflictStatus,
} from '@/lib/conflicts/conflict-checker'
import { z } from 'zod'

const updateResolutionSchema = z.object({
  status: z.enum(['pending', 'waived', 'declined', 'screened', 'cleared']),
  notes: z.string().optional(),
})

/**
 * GET /api/conflicts/[id]
 * Get conflict check details
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

    const { id } = await params

    const conflictCheck = await prisma.conflictCheck.findUnique({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!conflictCheck) {
      return NextResponse.json(
        { error: 'Conflict check not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ conflictCheck })
  } catch (error) {
    console.error('Error fetching conflict check:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conflict check' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/conflicts/[id]
 * Update conflict resolution
 */
export async function PATCH(
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

    const { id } = await params

    // Verify ownership
    const existing = await prisma.conflictCheck.findUnique({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Conflict check not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validated = updateResolutionSchema.parse(body)

    await updateConflictResolution(
      id,
      validated.status as ConflictStatus,
      validated.notes,
      user.id
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating conflict resolution:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update conflict resolution' },
      { status: 500 }
    )
  }
}
