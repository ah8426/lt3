import { createServiceClient } from '@/lib/supabase/server';
import { AuditAction, AuditResource, AuditLog } from '@/types/audit';
import { headers } from 'next/headers';

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
 * Flush the log queue to the database
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
    const supabase = await createServiceClient();

    // Prepare logs for insertion
    const logsToInsert = await Promise.all(
      logsToFlush.map(async (log) => ({
        user_id: log.userId,
        action: log.action,
        resource: log.resource,
        resource_id: log.resourceId,
        metadata: log.metadata,
        ip_address: await getIpAddress(),
        user_agent: await getUserAgent(),
        location: await getLocation(),
        retention_until: log.retentionUntil?.toISOString(),
      }))
    );

    const { error } = await supabase.from('audit_logs').insert(logsToInsert);

    if (error) {
      console.error('Failed to insert audit logs:', error);
      // Re-queue failed logs
      logQueue.push(...logsToFlush);
    }
  } catch (error) {
    console.error('Error flushing audit logs:', error);
    // Re-queue failed logs
    logQueue.push(...logsToFlush);
  }
}

/**
 * Schedule a flush of the log queue
 */
function scheduleFlu() {
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
    scheduleFlu();
  }
}

/**
 * Immediately log an action without batching
 * Use this for critical actions that should be logged immediately
 */
export async function logActionImmediate(params: LogActionParams): Promise<void> {
  try {
    const supabase = await createServiceClient();

    const { error } = await supabase.from('audit_logs').insert({
      user_id: params.userId,
      action: params.action,
      resource: params.resource,
      resource_id: params.resourceId,
      metadata: params.metadata,
      ip_address: await getIpAddress(),
      user_agent: await getUserAgent(),
      location: await getLocation(),
      retention_until: params.retentionUntil?.toISOString(),
    });

    if (error) {
      console.error('Failed to insert audit log:', error);
    }
  } catch (error) {
    console.error('Error logging audit action:', error);
  }
}

/**
 * Clean up old audit logs based on retention policy
 * Should be called periodically (e.g., daily via cron job)
 */
export async function cleanupOldLogs(retentionDays: number = 90): Promise<void> {
  try {
    const supabase = await createServiceClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Delete logs older than retention period, but never delete logs with retention_until set
    const { error } = await supabase
      .from('audit_logs')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .is('retention_until', null);

    if (error) {
      console.error('Failed to cleanup old audit logs:', error);
    }
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
