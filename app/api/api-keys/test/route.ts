import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/auth';
import { prisma } from '@/lib/prisma';
import { decryptAPIKey } from '@/lib/server/encryption/key-manager';
import { logAction } from '@/lib/audit/logger';
import { AuditAction, AuditResource } from '@/types/audit';

/**
 * Test API key connection
 * Makes a lightweight API call to verify the key works
 */
async function testAPIKey(provider: string, apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    switch (provider) {
      case 'openai':
        const openaiResponse = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });
        return { success: openaiResponse.ok, error: openaiResponse.ok ? undefined : await openaiResponse.text() };

      case 'anthropic':
        const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'test' }],
          }),
        });
        return { success: anthropicResponse.ok, error: anthropicResponse.ok ? undefined : await anthropicResponse.text() };

      case 'deepgram':
        const deepgramResponse = await fetch('https://api.deepgram.com/v1/projects', {
          headers: {
            'Authorization': `Token ${apiKey}`,
          },
        });
        return { success: deepgramResponse.ok, error: deepgramResponse.ok ? undefined : await deepgramResponse.text() };

      case 'assemblyai':
        const assemblyaiResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
          method: 'POST',
          headers: {
            'authorization': apiKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            audio_url: 'https://example.com/test.mp3',
          }),
        });
        // AssemblyAI returns 400 for invalid audio URL but 401 for invalid API key
        return { success: assemblyaiResponse.status === 400 || assemblyaiResponse.ok, error: assemblyaiResponse.status === 401 ? 'Invalid API key' : undefined };

      case 'google':
        const googleResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        return { success: googleResponse.ok, error: googleResponse.ok ? undefined : await googleResponse.text() };

      case 'openrouter':
        const openrouterResponse = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });
        return { success: openrouterResponse.ok, error: openrouterResponse.ok ? undefined : await openrouterResponse.text() };

      default:
        return { success: false, error: 'Unknown provider' };
    }
  } catch (error) {
    console.error(`Error testing ${provider} API key:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

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

    // Parse request body
    const body = await request.json();
    const { provider, apiKey } = body;

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      );
    }

    let keyToTest: string;
    let apiKeyRecordId: string | null = null;

    // If API key is provided directly, test it without database lookup
    if (apiKey) {
      keyToTest = apiKey;
    } else {
      // Fetch encrypted API key from database
      const apiKeyRecord = await prisma.encryptedApiKey.findUnique({
        where: {
          userId_provider: {
            userId: user.id,
            provider,
          },
          isActive: true,
        },
      });

      if (!apiKeyRecord) {
        return NextResponse.json(
          { error: 'API key not found' },
          { status: 404 }
        );
      }

      // Decrypt the API key
      keyToTest = await decryptAPIKey(apiKeyRecord.encryptedKey, user.id);
      apiKeyRecordId = apiKeyRecord.id;
    }

    // Test the connection
    const testResult = await testAPIKey(provider, keyToTest);

    // Update test status if key exists in database
    if (apiKeyRecordId) {
      await prisma.encryptedApiKey.update({
        where: { id: apiKeyRecordId },
        data: {
          lastTestedAt: new Date(),
          testStatus: testResult.success ? 'success' : 'failed',
          testError: testResult.error,
        },
      });

      // Log API key test
      await logAction({
        userId: user.id,
        action: AuditAction.API_KEY_TEST,
        resource: AuditResource.API_KEY,
        resourceId: apiKeyRecordId,
        metadata: {
          provider,
          success: testResult.success,
        },
      });
    }

    return NextResponse.json({
      success: testResult.success,
      error: testResult.error,
      message: testResult.success ? 'Connection successful' : 'Connection failed',
    });
  } catch (error) {
    console.error('Error testing API key:', error);
    return NextResponse.json(
      { error: 'Failed to test API key' },
      { status: 500 }
    );
  }
}
