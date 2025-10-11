import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/api/rate-limit';
import { logAction } from '@/lib/audit/logger';
import { AuditAction, AuditResource } from '@/types/audit';
import { APIError, createErrorResponse, createSuccessResponse } from '@/lib/api/error-handler';
import { logger } from '@/lib/debug/logger';
import { getAPIVersion } from '@/lib/api/versioning';

// Types
export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    roles: string[];
    firmId?: string;
    subscriptionTier: string;
  };
  correlationId?: string;
  startTime?: number;
}

export interface APIContext {
  user: NonNullable<AuthenticatedRequest['user']>;
  correlationId: string;
  version: string;
  req: NextRequest;
}

export interface RouteConfig {
  auth?: boolean;
  roles?: string[];
  rateLimit?: {
    requests: number;
    window: number;
  };
  validation?: {
    body?: z.ZodSchema;
    query?: z.ZodSchema;
    params?: z.ZodSchema;
  };
  audit?: {
    action: AuditAction;
    resource: AuditResource;
  };
}

// Middleware composition utility
export function withMiddleware(
  handler: (req: NextRequest, context: APIContext) => Promise<NextResponse>,
  config: RouteConfig = {}
) {
  return async (req: NextRequest, { params }: { params?: Promise<any> } = {}) => {
    const startTime = Date.now();
    const correlationId = crypto.randomUUID();
    const version = getAPIVersion(req);

    try {
      // Add correlation ID to request
      (req as AuthenticatedRequest).correlationId = correlationId;
      (req as AuthenticatedRequest).startTime = startTime;

      // Rate limiting
      if (config.rateLimit) {
        const rateLimitResult = await rateLimit(req, config.rateLimit);
        if (!rateLimitResult.success) {
          return createErrorResponse(
            'Rate limit exceeded',
            429,
            'RATE_LIMIT_EXCEEDED',
            { resetTime: rateLimitResult.resetTime },
            version
          );
        }
      }

      // Authentication
      let user: NonNullable<AuthenticatedRequest['user']> | null = null;
      if (config.auth !== false) {
        const authResult = await authenticateRequest(req);
        if (!authResult.success) {
          return createErrorResponse(
            authResult.error || 'Authentication required',
            401,
            'UNAUTHORIZED',
            undefined,
            version
          );
        }
        user = authResult.user!;
        (req as AuthenticatedRequest).user = user;
      }

      // Role-based authorization
      if (config.roles && user) {
        const hasRequiredRole = config.roles.some(role => user.roles.includes(role));
        if (!hasRequiredRole) {
          return createErrorResponse(
            'Insufficient permissions',
            403,
            'FORBIDDEN',
            { requiredRoles: config.roles },
            version
          );
        }
      }

      // Request validation
      if (config.validation) {
        const validationResult = await validateRequest(req, params, config.validation);
        if (!validationResult.success) {
          return createErrorResponse(
            'Validation failed',
            400,
            'VALIDATION_ERROR',
            validationResult.errors,
            version
          );
        }
      }

      // Create context
      const context: APIContext = {
        user: user!,
        correlationId,
        version,
        req
      };

      // Execute handler
      const response = await handler(req, context);

      // Audit logging
      if (config.audit && user) {
        await logAction({
          userId: user.id,
          action: config.audit.action,
          resource: config.audit.resource,
          metadata: {
            correlationId,
            method: req.method,
            path: req.url,
            statusCode: response.status,
            duration: Date.now() - startTime
          }
        });
      }

      // Add response headers
      response.headers.set('X-Correlation-ID', correlationId);
      response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`);
      response.headers.set('X-API-Version', version);

      return response;

    } catch (error) {
      logger.error('API middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId,
        path: req.url,
        method: req.method
      });

      return createErrorResponse(
        'Internal server error',
        500,
        'INTERNAL_ERROR',
        { correlationId },
        version
      );
    }
  };
}

// Authentication helper
async function authenticateRequest(req: NextRequest): Promise<{
  success: boolean;
  user?: NonNullable<AuthenticatedRequest['user']>;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return { success: false, error: 'Invalid or expired token' };
    }

    // Get user profile with roles and subscription info
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, roles, firmId:firm_id, subscriptionTier:subscription_tier')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return { success: false, error: 'User profile not found' };
    }

    return {
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        roles: profile.roles || ['user'],
        firmId: profile.firmId,
        subscriptionTier: profile.subscriptionTier || 'free'
      }
    };
  } catch (error) {
    return { success: false, error: 'Authentication failed' };
  }
}

// Request validation helper
async function validateRequest(
  req: NextRequest,
  params: any,
  validation: NonNullable<RouteConfig['validation']>
): Promise<{
  success: boolean;
  errors?: any[];
}> {
  const errors: any[] = [];

  try {
    // Validate body
    if (validation.body && req.method !== 'GET') {
      const body = await req.json();
      const result = validation.body.safeParse(body);
      if (!result.success) {
        errors.push({
          type: 'body',
          errors: result.error.errors
        });
      }
    }

    // Validate query parameters
    if (validation.query) {
      const url = new URL(req.url);
      const queryParams = Object.fromEntries(url.searchParams.entries());
      const result = validation.query.safeParse(queryParams);
      if (!result.success) {
        errors.push({
          type: 'query',
          errors: result.error.errors
        });
      }
    }

    // Validate path parameters
    if (validation.params && params) {
      const resolvedParams = await params;
      const result = validation.params.safeParse(resolvedParams);
      if (!result.success) {
        errors.push({
          type: 'params',
          errors: result.error.errors
        });
      }
    }

    return {
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    return {
      success: false,
      errors: [{ type: 'body', message: 'Invalid JSON in request body' }]
    };
  }
}

// CORS middleware
export function withCORS(handler: Function) {
  return async (req: NextRequest, ...args: any[]) => {
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const response = await handler(req, ...args);

    // Add CORS headers to response
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

    return response;
  };
}

// Subscription tier middleware
export function requireSubscriptionTier(minimumTier: string) {
  const tierHierarchy = ['free', 'starter', 'professional', 'enterprise'];
  const requiredIndex = tierHierarchy.indexOf(minimumTier);

  return (req: AuthenticatedRequest): boolean => {
    if (!req.user) return false;

    const userTierIndex = tierHierarchy.indexOf(req.user.subscriptionTier);
    return userTierIndex >= requiredIndex;
  };
}

// Input sanitization
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return input.trim().replace(/[<>]/g, '');
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }

  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }

  return input;
}

// Request logging middleware
export function withRequestLogging(handler: Function) {
  return async (req: NextRequest, ...args: any[]) => {
    const start = Date.now();
    const correlationId = crypto.randomUUID();

    logger.info('API Request', {
      correlationId,
      method: req.method,
      url: req.url,
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
    });

    try {
      const response = await handler(req, ...args);

      logger.info('API Response', {
        correlationId,
        method: req.method,
        url: req.url,
        status: response.status,
        duration: Date.now() - start
      });

      return response;
    } catch (error) {
      logger.error('API Error', {
        correlationId,
        method: req.method,
        url: req.url,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - start
      });

      throw error;
    }
  };
}