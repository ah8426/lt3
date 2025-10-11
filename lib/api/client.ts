import { DEFAULT_API_VERSION, type APIVersion } from './versioning';

/**
 * Configuration for API client
 */
interface APIClientConfig {
  version?: APIVersion;
  baseURL?: string;
  headers?: Record<string, string>;
}

/**
 * Default configuration
 */
const defaultConfig: APIClientConfig = {
  version: DEFAULT_API_VERSION,
  baseURL: '',
  headers: {},
};

/**
 * Global API client configuration
 */
let globalConfig: APIClientConfig = { ...defaultConfig };

/**
 * Configure the API client globally
 */
export function configureAPIClient(config: Partial<APIClientConfig>): void {
  globalConfig = {
    ...globalConfig,
    ...config,
  };
}

/**
 * Get the current API client configuration
 */
export function getAPIClientConfig(): APIClientConfig {
  return { ...globalConfig };
}

/**
 * Convert a path to a versioned API URL
 * Examples:
 *   apiUrl('/sessions') -> '/api/v1/sessions'
 *   apiUrl('/api/sessions') -> '/api/v1/sessions'
 *   apiUrl('/api/v1/sessions') -> '/api/v1/sessions' (no change)
 */
export function apiUrl(path: string, version?: APIVersion): string {
  const targetVersion = version || globalConfig.version || DEFAULT_API_VERSION;

  // Remove leading slash
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // If already versioned, return as-is
  if (/^api\/v\d+\//.test(cleanPath)) {
    return `/${cleanPath}`;
  }

  // Remove 'api/' prefix if present
  const withoutApi = cleanPath.startsWith('api/') ? cleanPath.slice(4) : cleanPath;

  // Build versioned URL
  return `/api/${targetVersion}/${withoutApi}`;
}

/**
 * Create headers for API requests
 */
function createHeaders(customHeaders?: Record<string, string>): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-API-Version': globalConfig.version || DEFAULT_API_VERSION,
    ...globalConfig.headers,
    ...customHeaders,
  };
}

/**
 * Enhanced fetch wrapper with automatic versioning
 */
export async function apiFetch<T = any>(
  path: string,
  options?: RequestInit & { version?: APIVersion }
): Promise<T> {
  const { version, ...fetchOptions } = options || {};
  const url = apiUrl(path, version);

  const response = await fetch(url, {
    ...fetchOptions,
    headers: createHeaders(fetchOptions.headers as Record<string, string>),
  });

  if (!response.ok) {
    const error: any = new Error(`API request failed: ${response.statusText}`);
    error.status = response.status;
    error.response = response;

    try {
      error.data = await response.json();
    } catch {
      // Response body may not be JSON
    }

    throw error;
  }

  return response.json();
}

/**
 * Convenience methods for common HTTP verbs
 */
export const api = {
  /**
   * GET request
   */
  get: <T = any>(path: string, options?: RequestInit & { version?: APIVersion }): Promise<T> => {
    return apiFetch<T>(path, {
      ...options,
      method: 'GET',
    });
  },

  /**
   * POST request
   */
  post: <T = any>(
    path: string,
    data?: any,
    options?: RequestInit & { version?: APIVersion }
  ): Promise<T> => {
    return apiFetch<T>(path, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  /**
   * PUT request
   */
  put: <T = any>(
    path: string,
    data?: any,
    options?: RequestInit & { version?: APIVersion }
  ): Promise<T> => {
    return apiFetch<T>(path, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  /**
   * PATCH request
   */
  patch: <T = any>(
    path: string,
    data?: any,
    options?: RequestInit & { version?: APIVersion }
  ): Promise<T> => {
    return apiFetch<T>(path, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  /**
   * DELETE request
   */
  delete: <T = any>(path: string, options?: RequestInit & { version?: APIVersion }): Promise<T> => {
    return apiFetch<T>(path, {
      ...options,
      method: 'DELETE',
    });
  },
};

/**
 * Type-safe API client factory
 * Use this to create typed API clients for specific resources
 *
 * Example:
 * ```typescript
 * interface Session {
 *   id: string;
 *   title: string;
 * }
 *
 * const sessionsAPI = createAPIClient<Session>('/sessions');
 *
 * const sessions = await sessionsAPI.list();
 * const session = await sessionsAPI.get('session-id');
 * const newSession = await sessionsAPI.create({ title: 'New Session' });
 * ```
 */
export function createAPIClient<T = any>(basePath: string, version?: APIVersion) {
  const versionedPath = (path: string = '') => {
    const fullPath = path ? `${basePath}/${path}` : basePath;
    return apiUrl(fullPath, version);
  };

  return {
    /**
     * List all resources
     */
    list: (params?: Record<string, any>): Promise<{ data: T[]; total?: number }> => {
      const searchParams = params ? `?${new URLSearchParams(params).toString()}` : '';
      return apiFetch(versionedPath() + searchParams, { version });
    },

    /**
     * Get a single resource by ID
     */
    get: (id: string): Promise<T> => {
      return apiFetch(versionedPath(id), { version });
    },

    /**
     * Create a new resource
     */
    create: (data: Partial<T>): Promise<T> => {
      return apiFetch(versionedPath(), {
        method: 'POST',
        body: JSON.stringify(data),
        version,
      });
    },

    /**
     * Update a resource
     */
    update: (id: string, data: Partial<T>): Promise<T> => {
      return apiFetch(versionedPath(id), {
        method: 'PATCH',
        body: JSON.stringify(data),
        version,
      });
    },

    /**
     * Delete a resource
     */
    delete: (id: string): Promise<void> => {
      return apiFetch(versionedPath(id), {
        method: 'DELETE',
        version,
      });
    },

    /**
     * Custom request to the resource
     */
    request: <R = any>(path: string = '', options?: RequestInit): Promise<R> => {
      return apiFetch(versionedPath(path), { ...options, version });
    },
  };
}

/**
 * Error handler helper
 */
export function isAPIError(error: any): error is Error & {
  status: number;
  response: Response;
  data?: any;
} {
  return error instanceof Error && 'status' in error && 'response' in error;
}

/**
 * Extract error message from API error
 */
export function getAPIErrorMessage(error: any): string {
  if (isAPIError(error)) {
    return error.data?.error || error.data?.message || error.message;
  }
  return error instanceof Error ? error.message : 'An unknown error occurred';
}
