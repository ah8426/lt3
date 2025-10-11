import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';
import { lt3Profiler } from './profiler';
import { lt3Tracing } from './tracing';

/**
 * Production-Safe Debugging System for Law Transcribed
 * Provides controlled debugging capabilities in production environments
 */
export class ProductionDebugger {
  private enabled: boolean;
  private authToken: string | null;
  private allowedIPs: string[];
  private allowedUsers: string[];
  private debugSessions: Map<string, DebugSession> = new Map();
  private maxSessions = 5;

  constructor() {
    this.enabled = process.env.PRODUCTION_DEBUG === 'true';
    this.authToken = process.env.DEBUG_AUTH_TOKEN || null;
    this.allowedIPs = (process.env.DEBUG_ALLOWED_IPS || '').split(',').filter(Boolean);
    this.allowedUsers = (process.env.DEBUG_ALLOWED_USERS || '').split(',').filter(Boolean);

    if (this.enabled) {
      logger.info('Production debugger enabled', {
        maxSessions: this.maxSessions,
        hasAuthToken: !!this.authToken,
        allowedIPs: this.allowedIPs.length,
        allowedUsers: this.allowedUsers.length,
      });
    }
  }

  /**
   * Middleware for enabling debug mode on specific requests
   */
  middleware() {
    return (req: NextRequest, res: NextResponse, next: Function) => {
      if (!this.enabled) {
        return next();
      }

      // Check debug authorization
      const isAuthorized = this.isAuthorized(req);
      if (!isAuthorized) {
        return next();
      }

      // Create debug session
      const sessionId = this.createDebugSession(req);
      if (!sessionId) {
        logger.warn('Max debug sessions reached, request not debugged', {
          activeSessions: this.debugSessions.size,
          maxSessions: this.maxSessions,
        });
        return next();
      }

      // Enable debug mode for this request
      this.enableDebugMode(req, sessionId);

      // Set debug headers
      res.setHeader('X-Debug-Enabled', 'true');
      res.setHeader('X-Debug-Session', sessionId);

      // Cleanup on response finish
      res.on('finish', () => {
        this.cleanupDebugSession(sessionId);
      });

      logger.info('Debug mode enabled for request', {
        sessionId,
        path: req.url,
        method: req.method,
      });

      next();
    };
  }

  /**
   * Check if request is authorized for debugging
   */
  private isAuthorized(req: NextRequest): boolean {
    // Check debug token
    const token = req.headers.get('x-debug-token');
    if (this.authToken && token !== this.authToken) {
      return false;
    }

    // Check IP whitelist
    const clientIP = this.getClientIP(req);
    if (this.allowedIPs.length > 0 && !this.allowedIPs.includes(clientIP)) {
      logger.warn('Debug request from unauthorized IP', { clientIP });
      return false;
    }

    // Check user whitelist (if user info available)
    const userId = req.headers.get('x-user-id');
    if (this.allowedUsers.length > 0 && userId && !this.allowedUsers.includes(userId)) {
      logger.warn('Debug request from unauthorized user', { userId });
      return false;
    }

    return true;
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: NextRequest): string {
    return (
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('x-real-ip') ||
      req.ip ||
      'unknown'
    );
  }

  /**
   * Create a new debug session
   */
  private createDebugSession(req: NextRequest): string | null {
    if (this.debugSessions.size >= this.maxSessions) {
      return null;
    }

    const sessionId = `debug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const session: DebugSession = {
      id: sessionId,
      startTime: Date.now(),
      requestInfo: {
        method: req.method || 'UNKNOWN',
        url: req.url || '',
        userAgent: req.headers.get('user-agent') || 'unknown',
        clientIP: this.getClientIP(req),
      },
      logs: [],
      traces: [],
      metrics: {
        startMemory: process.memoryUsage(),
        startTime: process.hrtime.bigint(),
      },
    };

    this.debugSessions.set(sessionId, session);
    return sessionId;
  }

  /**
   * Enable debug mode for a request
   */
  private enableDebugMode(req: any, sessionId: string): void {
    const session = this.debugSessions.get(sessionId);
    if (!session) return;

    // Add debug context to request
    req.debugMode = true;
    req.debugSessionId = sessionId;

    // Override console methods for this request context
    const originalConsole = { ...console };

    ['log', 'debug', 'info', 'warn', 'error'].forEach(level => {
      console[level] = (...args: any[]) => {
        // Call original method
        originalConsole[level](...args);

        // Store in debug session
        if (session) {
          session.logs.push({
            level,
            message: args[0]?.toString() || '',
            args: args.slice(1),
            timestamp: Date.now(),
            stack: level === 'error' ? new Error().stack : undefined,
          });

          // Limit log entries per session
          if (session.logs.length > 1000) {
            session.logs = session.logs.slice(-500); // Keep last 500
          }
        }
      };
    });

    // Add debugging utilities to request
    req.debug = {
      log: (message: string, data?: any) => this.addDebugLog(sessionId, 'debug', message, data),
      trace: (message: string, data?: any) => this.addDebugTrace(sessionId, message, data),
      metric: (name: string, value: number) => this.addDebugMetric(sessionId, name, value),
      breakpoint: (condition?: () => boolean) => this.conditionalBreakpoint(sessionId, condition),
    };

    // Restore console on cleanup
    req.debugCleanup = () => {
      Object.assign(console, originalConsole);
    };
  }

  /**
   * Add debug log entry
   */
  private addDebugLog(sessionId: string, level: string, message: string, data?: any): void {
    const session = this.debugSessions.get(sessionId);
    if (!session) return;

    session.logs.push({
      level,
      message,
      args: data ? [data] : [],
      timestamp: Date.now(),
    });
  }

  /**
   * Add debug trace entry
   */
  private addDebugTrace(sessionId: string, message: string, data?: any): void {
    const session = this.debugSessions.get(sessionId);
    if (!session) return;

    const traceId = lt3Tracing.getCurrentTraceId();

    session.traces.push({
      message,
      data,
      traceId,
      timestamp: Date.now(),
      stack: new Error().stack?.split('\n').slice(2, 6), // Relevant stack frames
    });
  }

  /**
   * Add debug metric
   */
  private addDebugMetric(sessionId: string, name: string, value: number): void {
    const session = this.debugSessions.get(sessionId);
    if (!session) return;

    if (!session.customMetrics) {
      session.customMetrics = [];
    }

    session.customMetrics.push({
      name,
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Conditional breakpoint for production
   */
  private conditionalBreakpoint(sessionId: string, condition?: () => boolean): void {
    if (condition && !condition()) {
      return;
    }

    const session = this.debugSessions.get(sessionId);
    if (!session) return;

    // In production, we log instead of actually breaking
    logger.warn('Conditional breakpoint hit', {
      sessionId,
      timestamp: Date.now(),
      stack: new Error().stack,
      memory: process.memoryUsage(),
    });

    // Take heap snapshot if enabled
    if (process.env.DEBUG_AUTO_SNAPSHOT === 'true') {
      lt3Profiler.takeHeapSnapshot(`breakpoint-${sessionId}`).catch((error) => {
        logger.error('Failed to take breakpoint snapshot', { error: error.message });
      });
    }

    // Add to session traces
    this.addDebugTrace(sessionId, 'Conditional breakpoint hit', {
      condition: condition?.toString(),
      memory: process.memoryUsage(),
    });
  }

  /**
   * Cleanup debug session
   */
  private cleanupDebugSession(sessionId: string): void {
    const session = this.debugSessions.get(sessionId);
    if (!session) return;

    // Calculate session metrics
    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    const duration = endTime - session.startTime;

    const sessionSummary = {
      sessionId,
      duration,
      requestInfo: session.requestInfo,
      logCount: session.logs.length,
      traceCount: session.traces.length,
      memoryDelta: {
        rss: endMemory.rss - session.metrics.startMemory.rss,
        heapUsed: endMemory.heapUsed - session.metrics.startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - session.metrics.startMemory.heapTotal,
      },
      customMetrics: session.customMetrics || [],
    };

    // Log session summary
    logger.info('Debug session completed', sessionSummary);

    // Export session data if requested
    if (process.env.DEBUG_EXPORT_SESSIONS === 'true') {
      this.exportDebugSession(session, sessionSummary);
    }

    // Remove session
    this.debugSessions.delete(sessionId);
  }

  /**
   * Export debug session data
   */
  private async exportDebugSession(session: DebugSession, summary: any): Promise<void> {
    try {
      const fs = require('fs').promises;
      const path = require('path');

      const exportDir = './debug/sessions';
      await fs.mkdir(exportDir, { recursive: true });

      const exportData = {
        session,
        summary,
        exportedAt: new Date().toISOString(),
      };

      const fileName = `debug-session-${session.id}.json`;
      const filePath = path.join(exportDir, fileName);

      await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));

      logger.debug('Debug session exported', { filePath });
    } catch (error) {
      logger.error('Failed to export debug session', { error: (error as Error).message });
    }
  }

  /**
   * Get current debug sessions info
   */
  getDebugInfo(): any {
    return {
      enabled: this.enabled,
      activeSessions: this.debugSessions.size,
      maxSessions: this.maxSessions,
      sessions: Array.from(this.debugSessions.values()).map(session => ({
        id: session.id,
        startTime: session.startTime,
        duration: Date.now() - session.startTime,
        requestInfo: session.requestInfo,
        logCount: session.logs.length,
        traceCount: session.traces.length,
      })),
    };
  }

  /**
   * Emergency disable of debug mode
   */
  emergencyDisable(): void {
    this.enabled = false;
    this.debugSessions.clear();
    logger.warn('Production debugger emergency disabled');
  }
}

// Debug session interfaces
interface DebugSession {
  id: string;
  startTime: number;
  requestInfo: {
    method: string;
    url: string;
    userAgent: string;
    clientIP: string;
  };
  logs: DebugLog[];
  traces: DebugTrace[];
  metrics: {
    startMemory: NodeJS.MemoryUsage;
    startTime: bigint;
  };
  customMetrics?: DebugMetric[];
}

interface DebugLog {
  level: string;
  message: string;
  args: any[];
  timestamp: number;
  stack?: string;
}

interface DebugTrace {
  message: string;
  data?: any;
  traceId?: string;
  timestamp: number;
  stack?: string[];
}

interface DebugMetric {
  name: string;
  value: number;
  timestamp: number;
}

// Global production debugger instance
export const productionDebugger = new ProductionDebugger();

/**
 * Express/Next.js middleware for production debugging
 */
export function withProductionDebug(handler: Function) {
  return async (req: any, res: any, ...args: any[]) => {
    if (!productionDebugger['enabled']) {
      return handler(req, res, ...args);
    }

    // Apply debug middleware
    return new Promise((resolve, reject) => {
      productionDebugger.middleware()(req, res, () => {
        Promise.resolve(handler(req, res, ...args))
          .then(resolve)
          .catch(reject)
          .finally(() => {
            // Cleanup debug mode
            if (req.debugCleanup) {
              req.debugCleanup();
            }
          });
      });
    });
  };
}

export default productionDebugger;