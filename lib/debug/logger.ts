import winston from 'winston';
import { lt3Tracing } from './tracing';

/**
 * Advanced Debug Logger for Law Transcribed
 * Provides structured logging with trace correlation and performance metrics
 */
export class LT3Logger {
  private logger: winston.Logger;
  private service: string;
  private context: Record<string, any> = {};

  constructor(service = 'law-transcribed', options: Partial<LT3LoggerOptions> = {}) {
    this.service = service;
    this.logger = this.createLogger(options);
  }

  private createLogger(options: Partial<LT3LoggerOptions>): winston.Logger {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Create custom format
    const lt3Format = winston.format.printf(({ timestamp, level, message, service, traceId, ...meta }) => {
      const traceInfo = traceId ? `[${traceId.substring(0, 8)}]` : '[no-trace]';
      const metaString = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';

      if (isDevelopment) {
        return `${timestamp} ${traceInfo} [${service}] ${level.toUpperCase()}: ${message}${metaString}`;
      }

      return JSON.stringify({
        timestamp,
        level,
        message,
        service,
        traceId,
        ...meta,
      });
    });

    const formats = [
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
    ];

    if (isDevelopment) {
      formats.push(winston.format.colorize({ all: true }));
    }

    formats.push(lt3Format);

    // Configure transports
    const transports: winston.transport[] = [
      new winston.transports.Console({
        level: logLevel,
        handleExceptions: true,
        handleRejections: true,
      }),
    ];

    // Add file transport for persistent logging
    if (process.env.DEBUG_LOG_FILE || isDevelopment) {
      const logFile = process.env.DEBUG_LOG_FILE || './debug/lt3-debug.log';

      transports.push(
        new winston.transports.File({
          filename: logFile,
          level: 'debug',
          maxsize: 10485760, // 10MB
          maxFiles: 5,
          tailable: true,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        })
      );
    }

    // Add error-specific file transport
    if (process.env.ERROR_LOG_FILE || isDevelopment) {
      const errorFile = process.env.ERROR_LOG_FILE || './debug/lt3-errors.log';

      transports.push(
        new winston.transports.File({
          filename: errorFile,
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 10,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
            winston.format.errors({ stack: true })
          ),
        })
      );
    }

    return winston.createLogger({
      level: logLevel,
      format: winston.format.combine(...formats),
      defaultMeta: {
        service: this.service,
        environment: process.env.NODE_ENV,
        hostname: require('os').hostname(),
        pid: process.pid,
      },
      transports,
    });
  }

  /**
   * Add context that will be included in all subsequent log entries
   */
  setContext(context: Record<string, any>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear context
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Get enhanced log metadata
   */
  private getLogMeta(meta: Record<string, any> = {}): Record<string, any> {
    const traceId = lt3Tracing.getCurrentTraceId();
    const timestamp = Date.now();

    return {
      ...this.context,
      ...meta,
      traceId,
      timestamp,
      memory: this.getMemoryInfo(),
    };
  }

  /**
   * Get current memory information
   */
  private getMemoryInfo() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
    };
  }

  // Standard logging methods with trace correlation
  error(message: string, meta: Record<string, any> = {}): void {
    this.logger.error(message, this.getLogMeta(meta));

    // Also add to current span if available
    lt3Tracing.addSpanEvent('error', { message, ...meta });
  }

  warn(message: string, meta: Record<string, any> = {}): void {
    this.logger.warn(message, this.getLogMeta(meta));
    lt3Tracing.addSpanEvent('warning', { message, ...meta });
  }

  info(message: string, meta: Record<string, any> = {}): void {
    this.logger.info(message, this.getLogMeta(meta));
    lt3Tracing.addSpanEvent('info', { message, ...meta });
  }

  debug(message: string, meta: Record<string, any> = {}): void {
    this.logger.debug(message, this.getLogMeta(meta));
  }

  trace(message: string, meta: Record<string, any> = {}): void {
    const stack = new Error().stack;
    this.logger.debug(message, this.getLogMeta({
      ...meta,
      level: 'trace',
      stack: stack?.split('\n').slice(2, 5), // Include relevant stack frames
    }));
  }

  // Specialized logging methods for LT3 components

  /**
   * Log AI provider operations
   */
  aiProvider(provider: string, operation: string, meta: Record<string, any> = {}): void {
    this.info(`AI Provider: ${provider} - ${operation}`, {
      ...meta,
      component: 'ai-provider',
      provider,
      operation,
    });
  }

  /**
   * Log ASR provider operations
   */
  asrProvider(provider: string, operation: string, meta: Record<string, any> = {}): void {
    this.info(`ASR Provider: ${provider} - ${operation}`, {
      ...meta,
      component: 'asr-provider',
      provider,
      operation,
    });
  }

  /**
   * Log API route processing
   */
  apiRoute(method: string, path: string, statusCode: number, duration: number, meta: Record<string, any> = {}): void {
    const level = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'info';

    this.logger[level](`API: ${method} ${path} - ${statusCode} (${duration}ms)`, this.getLogMeta({
      ...meta,
      component: 'api',
      method,
      path,
      statusCode,
      duration,
    }));
  }

  /**
   * Log database operations
   */
  database(operation: string, table: string, duration: number, meta: Record<string, any> = {}): void {
    this.debug(`DB: ${operation} ${table} (${duration}ms)`, {
      ...meta,
      component: 'database',
      operation,
      table,
      duration,
    });
  }

  /**
   * Log authentication events
   */
  auth(event: string, userId?: string, meta: Record<string, any> = {}): void {
    this.info(`Auth: ${event}`, {
      ...meta,
      component: 'auth',
      event,
      userId,
    });
  }

  /**
   * Log encryption/decryption operations
   */
  encryption(operation: string, success: boolean, meta: Record<string, any> = {}): void {
    const level = success ? 'debug' : 'error';
    this.logger[level](`Encryption: ${operation} - ${success ? 'success' : 'failed'}`, this.getLogMeta({
      ...meta,
      component: 'encryption',
      operation,
      success,
    }));
  }

  /**
   * Measure and log function execution time
   */
  timing<T>(operation: string, fn: () => T | Promise<T>, meta: Record<string, any> = {}): T | Promise<T> {
    const start = process.hrtime.bigint();

    const measureAndLog = (result: T) => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to ms

      this.debug(`Timing: ${operation} completed in ${duration.toFixed(2)}ms`, {
        ...meta,
        component: 'performance',
        operation,
        duration,
      });

      // Add timing to current span
      lt3Tracing.addSpanAttributes({
        [`lt3.timing.${operation}.duration_ms`]: duration,
      });

      return result;
    };

    try {
      const result = fn();

      if (result instanceof Promise) {
        return result.then(measureAndLog).catch((error) => {
          const end = process.hrtime.bigint();
          const duration = Number(end - start) / 1000000;

          this.error(`Timing: ${operation} failed after ${duration.toFixed(2)}ms`, {
            ...meta,
            component: 'performance',
            operation,
            duration,
            error: error.message,
          });

          throw error;
        });
      }

      return measureAndLog(result);
    } catch (error) {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000;

      this.error(`Timing: ${operation} failed after ${duration.toFixed(2)}ms`, {
        ...meta,
        component: 'performance',
        operation,
        duration,
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Log security events
   */
  security(event: string, severity: 'low' | 'medium' | 'high' | 'critical', meta: Record<string, any> = {}): void {
    const levelMap = {
      low: 'info',
      medium: 'warn',
      high: 'error',
      critical: 'error',
    };

    const level = levelMap[severity];

    this.logger[level](`Security: ${event} (${severity})`, this.getLogMeta({
      ...meta,
      component: 'security',
      event,
      severity,
      alert: severity === 'critical',
    }));
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext: Record<string, any>): LT3Logger {
    const childLogger = new LT3Logger(this.service);
    childLogger.setContext({ ...this.context, ...additionalContext });
    return childLogger;
  }
}

// Logger options interface
interface LT3LoggerOptions {
  level: string;
  enableFileLogging: boolean;
  enableConsoleLogging: boolean;
  maxFileSize: number;
  maxFiles: number;
}

// Global logger instances for different components
export const logger = new LT3Logger('lt3-main');
export const aiLogger = new LT3Logger('lt3-ai');
export const asrLogger = new LT3Logger('lt3-asr');
export const apiLogger = new LT3Logger('lt3-api');
export const dbLogger = new LT3Logger('lt3-db');
export const authLogger = new LT3Logger('lt3-auth');

// Debug logging utility functions
export const debug = {
  /**
   * Log object with pretty formatting
   */
  object(label: string, obj: any, logger = debug.logger): void {
    logger.debug(`${label}:`, {
      object: JSON.stringify(obj, null, 2),
    });
  },

  /**
   * Log function entry and exit
   */
  fn(name: string, args: any[] = [], logger = debug.logger) {
    logger.debug(`→ ${name}()`, { args });

    return {
      exit: (result?: any) => {
        logger.debug(`← ${name}()`, { result });
      },
      error: (error: Error) => {
        logger.error(`✗ ${name}() failed`, { error: error.message, stack: error.stack });
      },
    };
  },

  /**
   * Default logger for debug utilities
   */
  logger,
};

export default logger;