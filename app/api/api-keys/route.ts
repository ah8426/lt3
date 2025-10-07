import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/auth';
import { prisma } from '@/lib/prisma';
import { encryptAPIKey, maskAPIKey, validateAPIKeyFormat } from '@/lib/encryption/key-manager';
import { z } from 'zod';

// ============================================================================
// GET /api/api-keys - List all API keys for the authenticated user
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

    // Fetch all API keys for this user
    const apiKeys = await prisma.encryptedApiKey.findMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      select: {
        id: true,
        provider: true,
        maskedKey: true,
        lastUsedAt: true,
        lastTestedAt: true,
        testStatus: true,
        createdAt: true,
        updatedAt: true,
        // IMPORTANT: Never return encryptedKey to client
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ apiKeys });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/api-keys - Add or update an API key
// ============================================================================

const addKeySchema = z.object({
  provider: z.enum(['deepgram', 'assemblyai', 'anthropic', 'openai', 'google', 'openrouter']),
  apiKey: z.string().min(20, 'API key must be at least 20 characters'),
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
    const validation = addKeySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { provider, apiKey } = validation.data;

    // Validate API key format
    if (!validateAPIKeyFormat(apiKey, provider)) {
      return NextResponse.json(
        { error: `Invalid API key format for ${provider}` },
        { status: 400 }
      );
    }

    // Encrypt the API key
    const encryptedKey = await encryptAPIKey(apiKey, user.id);
    const maskedKey = maskAPIKey(apiKey);

    // Upsert (insert or update)
    const savedKey = await prisma.encryptedApiKey.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider,
        },
      },
      update: {
        encryptedKey,
        maskedKey,
        testStatus: null,
        testError: null,
        lastTestedAt: null,
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        provider,
        encryptedKey,
        maskedKey,
        isActive: true,
      },
      select: {
        id: true,
        provider: true,
        maskedKey: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      message: 'API key saved successfully',
      apiKey: savedKey,
    });
  } catch (error) {
    console.error('Error saving API key:', error);
    return NextResponse.json(
      { error: 'Failed to save API key' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/api-keys - Delete an API key
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get provider from query params
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider parameter is required' },
        { status: 400 }
      );
    }

    // Soft delete (set isActive to false)
    const result = await prisma.encryptedApiKey.updateMany({
      where: {
        userId: user.id,
        provider,
        isActive: true,
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'API key deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return NextResponse.json(
      { error: 'Failed to delete API key' },
      { status: 500 }
    );
  }
}
