import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          supabaseResponse = NextResponse.next({
            request,
          })
          supabaseResponse.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          supabaseResponse = NextResponse.next({
            request,
          })
          supabaseResponse.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // Refresh session if needed
  await supabase.auth.getSession()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes
  const protectedPaths = ['/dashboard', '/dictation', '/matters', '/sessions', '/settings']
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  // Auth routes (login, signup)
  const authPaths = ['/login', '/signup']
  const isAuthPath = authPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  // Redirect loop detection - check for redirect header to prevent infinite loops
  const redirectCount = parseInt(request.headers.get('x-redirect-count') || '0', 10)
  const MAX_REDIRECTS = 3

  if (redirectCount >= MAX_REDIRECTS) {
    // Too many redirects, allow request to proceed to prevent infinite loop
    console.error(`Redirect loop detected for path: ${request.nextUrl.pathname}`)
    return supabaseResponse
  }

  // Redirect logic
  if (isProtectedPath && !user) {
    // Redirect to login if trying to access protected route without authentication
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', request.nextUrl.pathname)

    const redirectResponse = NextResponse.redirect(url)
    redirectResponse.headers.set('x-redirect-count', String(redirectCount + 1))

    // Copy cookies from supabaseResponse to maintain session
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })

    return redirectResponse
  }

  if (isAuthPath && user) {
    // Redirect to dashboard if already authenticated and trying to access auth pages
    const url = request.nextUrl.clone()

    // Check for redirectTo parameter
    const redirectTo = request.nextUrl.searchParams.get('redirectTo')
    if (redirectTo && !authPaths.some(path => redirectTo.startsWith(path))) {
      // Redirect to the original destination if valid
      url.pathname = redirectTo
      url.searchParams.delete('redirectTo')
    } else {
      url.pathname = '/dashboard'
    }

    const redirectResponse = NextResponse.redirect(url)
    redirectResponse.headers.set('x-redirect-count', String(redirectCount + 1))

    // Copy cookies from supabaseResponse to maintain session
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })

    return redirectResponse
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}
