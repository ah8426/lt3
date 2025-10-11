import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withMiddleware, APIContext } from '@/lib/api/middleware';
import { withCORS } from '@/lib/api/middleware';
import { createSuccessResponse, createErrorResponse, handleAPIError } from '@/lib/api/error-handler';
import { UpdateUserSchema, UuidSchema } from '@/lib/api/schemas';
import { AuditAction, AuditResource } from '@/types/audit';
import { prisma } from '@/lib/prisma';
import { RATE_LIMITS } from '@/lib/api/rate-limit';

export const runtime = 'nodejs';

/**
 * GET /api/v2/users/[id]
 * Get a specific user by ID
 */
export const GET = withCORS(withMiddleware(
  async (req: NextRequest, context: APIContext, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;

      // Check permissions
      if (!context.user.roles.includes('admin') && context.user.id !== id) {
        return createErrorResponse(
          'Forbidden: Can only access your own profile',
          403,
          'FORBIDDEN',
          undefined,
          context.version
        );
      }

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          fullName: true,
          avatarUrl: true,
          roles: true,
          firmId: true,
          subscriptionTier: true,
          subscriptionStatus: true,
          subscriptionEndsAt: true,
          trialEndsAt: true,
          settings: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          // Include aggregated data
          _count: {
            select: {
              sessions: true,
              matters: true,
              auditLogs: true
            }
          },
          // Include recent activity
          sessions: {
            select: {
              id: true,
              title: true,
              status: true,
              createdAt: true,
              durationMs: true
            },
            orderBy: { createdAt: 'desc' },
            take: 5
          }
        }
      });

      if (!user) {
        return createErrorResponse(
          'User not found',
          404,
          'USER_NOT_FOUND',
          undefined,
          context.version
        );
      }

      // Check firm access for non-admin users
      if (!context.user.roles.includes('admin') &&
          context.user.firmId !== user.firmId) {
        return createErrorResponse(
          'Forbidden: Cannot access users from other firms',
          403,
          'FORBIDDEN',
          undefined,
          context.version
        );
      }

      return createSuccessResponse(
        user,
        'User retrieved successfully',
        context.version
      );

    } catch (error) {
      return handleAPIError(error, context.version);
    }
  },
  {
    auth: true,
    rateLimit: RATE_LIMITS.default,
    validation: {
      params: z.object({ id: UuidSchema })
    },
    audit: {
      action: AuditAction.USER_READ,
      resource: AuditResource.USER
    }
  }
));

/**
 * PATCH /api/v2/users/[id]
 * Update a user
 */
export const PATCH = withCORS(withMiddleware(
  async (req: NextRequest, context: APIContext, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;
      const body = await req.json();
      const updates = UpdateUserSchema.parse(body);

      // Check permissions
      const isOwnProfile = context.user.id === id;
      const isAdmin = context.user.roles.includes('admin');
      const isManager = context.user.roles.includes('manager');

      if (!isOwnProfile && !isAdmin && !isManager) {
        return createErrorResponse(
          'Forbidden: Insufficient permissions',
          403,
          'FORBIDDEN',
          undefined,
          context.version
        );
      }

      // Get current user to check constraints
      const currentUser = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          roles: true,
          firmId: true,
          subscriptionTier: true
        }
      });

      if (!currentUser) {
        return createErrorResponse(
          'User not found',
          404,
          'USER_NOT_FOUND',
          undefined,
          context.version
        );
      }

      // Check firm access
      if (!isAdmin && context.user.firmId !== currentUser.firmId) {
        return createErrorResponse(
          'Forbidden: Cannot modify users from other firms',
          403,
          'FORBIDDEN',
          undefined,
          context.version
        );
      }

      // Restrict certain fields based on permissions
      const allowedUpdates: any = {};

      // Own profile updates
      if (isOwnProfile) {
        if (updates.email) allowedUpdates.email = updates.email;
        if (updates.fullName !== undefined) allowedUpdates.fullName = updates.fullName;
        if (updates.settings) allowedUpdates.settings = updates.settings;
      }

      // Manager/Admin updates
      if (isManager || isAdmin) {
        if (updates.roles) {
          // Prevent role escalation
          if (!isAdmin && updates.roles.includes('admin')) {
            return createErrorResponse(
              'Forbidden: Cannot assign admin role',
              403,
              'FORBIDDEN',
              undefined,
              context.version
            );
          }
          allowedUpdates.roles = updates.roles;
        }
        if (updates.subscriptionTier) allowedUpdates.subscriptionTier = updates.subscriptionTier;
      }

      // Admin-only updates
      if (isAdmin) {
        if (updates.firmId) allowedUpdates.firmId = updates.firmId;
      }

      // Check if email is being changed and ensure uniqueness
      if (allowedUpdates.email && allowedUpdates.email !== currentUser.email) {
        const emailExists = await prisma.user.findUnique({
          where: { email: allowedUpdates.email }
        });

        if (emailExists) {
          return createErrorResponse(
            'Email already in use',
            409,
            'EMAIL_EXISTS',
            undefined,
            context.version
          );
        }
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          ...allowedUpdates,
          updatedAt: new Date()
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          avatarUrl: true,
          roles: true,
          firmId: true,
          subscriptionTier: true,
          subscriptionStatus: true,
          settings: true,
          updatedAt: true
        }
      });

      return createSuccessResponse(
        updatedUser,
        'User updated successfully',
        context.version
      );

    } catch (error) {
      return handleAPIError(error, context.version);
    }
  },
  {
    auth: true,
    rateLimit: RATE_LIMITS.default,
    validation: {
      params: z.object({ id: UuidSchema }),
      body: UpdateUserSchema
    },
    audit: {
      action: AuditAction.USER_UPDATE,
      resource: AuditResource.USER
    }
  }
));

/**
 * DELETE /api/v2/users/[id]
 * Delete a user (soft delete by setting inactive)
 */
export const DELETE = withCORS(withMiddleware(
  async (req: NextRequest, context: APIContext, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await params;

      // Only admins can delete users
      if (!context.user.roles.includes('admin')) {
        return createErrorResponse(
          'Forbidden: Only admins can delete users',
          403,
          'FORBIDDEN',
          undefined,
          context.version
        );
      }

      // Cannot delete self
      if (context.user.id === id) {
        return createErrorResponse(
          'Forbidden: Cannot delete your own account',
          403,
          'FORBIDDEN',
          undefined,
          context.version
        );
      }

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          roles: true,
          firmId: true,
          _count: {
            select: {
              sessions: true,
              matters: true
            }
          }
        }
      });

      if (!user) {
        return createErrorResponse(
          'User not found',
          404,
          'USER_NOT_FOUND',
          undefined,
          context.version
        );
      }

      // Check if user has active data
      if (user._count.sessions > 0 || user._count.matters > 0) {
        return createErrorResponse(
          'Cannot delete user with existing sessions or matters. Archive instead.',
          409,
          'USER_HAS_DATA',
          {
            sessionsCount: user._count.sessions,
            mattersCount: user._count.matters
          },
          context.version
        );
      }

      // Soft delete by updating roles and marking inactive
      await prisma.user.update({
        where: { id },
        data: {
          roles: ['inactive'],
          settings: {
            ...((user as any).settings || {}),
            deletedAt: new Date().toISOString(),
            deletedBy: context.user.id
          }
        }
      });

      return createSuccessResponse(
        { id, deleted: true },
        'User deleted successfully',
        context.version
      );

    } catch (error) {
      return handleAPIError(error, context.version);
    }
  },
  {
    auth: true,
    roles: ['admin'],
    rateLimit: RATE_LIMITS.default,
    validation: {
      params: z.object({ id: UuidSchema })
    },
    audit: {
      action: AuditAction.USER_DELETE,
      resource: AuditResource.USER
    }
  }
));