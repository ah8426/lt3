import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createVersionRedirect } from '@/lib/api/versioning'

export async function middleware(request: NextRequest) {
  // Handle API versioning redirects first
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const versionRedirect = createVersionRedirect(request);
    if (versionRedirect) {
      return versionRedirect;
    }
  }

  // Handle authentication
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     * - api (API routes - handle auth separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
