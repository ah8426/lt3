import { NextRequest, NextResponse } from 'next/server';

/**
 * Supported API versions
 */
export const API_VERSIONS = ['v1'] as const;
export type APIVersion = typeof API_VERSIONS[number];

/**
 * Default API version
 */
export const DEFAULT_API_VERSION: APIVersion = 'v1';

/**
 * Get the API version from the request
 * Checks:
 * 1. URL path (/api/v1/...)
 * 2. X-API-Version header
 * 3. Falls back to default version
 */
export function getAPIVersion(request: NextRequest): APIVersion {
  // Check URL path first
  const pathMatch = request.nextUrl.pathname.match(/^\/api\/(v\d+)\//);
  if (pathMatch && API_VERSIONS.includes(pathMatch[1] as APIVersion)) {
    return pathMatch[1] as APIVersion;
  }

  // Check X-API-Version header
  const headerVersion = request.headers.get('X-API-Version');
  if (headerVersion && API_VERSIONS.includes(headerVersion as APIVersion)) {
    return headerVersion as APIVersion;
  }

  // Default version
  return DEFAULT_API_VERSION;
}

/**
 * Validate if the requested API version is supported
 */
export function isVersionSupported(version: string): boolean {
  return API_VERSIONS.includes(version as APIVersion);
}

/**
 * Higher-order function to add versioning support to route handlers
 * Returns 400 if the version is not supported
 */
export function withVersioning<T extends any[]>(
  handler: (request: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const version = getAPIVersion(request);

    if (!isVersionSupported(version)) {
      return NextResponse.json(
        {
          error: `API version '${version}' is not supported`,
          supportedVersions: API_VERSIONS,
          message: `Please use one of the supported API versions: ${API_VERSIONS.join(', ')}`,
        },
        {
          status: 400,
          headers: {
            'X-API-Supported-Versions': API_VERSIONS.join(', '),
          },
        }
      );
    }

    // Add version to response headers for debugging
    const response = await handler(request, ...args);
    response.headers.set('X-API-Version', version);

    return response;
  };
}

/**
 * Add API version headers to response
 */
export function addVersionHeaders(response: NextResponse, version: APIVersion = DEFAULT_API_VERSION): NextResponse {
  response.headers.set('X-API-Version', version);
  response.headers.set('X-API-Supported-Versions', API_VERSIONS.join(', '));
  return response;
}

/**
 * Create a deprecation warning header for old API versions
 */
export function addDeprecationWarning(
  response: NextResponse,
  version: APIVersion,
  deprecationDate: Date,
  sunsetDate: Date
): NextResponse {
  response.headers.set('Deprecation', deprecationDate.toUTCString());
  response.headers.set('Sunset', sunsetDate.toUTCString());
  response.headers.set(
    'Link',
    `</api/${version}/docs>; rel="deprecation"; type="text/html"`
  );
  response.headers.set(
    'Warning',
    `299 - "API version ${version} is deprecated and will be removed on ${sunsetDate.toISOString().split('T')[0]}"`
  );
  return response;
}

/**
 * Get the full versioned API path
 */
export function versionedPath(path: string, version: APIVersion = DEFAULT_API_VERSION): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // Remove /api/ prefix if present
  const withoutApi = cleanPath.startsWith('api/') ? cleanPath.slice(4) : cleanPath;

  // Remove existing version if present
  const withoutVersion = withoutApi.replace(/^v\d+\//, '');

  return `/api/${version}/${withoutVersion}`;
}

/**
 * Redirect old API endpoints to versioned ones
 * Use this in middleware for backward compatibility
 */
export function createVersionRedirect(
  request: NextRequest,
  targetVersion: APIVersion = DEFAULT_API_VERSION
): NextResponse | null {
  const pathname = request.nextUrl.pathname;

  // Don't redirect if already versioned
  if (/^\/api\/v\d+\//.test(pathname)) {
    return null;
  }

  // Don't redirect auth, cron, or system endpoints
  if (
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/cron/') ||
    pathname === '/api/health'
  ) {
    return null;
  }

  // Create redirect URL
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = versionedPath(pathname, targetVersion);

  // 308 Permanent Redirect (preserves method and body)
  return NextResponse.redirect(redirectUrl, {
    status: 308,
    headers: {
      'X-API-Redirect': 'true',
      'X-API-Redirected-From': pathname,
      'X-API-Redirected-To': redirectUrl.pathname,
    },
  });
}

/**
 * Version comparison utilities
 */
export const versionUtils = {
  /**
   * Compare two API versions
   * Returns: -1 if a < b, 0 if a === b, 1 if a > b
   */
  compare(a: string, b: string): number {
    const aNum = parseInt(a.replace('v', ''), 10);
    const bNum = parseInt(b.replace('v', ''), 10);
    return aNum - bNum;
  },

  /**
   * Check if version A is newer than version B
   */
  isNewer(a: string, b: string): boolean {
    return this.compare(a, b) > 0;
  },

  /**
   * Check if version A is older than version B
   */
  isOlder(a: string, b: string): boolean {
    return this.compare(a, b) < 0;
  },

  /**
   * Get the latest API version
   */
  getLatest(): APIVersion {
    return API_VERSIONS[API_VERSIONS.length - 1];
  },

  /**
   * Check if a version is the latest
   */
  isLatest(version: string): boolean {
    return version === this.getLatest();
  },
};
