import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// ============================================================================
// GET /api/matters/[id] - Get matter details
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Fetch matter with related data
    const matter = await prisma.matter.findUnique({
      where: {
        id,
        userId: user.id, // Ensure user owns this matter
      },
      include: {
        sessions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            status: true,
            startedAt: true,
            endedAt: true,
            durationMs: true,
          },
        },
        documents: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        billableTime: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            sessions: true,
            documents: true,
            billableTime: true,
          },
        },
      },
    });

    if (!matter) {
      return NextResponse.json(
        { error: 'Matter not found' },
        { status: 404 }
      );
    }

    // Calculate billing statistics
    const billingStats = await prisma.billableTime.aggregate({
      where: {
        matterId: id,
      },
      _sum: {
        amount: true,
        billableSeconds: true,
        durationSeconds: true,
      },
      _count: true,
    });

    return NextResponse.json({
      matter: {
        ...matter,
        billingStats: {
          totalAmount: billingStats._sum.amount || 0,
          totalBillableSeconds: billingStats._sum.billableSeconds || 0,
          totalDurationSeconds: billingStats._sum.durationSeconds || 0,
          count: billingStats._count,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching matter:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matter' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH /api/matters/[id] - Update matter
// ============================================================================

const updateMatterSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  clientName: z.string().min(1).max(255).optional(),
  adverseParty: z.string().max(255).optional().nullable(),
  jurisdiction: z.enum(['michigan', 'federal', 'other']).optional().nullable(),
  courtType: z.enum(['circuit', 'district', 'probate', 'appeals', 'bankruptcy', 'family', 'other']).optional().nullable(),
  caseNumber: z.string().max(100).optional().nullable(),
  status: z.enum(['active', 'archived', 'closed', 'pending']).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify matter ownership
    const existingMatter = await prisma.matter.findUnique({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existingMatter) {
      return NextResponse.json(
        { error: 'Matter not found' },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateMatterSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Update matter
    const matter = await prisma.matter.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: {
        _count: {
          select: {
            sessions: true,
            documents: true,
            billableTime: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: 'Matter updated successfully',
      matter,
    });
  } catch (error) {
    console.error('Error updating matter:', error);
    return NextResponse.json(
      { error: 'Failed to update matter' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/matters/[id] - Archive matter (soft delete)
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify matter ownership
    const existingMatter = await prisma.matter.findUnique({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!existingMatter) {
      return NextResponse.json(
        { error: 'Matter not found' },
        { status: 404 }
      );
    }

    // Archive matter instead of hard delete
    const matter = await prisma.matter.update({
      where: { id },
      data: {
        status: 'archived',
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'Matter archived successfully',
      matter,
    });
  } catch (error) {
    console.error('Error archiving matter:', error);
    return NextResponse.json(
      { error: 'Failed to archive matter' },
      { status: 500 }
    );
  }
}
