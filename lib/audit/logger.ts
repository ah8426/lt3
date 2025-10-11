import { prisma } from '@/lib/prisma';
import { AuditAction, AuditResource, AuditLog } from '@/types/audit';
import { headers } from 'next/headers';

// Re-export types for convenience
export type { AuditAction, AuditResource, AuditLog } from '@/types/audit';

interface LogActionParams {
  userId: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  metadata?: Record<string, any>;
  retentionUntil?: Date;
}

// Queue for batching logs
let logQueue: LogActionParams[] = [];
let flushTimeout: NodeJS.Timeout | null = null;
const BATCH_SIZE = 10;
const FLUSH_INTERVAL = 5000; // 5 seconds

/**
 * Extract IP address from request headers
 */
async function getIpAddress(): Promise<string | undefined> {
  try {
    const headersList = await headers();
    // Check common headers for IP address
    return (
      headersList.get('x-forwarded-for')?.split(',')[0].trim() ||
      headersList.get('x-real-ip') ||
      headersList.get('cf-connecting-ip') ||
      undefined
    );
  } catch {
    return undefined;
  }
}

/**
 * Extract user agent from request headers
 */
async function getUserAgent(): Promise<string | undefined> {
  try {
    const headersList = await headers();
    return headersList.get('user-agent') || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract approximate location from IP address headers
 * This would typically use a GeoIP service in production
 */
async function getLocation(): Promise<string | undefined> {
  try {
    const headersList = await headers();
    // Check for Cloudflare geolocation headers
    const country = headersList.get('cf-ipcountry');
    if (country && country !== 'XX') {
      return country;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Flush the log queue to the database using Prisma
 */
async function flushLogs() {
  if (logQueue.length === 0) return;

  const logsToFlush = [...logQueue];
  logQueue = [];

  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  try {
    // Prepare logs for insertion
    const logsToInsert = await Promise.all(
      logsToFlush.map(async (log) => ({
        userId: log.userId,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId ?? null,
        metadata: log.metadata ?? {},
        ipAddress: await getIpAddress(),
        userAgent: await getUserAgent(),
        location: await getLocation(),
        retentionUntil: log.retentionUntil ?? null,
      }))
    );

    // Bulk insert using Prisma
    await prisma.auditLog.createMany({
      data: logsToInsert,
    });
  } catch (error) {
    console.error('Error flushing audit logs:', error);
    // Re-queue failed logs
    logQueue.push(...logsToFlush);
  }
}

/**
 * Schedule a flush of the log queue
 */
function scheduleFlush() {
  if (flushTimeout) return;

  flushTimeout = setTimeout(() => {
    flushLogs();
  }, FLUSH_INTERVAL);
}

/**
 * Log an audit action
 * Logs are batched for performance and flushed periodically or when batch size is reached
 */
export async function logAction(params: LogActionParams): Promise<void> {
  logQueue.push(params);

  // Flush immediately if batch size is reached
  if (logQueue.length >= BATCH_SIZE) {
    await flushLogs();
  } else {
    // Schedule a flush
    scheduleFlush();
  }
}

/**
 * Immediately log an action without batching using Prisma
 * Use this for critical actions that should be logged immediately
 */
export async function logActionImmediate(params: LogActionParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId ?? null,
        metadata: params.metadata ?? {},
        ipAddress: await getIpAddress(),
        userAgent: await getUserAgent(),
        location: await getLocation(),
        retentionUntil: params.retentionUntil ?? null,
      },
    });
  } catch (error) {
    console.error('Error logging audit action:', error);
  }
}

/**
 * Clean up old audit logs based on retention policy using Prisma
 * Should be called periodically (e.g., daily via cron job)
 */
export async function cleanupOldLogs(retentionDays: number = 90): Promise<void> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Delete logs older than retention period, but never delete logs with retentionUntil set
    await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        retentionUntil: null,
      },
    });
  } catch (error) {
    console.error('Error cleaning up audit logs:', error);
  }
}

/**
 * Force flush all pending logs
 * Call this on application shutdown
 */
export async function flushPendingLogs(): Promise<void> {
  await flushLogs();
}
