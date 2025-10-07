import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/auth';
import { prisma } from '@/lib/server/db';
import { decryptAPIKey } from '@/lib/server/encryption/key-manager';

// ============================================================================
// GET /api/api-keys/[provider] - Decrypt and return API key (server-side only)
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
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

    const { provider } = await params;

    // SECURITY: This endpoint should ONLY be called from server-side code
    // Never expose this endpoint to client-side code
    // Validate origin or use API key/token authentication in production

    // Fetch encrypted API key
    const apiKey = await prisma.encryptedApiKey.findUnique({
      where: {
        userId_provider: {
          userId: user.id,
          provider,
        },
        isActive: true,
      },
    });

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    // Decrypt the API key
    const decryptedKey = await decryptAPIKey(apiKey.encryptedKey, user.id);

    // Update last used timestamp
    await prisma.encryptedApiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    // CRITICAL: Only return the decrypted key in server-side operations
    // This should never be exposed to the client
    return NextResponse.json({
      provider,
      apiKey: decryptedKey,
    });
  } catch (error) {
    console.error('Error retrieving API key:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve API key' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT /api/api-keys/[provider] - Update API key for a specific provider
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
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

    const { provider } = await params;

    // Parse request body
    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    // Use the POST endpoint logic (which handles upsert)
    // Redirect to the main endpoint
    return NextResponse.json(
      { error: 'Use POST /api/api-keys instead' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating API key:', error);
    return NextResponse.json(
      { error: 'Failed to update API key' },
      { status: 500 }
    );
  }
}
