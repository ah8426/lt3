import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { ConsoleSpanExporter, BatchSpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { getEnv } from '@/lib/config/env-validator';

/**
 * Law Transcribed Distributed Tracing System
 * Implements OpenTelemetry for comprehensive request tracing across AI/ASR providers
 */
export class LT3TracingSystem {
  private sdk: NodeSDK | null = null;
  private tracer: any = null;
  private serviceName: string;
  private initialized = false;

  constructor(serviceName = 'law-transcribed') {
    this.serviceName = serviceName;
  }

  /**
   * Initialize the tracing system
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const env = getEnv();

      // Create appropriate exporter based on environment
      const spanProcessor = this.createSpanProcessor();

      // Create resource with service metadata
      const resource = Resource.default().merge(
        new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: this.serviceName,
          [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
          [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: env.NODE_ENV,
          [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'legal-tech',
          'lt3.component': 'main-service',
        })
      );

      // Initialize SDK with custom instrumentations
      this.sdk = new NodeSDK({
        resource,
        spanProcessor: spanProcessor as any, // Type compatibility fix for OpenTelemetry versions
        instrumentations: [
          getNodeAutoInstrumentations({
            // Disable noisy instrumentations
            '@opentelemetry/instrumentation-fs': { enabled: false },
            '@opentelemetry/instrumentation-dns': { enabled: false },
            '@opentelemetry/instrumentation-net': { enabled: false },

            // Configure HTTP instrumentation for API routes
            '@opentelemetry/instrumentation-http': {
              enabled: true,
              requestHook: (span, request) => {
                const headers = (request as any).headers || {};
                span.setAttributes({
                  'lt3.request.size': headers['content-length'] || 0,
                  'lt3.request.user_agent': headers['user-agent'] || 'unknown',
                  'lt3.request.origin': headers.origin || 'direct',
                });
              },
              responseHook: (span, response) => {
                const headers = (response as any).headers || {};
                span.setAttributes({
                  'lt3.response.size': headers['content-length'] || 0,
                  'lt3.response.content_type': headers['content-type'] || 'unknown',
                });
              },
            },

            // Configure Redis instrumentation
            '@opentelemetry/instrumentation-redis-4': {
              enabled: true,
              dbStatementSerializer: (cmdName, cmdArgs) => {
                // Sanitize sensitive data
                if (cmdName.toLowerCase().includes('auth')) {
                  return `${cmdName} [REDACTED]`;
                }
                return `${cmdName} ${cmdArgs.slice(0, 2).join(' ')}${cmdArgs.length > 2 ? '...' : ''}`;
              },
            },

            // Configure database instrumentation
            '@opentelemetry/instrumentation-pg': {
              enabled: true,
              enhancedDatabaseReporting: true,
            },
          }),
        ],
      });

      this.sdk.start();
      this.tracer = trace.getTracer(this.serviceName);
      this.initialized = true;

      console.log('✅ LT3 Tracing initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize tracing:', error);
      // Don't throw - allow app to continue without tracing
    }
  }

  /**
   * Create span processor based on environment
   */
  private createSpanProcessor() {
    const env = getEnv();

    if (env.NODE_ENV === 'development') {
      // Use console exporter for development
      return new SimpleSpanProcessor(new ConsoleSpanExporter());
    }

    // Use Jaeger for staging/production
    const jaegerEndpoint = process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces';
    const jaegerExporter = new JaegerExporter({
      endpoint: jaegerEndpoint,
      // tags field removed as it doesn't accept custom tags in newer versions
    });

    return new BatchSpanProcessor(jaegerExporter, {
      maxQueueSize: 1000,
      scheduledDelayMillis: 5000,
      exportTimeoutMillis: 30000,
      maxExportBatchSize: 512,
    });
  }

  /**
   * Create a custom span for AI/ASR operations
   */
  async traceProviderOperation<T>(
    operationType: 'ai' | 'asr',
    provider: string,
    operation: string,
    fn: (span: any) => Promise<T>,
    metadata: Record<string, any> = {}
  ): Promise<T> {
    if (!this.tracer) {
      // Fallback if tracing not initialized
      return await fn(null);
    }

    const spanName = `${operationType}.${provider}.${operation}`;

    return await this.tracer.startActiveSpan(spanName, {
      kind: SpanKind.CLIENT,
      attributes: {
        'lt3.operation.type': operationType,
        'lt3.provider.name': provider,
        'lt3.operation.name': operation,
        'lt3.operation.timestamp': Date.now(),
        ...metadata,
      },
    }, async (span: any) => {
      try {
        const result = await fn(span);

        // Add success attributes
        span.setAttributes({
          'lt3.operation.success': true,
          'lt3.operation.duration': Date.now() - span.attributes['lt3.operation.timestamp'],
        });

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        // Record error details
        span.recordException(error as Error);
        span.setAttributes({
          'lt3.operation.success': false,
          'lt3.error.type': (error as Error).name,
          'lt3.error.message': (error as Error).message,
        });

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });

        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Trace API route execution
   */
  async traceAPIRoute<T>(
    method: string,
    path: string,
    fn: (span: any) => Promise<T>,
    metadata: Record<string, any> = {}
  ): Promise<T> {
    if (!this.tracer) {
      return await fn(null);
    }

    const spanName = `api.${method.toLowerCase()}.${path.replace(/\//g, '.')}`;

    return await this.tracer.startActiveSpan(spanName, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': method,
        'http.route': path,
        'lt3.api.version': 'v1',
        'lt3.api.timestamp': Date.now(),
        ...metadata,
      },
    }, async (span: any) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Trace database operations
   */
  async traceDatabase<T>(
    operation: string,
    table: string,
    fn: (span: any) => Promise<T>,
    metadata: Record<string, any> = {}
  ): Promise<T> {
    if (!this.tracer) {
      return await fn(null);
    }

    const spanName = `db.${operation}.${table}`;

    return await this.tracer.startActiveSpan(spanName, {
      kind: SpanKind.CLIENT,
      attributes: {
        'db.system': 'postgresql',
        'db.operation': operation,
        'db.sql.table': table,
        'lt3.db.timestamp': Date.now(),
        ...metadata,
      },
    }, async (span: any) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Add custom attributes to current span
   */
  addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.setAttributes(attributes);
    }
  }

  /**
   * Add custom event to current span
   */
  addSpanEvent(name: string, attributes?: Record<string, any>): void {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.addEvent(name, attributes);
    }
  }

  /**
   * Get current trace ID for correlation
   */
  getCurrentTraceId(): string | undefined {
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      return activeSpan.spanContext().traceId;
    }
    return undefined;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.sdk) {
      try {
        await this.sdk.shutdown();
        console.log('🛑 LT3 Tracing shutdown complete');
      } catch (error) {
        console.error('❌ Error during tracing shutdown:', error);
      }
    }
  }
}

// Global tracing instance
export const lt3Tracing = new LT3TracingSystem();

// Initialize tracing early in the application lifecycle
if (process.env.ENABLE_TRACING === 'true') {
  lt3Tracing.initialize().catch(console.error);
}

// Graceful shutdown handler
process.on('SIGTERM', () => {
  lt3Tracing.shutdown().finally(() => process.exit(0));
});

process.on('SIGINT', () => {
  lt3Tracing.shutdown().finally(() => process.exit(0));
});

/**
 * Middleware for Next.js API routes to add tracing
 */
export function withTracing<T extends any[]>(
  handler: (...args: T) => Promise<any>,
  routeName: string
) {
  return async (...args: T) => {
    const [request] = args as any[];

    return await lt3Tracing.traceAPIRoute(
      request.method || 'UNKNOWN',
      routeName,
      async (span) => {
        // Add request metadata to span
        if (span && request) {
          span.setAttributes({
            'http.url': request.url || 'unknown',
            'http.user_agent': request.headers?.['user-agent'] || 'unknown',
            'lt3.request.id': request.headers?.['x-request-id'] || 'unknown',
          });
        }

        return await handler(...args);
      }
    );
  };
}

/**
 * Decorator for provider manager methods
 */
export function traceProviderMethod(operationType: 'ai' | 'asr', provider: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return await lt3Tracing.traceProviderOperation(
        operationType,
        provider,
        propertyKey,
        async (span) => {
          // Add method-specific metadata
          if (span) {
            span.setAttributes({
              'lt3.method.name': propertyKey,
              'lt3.method.args_count': args.length,
            });
          }

          return await originalMethod.apply(this, args);
        },
        {
          'lt3.class.name': target.constructor.name,
        }
      );
    };

    return descriptor;
  };
}

export default lt3Tracing;