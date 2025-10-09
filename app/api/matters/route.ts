import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// ============================================================================
// GET /api/matters - List user's matters
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const jurisdiction = searchParams.get('jurisdiction');
    const courtType = searchParams.get('courtType');

    // Build where clause
    const where: any = {
      userId: user.id,
    };

    if (status && status !== 'all') {
      where.status = status;
    }

    if (jurisdiction && jurisdiction !== 'all') {
      where.jurisdiction = jurisdiction;
    }

    if (courtType && courtType !== 'all') {
      where.courtType = courtType;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { clientName: { contains: search, mode: 'insensitive' } },
        { adverseParty: { contains: search, mode: 'insensitive' } },
        { caseNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Fetch matters with related counts
    const matters = await prisma.matter.findMany({
      where,
      include: {
        _count: {
          select: {
            sessions: true,
            documents: true,
            billableTime: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Calculate total billable amount for each matter
    const mattersWithStats = await Promise.all(
      matters.map(async (matter: any) => {
        const billableStats = await prisma.billableTime.aggregate({
          where: {
            matterId: matter.id,
          },
          _sum: {
            amount: true,
            durationSeconds: true,
          },
        });

        return {
          ...matter,
          totalBillableAmount: billableStats._sum.amount || 0,
          totalDuration: billableStats._sum.durationSeconds || 0,
        };
      })
    );

    return NextResponse.json({ matters: mattersWithStats });
  } catch (error) {
    console.error('Error fetching matters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matters' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/matters - Create new matter
// ============================================================================

const createMatterSchema = z.object({
  name: z.string().min(1, 'Matter name is required').max(255),
  clientName: z.string().min(1, 'Client name is required').max(255),
  adverseParty: z.string().max(255).optional(),
  jurisdiction: z.enum(['michigan', 'federal', 'other']).optional(),
  courtType: z.enum(['circuit', 'district', 'probate', 'appeals', 'bankruptcy', 'family', 'other']).optional(),
  caseNumber: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = createMatterSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Create matter
    const matter = await prisma.matter.create({
      data: {
        name: data.name,
        clientName: data.clientName,
        adverseParty: data.adverseParty || null,
        jurisdiction: data.jurisdiction || null,
        courtType: data.courtType || null,
        caseNumber: data.caseNumber || null,
        status: 'active',
        userId: user.id,
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

    // TODO: Run conflict check if adverseParty is provided
    // This would create a ConflictCheck record in the background

    return NextResponse.json({
      message: 'Matter created successfully',
      matter,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating matter:', error);
    return NextResponse.json(
      { error: 'Failed to create matter' },
      { status: 500 }
    );
  }
}
