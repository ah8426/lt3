import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { logAction } from '@/lib/audit/logger'
import { AuditAction, AuditResource } from '@/types/audit'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')
  const origin = requestUrl.origin

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error, errorDescription)

    // Log failed login attempt (without user ID since we don't have one)
    // This will fail gracefully since we need a user ID

    return NextResponse.redirect(
      `${origin}/auth/error?error=${encodeURIComponent(error)}&message=${encodeURIComponent(errorDescription || 'Authentication failed')}`
    )
  }

  // Exchange code for session
  if (code) {
    try {
      const supabase = await createClient()
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        console.error('Code exchange error:', exchangeError)
        return NextResponse.redirect(
          `${origin}/auth/error?error=exchange_failed&message=${encodeURIComponent(exchangeError.message)}`
        )
      }

      // Successfully authenticated
      if (data.session) {
        // Get or create user profile in database
        const { user } = data.session

        // Log successful login
        await logAction({
          userId: user.id,
          action: AuditAction.LOGIN,
          resource: AuditResource.USER,
          metadata: {
            provider: user.app_metadata.provider || 'unknown',
          },
        })

        // Check if user exists in profiles table
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        // Create profile if it doesn't exist
        if (!profile && !profileError) {
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email,
              full_name: user.user_metadata.full_name || user.user_metadata.name,
              avatar_url: user.user_metadata.avatar_url || user.user_metadata.picture,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })

          if (insertError) {
            console.error('Profile creation error:', insertError)
          }
        } else if (profile) {
          // Update existing profile with latest OAuth data
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              email: user.email,
              full_name: user.user_metadata.full_name || user.user_metadata.name || profile.full_name,
              avatar_url: user.user_metadata.avatar_url || user.user_metadata.picture || profile.avatar_url,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id)

          if (updateError) {
            console.error('Profile update error:', updateError)
          }
        }

        // Redirect to dashboard
        return NextResponse.redirect(`${origin}/dashboard`)
      }
    } catch (error) {
      console.error('Unexpected error during authentication:', error)
      return NextResponse.redirect(
        `${origin}/auth/error?error=unexpected&message=${encodeURIComponent('An unexpected error occurred')}`
      )
    }
  }

  // No code or error - redirect to login
  return NextResponse.redirect(`${origin}/login`)
}
