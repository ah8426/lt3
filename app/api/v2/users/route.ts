import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withMiddleware, APIContext } from '@/lib/api/middleware';
import { withCORS } from '@/lib/api/middleware';
import { createSuccessResponse, createErrorResponse, handleAPIError } from '@/lib/api/error-handler';
import { CreateUserSchema, UpdateUserSchema, UserQuerySchema } from '@/lib/api/schemas';
import { AuditAction, AuditResource } from '@/types/audit';
import { prisma } from '@/lib/prisma';
import { RATE_LIMITS } from '@/lib/api/rate-limit';

export const runtime = 'nodejs';

/**
 * GET /api/v2/users
 * List users with pagination, filtering, and search
 */
export const GET = withCORS(withMiddleware(
  async (req: NextRequest, context: APIContext) => {
    try {
      const url = new URL(req.url);
      const queryParams = Object.fromEntries(url.searchParams.entries());
      const { page, limit, orderBy, orderDir, search, role, subscriptionTier, firmId } =
        UserQuerySchema.parse(queryParams);

      // Build where clause
      const where: any = {};

      // Filter by search (name or email)
      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { fullName: { contains: search, mode: 'insensitive' } }
        ];
      }

      // Filter by role
      if (role) {
        where.roles = { has: role };
      }

      // Filter by subscription tier
      if (subscriptionTier) {
        where.subscriptionTier = subscriptionTier;
      }

      // Filter by firm (admin users only)
      if (firmId) {
        if (!context.user.roles.includes('admin') && context.user.firmId !== firmId) {
          return createErrorResponse(
            'Forbidden: Cannot access users from other firms',
            403,
            'FORBIDDEN',
            undefined,
            context.version
          );
        }
        where.firmId = firmId;
      } else if (!context.user.roles.includes('admin')) {
        // Non-admin users can only see users from their own firm
        where.firmId = context.user.firmId;
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Build order by
      const orderByClause: any = {};
      if (orderBy) {
        orderByClause[orderBy] = orderDir;
      } else {
        orderByClause.createdAt = orderDir;
      }

      // Execute query with pagination
      const [users, totalCount] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            fullName: true,
            avatarUrl: true,
            roles: true,
            firmId: true,
            subscriptionTier: true,
            subscriptionStatus: true,
            lastLoginAt: true,
            createdAt: true,
            updatedAt: true,
            // Include aggregated data
            _count: {
              select: {
                sessions: true,
                matters: true
              }
            }
          },
          skip,
          take: limit,
          orderBy: orderByClause
        }),
        prisma.user.count({ where })
      ]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return createSuccessResponse(
        users,
        `Retrieved ${users.length} users`,
        context.version,
        {
          totalCount,
          page,
          limit,
          totalPages,
          hasNextPage,
          hasPreviousPage
        }
      );

    } catch (error) {
      return handleAPIError(error, context.version);
    }
  },
  {
    auth: true,
    roles: ['admin', 'manager'],
    rateLimit: RATE_LIMITS.default,
    validation: {
      query: UserQuerySchema
    },
    audit: {
      action: AuditAction.USER_LIST,
      resource: AuditResource.USER
    }
  }
));

/**
 * POST /api/v2/users
 * Create a new user
 */
export const POST = withCORS(withMiddleware(
  async (req: NextRequest, context: APIContext) => {
    try {
      const body = await req.json();
      const userData = CreateUserSchema.parse(body);

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (existingUser) {
        return createErrorResponse(
          'User with this email already exists',
          409,
          'USER_EXISTS',
          undefined,
          context.version
        );
      }

      // Check permissions for creating users in different firms
      if (userData.firmId && !context.user.roles.includes('admin')) {
        if (context.user.firmId !== userData.firmId) {
          return createErrorResponse(
            'Forbidden: Cannot create users for other firms',
            403,
            'FORBIDDEN',
            undefined,
            context.version
          );
        }
      }

      // Create user
      const user = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: userData.email,
          fullName: userData.fullName,
          roles: userData.roles,
          firmId: userData.firmId || context.user.firmId,
          subscriptionTier: userData.subscriptionTier,
          subscriptionStatus: 'active',
          settings: {}
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          roles: true,
          firmId: true,
          subscriptionTier: true,
          subscriptionStatus: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return createSuccessResponse(
        user,
        'User created successfully',
        context.version
      );

    } catch (error) {
      return handleAPIError(error, context.version);
    }
  },
  {
    auth: true,
    roles: ['admin', 'manager'],
    rateLimit: RATE_LIMITS.default,
    validation: {
      body: CreateUserSchema
    },
    audit: {
      action: AuditAction.USER_CREATE,
      resource: AuditResource.USER
    }
  }
));