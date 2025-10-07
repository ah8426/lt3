import { createClient as createBrowserClient } from './client'
import { createClient as createServerClient } from './server'

/**
 * Sign in with OAuth provider (Google or Microsoft)
 * Client-side only
 */
export async function signInWithOAuth(provider: 'google' | 'azure') {
  const supabase = createBrowserClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error) {
    throw error
  }

  return data
}

/**
 * Sign out the current user
 * Client-side only
 */
export async function signOut() {
  const supabase = createBrowserClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    throw error
  }

  // Redirect to home page
  window.location.href = '/'
}

/**
 * Get the current user session
 * Server-side only
 */
export async function getSession() {
  const supabase = await createServerClient()

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    throw error
  }

  return session
}

/**
 * Get the current user
 * Server-side only
 */
export async function getUser() {
  const supabase = await createServerClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    throw error
  }

  return user
}

/**
 * Require authentication - throws if not authenticated
 * Server-side only
 */
export async function requireAuth() {
  const user = await getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  return user
}

/**
 * Check if user is authenticated
 * Server-side only
 */
export async function isAuthenticated() {
  try {
    const user = await getUser()
    return !!user
  } catch {
    return false
  }
}
