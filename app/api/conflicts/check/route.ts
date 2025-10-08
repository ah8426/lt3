import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  checkConflicts,
  saveConflictCheck,
  ConflictCheckParams,
} from '@/lib/conflicts/conflict-checker'
import { z } from 'zod'

const conflictCheckSchema = z.object({
  clientName: z.string().optional(),
  adverseParties: z.array(z.string()).optional(),
  companyNames: z.array(z.string()).optional(),
  matterDescription: z.string().optional(),
  excludeMatterId: z.string().optional(),
  saveResult: z.boolean().optional().default(true),
})

/**
 * POST /api/conflicts/check
 * Run conflict check
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = conflictCheckSchema.parse(body)

    // At least one search parameter required
    if (
      !validated.clientName &&
      (!validated.adverseParties || validated.adverseParties.length === 0) &&
      (!validated.companyNames || validated.companyNames.length === 0) &&
      !validated.matterDescription
    ) {
      return NextResponse.json(
        { error: 'At least one search parameter required' },
        { status: 400 }
      )
    }

    // Run conflict check
    const params: ConflictCheckParams = {
      clientName: validated.clientName,
      adverseParties: validated.adverseParties,
      companyNames: validated.companyNames,
      matterDescription: validated.matterDescription,
      userId: user.id,
      excludeMatterId: validated.excludeMatterId,
    }

    const result = await checkConflicts(params)

    // Save result if requested
    let conflictCheckId: string | undefined
    if (validated.saveResult) {
      conflictCheckId = await saveConflictCheck(result, params)
    }

    return NextResponse.json({
      ...result,
      conflictCheckId,
    })
  } catch (error) {
    console.error('Error checking conflicts:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to check conflicts' },
      { status: 500 }
    )
  }
}
