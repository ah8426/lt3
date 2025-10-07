import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const origin = request.headers.get('origin') || 'http://localhost:3000';

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${origin}/auth/callback`,
        scopes: 'email openid profile',
      },
    });

    if (error) {
      console.error('Microsoft OAuth error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ url: data.url });
  } catch (error) {
    console.error('Unexpected error during Microsoft OAuth:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
