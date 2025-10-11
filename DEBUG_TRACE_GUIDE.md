# 🚨 Law Transcribed Debug & Trace Configuration Guide

## Overview

This comprehensive debugging and tracing system provides production-ready tools for monitoring, profiling, and troubleshooting the Law Transcribed application. The system includes distributed tracing, performance profiling, real-time monitoring, and production-safe debugging capabilities.

---

## 🛠️ Quick Start

### 1. Development Environment Setup

```bash
# Install optional profiling dependencies
npm install --save-dev v8-profiler-next

# Enable debugging in environment
echo "ENABLE_TRACING=true" >> .env.local
echo "ENABLE_DEBUG_LOGGING=true" >> .env.local
echo "ENABLE_MEMORY_MONITORING=true" >> .env.local
echo "ENABLE_DEBUG_DASHBOARD=true" >> .env.local
echo "LOG_LEVEL=debug" >> .env.local
```

### 2. Start Debug Session

```bash
# Start with debugging enabled
npm run dev:debug

# Or start individual components
npm run debug:dashboard  # Debug dashboard on port 9231
npm run debug:providers  # Test provider initialization
npm run debug:performance  # Run performance tests
```

### 3. VS Code Debugging

1. Open VS Code in the project directory
2. Go to Run and Debug (Ctrl+Shift+D)
3. Select "🚀 Debug Next.js Dev Server"
4. Set breakpoints and start debugging

---

## 📊 Components Overview

### 1. Distributed Tracing (`lib/debug/tracing.ts`)

OpenTelemetry-based tracing system that tracks requests across:
- API routes
- AI provider calls
- ASR provider calls
- Database operations
- External services

**Key Features:**
- Automatic instrumentation of HTTP, Redis, and database operations
- Custom span creation for provider operations
- Trace correlation across services
- Jaeger export in production

### 2. Advanced Logging (`lib/debug/logger.ts`)

Structured logging with trace correlation:
- Multiple log levels (error, warn, info, debug, trace)
- Component-specific loggers (AI, ASR, API, DB, Auth)
- Automatic trace ID injection
- File rotation and export capabilities

### 3. Performance Profiler (`lib/debug/profiler.ts`)

Comprehensive performance monitoring:
- CPU profiling with v8-profiler-next
- Heap snapshots for memory analysis
- Automatic memory leak detection
- Performance metrics collection
- Function execution timing

### 4. Debug Dashboard (`lib/debug/dashboard.ts`)

Real-time monitoring interface:
- WebSocket-based live updates
- System metrics visualization
- Interactive profiling controls
- Log streaming
- Remote debugging commands

### 5. Production Debugger (`lib/debug/production-debug.ts`)

Safe debugging in production:
- Token-based authentication
- IP and user whitelisting
- Session-based debug mode
- Conditional breakpoints
- Debug session export

---

## 🔧 Configuration

### Environment Variables

```bash
# Core Debug Settings
DEBUG=lt3:*                           # Enable debug namespace
LOG_LEVEL=debug                       # Set log level
NODE_ENV=development                  # Environment

# Tracing Configuration
ENABLE_TRACING=true                   # Enable OpenTelemetry
JAEGER_ENDPOINT=http://localhost:14268/api/traces  # Jaeger endpoint
TRACE_SAMPLING_RATE=0.1               # 10% sampling

# Profiling Settings
ENABLE_PROFILING=true                 # Enable CPU profiling
ENABLE_MEMORY_MONITORING=true         # Memory monitoring
PROFILE_SAMPLING_RATE=0.01           # 1% profile sampling

# Dashboard Settings
ENABLE_DEBUG_DASHBOARD=true           # Debug dashboard
DEBUG_DASHBOARD_PORT=9231             # Dashboard port

# Production Debug Settings
PRODUCTION_DEBUG=false                # Production debug mode
DEBUG_AUTH_TOKEN=your-secret-token    # Auth token
DEBUG_ALLOWED_IPS=127.0.0.1,::1      # Allowed IP addresses
DEBUG_ALLOWED_USERS=admin@example.com # Allowed users

# File Logging
DEBUG_LOG_FILE=./debug/lt3-debug.log  # Debug log file
ERROR_LOG_FILE=./debug/lt3-errors.log # Error log file
DEBUG_EXPORT_SESSIONS=true            # Export debug sessions
```

### VS Code Configuration

The system includes pre-configured VS Code settings:

- **Launch configurations** for debugging Next.js, API routes, tests
- **Tasks** for profiling, heap snapshots, bundle analysis
- **Extensions** recommendations for optimal debugging experience
- **Settings** for TypeScript, debugging, and terminal environment

---

## 🎯 Usage Examples

### 1. Basic Debugging

```typescript
import { logger, lt3Tracing } from '@/lib/debug';

// Basic logging with trace correlation
logger.info('Processing user request', { userId: '123' });

// Trace API operations
await lt3Tracing.traceAPIRoute('POST', '/api/sessions', async (span) => {
  // Add custom attributes
  span?.setAttributes({ 'user.id': userId });

  // Your API logic here
  return await createSession(data);
});
```

### 2. Provider Operation Tracing

```typescript
import { lt3Tracing } from '@/lib/debug/tracing';

// Trace AI provider calls
const result = await lt3Tracing.traceProviderOperation(
  'ai',
  'anthropic',
  'completion',
  async (span) => {
    span?.setAttributes({
      'ai.model': 'claude-3',
      'ai.tokens': 150,
    });

    return await anthropicProvider.complete(options);
  },
  { userId: '123' }
);
```

### 3. Performance Profiling

```typescript
import { lt3Profiler } from '@/lib/debug/profiler';

// Measure function performance
const result = lt3Profiler.measureFunction(
  'expensive-operation',
  async () => {
    // Your expensive operation
    return await processLargeDataset();
  },
  { logResult: true }
);

// Take heap snapshot
const snapshotPath = await lt3Profiler.takeHeapSnapshot('before-cleanup');
```

### 4. Production Debugging

```typescript
import { withProductionDebug } from '@/lib/debug/production-debug';

// Enable production debugging for specific routes
export const POST = withProductionDebug(async (req: NextRequest) => {
  // Debug utilities available in req.debug
  req.debug?.log('Processing sensitive operation');
  req.debug?.breakpoint(() => req.body.userId === 'debug-user');

  return NextResponse.json({ success: true });
});
```

---

## 📈 Debug Dashboard

Access the debug dashboard at `http://localhost:9231` when enabled.

### Features:
- **Real-time Metrics**: CPU, memory, uptime
- **Interactive Controls**: Start/stop profiling, take snapshots
- **Live Logs**: Streaming debug logs with filtering
- **Performance Charts**: Memory usage trends
- **Session Management**: View active debug sessions

### Commands:
- `startCPUProfile()` - Begin CPU profiling
- `stopCPUProfile()` - End and save CPU profile
- `takeHeapSnapshot()` - Capture memory snapshot
- `exportMetrics()` - Export performance metrics

---

## 🔍 Debugging Workflows

### 1. Performance Issue Investigation

```bash
# 1. Start performance monitoring
npm run debug:performance

# 2. Enable continuous memory monitoring
node scripts/debug/heap-snapshot.js monitor 30000 50000000

# 3. Run specific performance tests
node scripts/debug/performance-test.js ai

# 4. Analyze results
cat debug/reports/performance-report-*.json
```

### 2. Memory Leak Detection

```bash
# 1. Take baseline snapshot
node scripts/debug/heap-snapshot.js snapshot baseline

# 2. Run problematic operation
# ... reproduce memory issue ...

# 3. Take comparison snapshot
node scripts/debug/heap-snapshot.js snapshot after-issue

# 4. Analyze trend
node scripts/debug/heap-snapshot.js analyze debug/snapshots
```

### 3. Provider Initialization Debugging

```bash
# Test all providers
node scripts/debug/debug-providers.js

# Test specific provider type
node scripts/debug/debug-providers.js ai
node scripts/debug/debug-providers.js asr

# Check trace output in dashboard
```

### 4. API Route Debugging

```typescript
// Add tracing to your API route
import { withTracing } from '@/lib/debug/tracing';

export const POST = withTracing(async (req: NextRequest) => {
  // Your route logic with automatic tracing
}, 'api.sessions.create');
```

---

## 🛡️ Production Debugging

### Safe Production Debugging Setup

1. **Enable with Authentication**:
```bash
export PRODUCTION_DEBUG=true
export DEBUG_AUTH_TOKEN="your-secure-token"
export DEBUG_ALLOWED_IPS="your.admin.ip.address"
```

2. **Send Debug Request**:
```bash
curl -H "X-Debug-Token: your-secure-token" \
     -H "X-Debug-Response: true" \
     https://your-app.com/api/sessions
```

3. **Review Debug Session**:
```bash
# Check debug/sessions/ directory for exported data
cat debug/sessions/debug-session-*.json
```

### Emergency Procedures

```typescript
import { productionDebugger } from '@/lib/debug/production-debug';

// Emergency disable if needed
productionDebugger.emergencyDisable();

// Check current debug status
const status = productionDebugger.getDebugInfo();
```

---

## 📋 Troubleshooting Playbook

### Common Issues

#### 1. High Memory Usage
```bash
# Investigation steps:
1. Check memory trend: node scripts/debug/heap-snapshot.js analyze
2. Take heap snapshot: node scripts/debug/heap-snapshot.js snapshot investigation
3. Review metrics: npm run debug:performance memory
4. Check for memory leaks in dashboard
```

#### 2. Slow API Responses
```bash
# Investigation steps:
1. Enable tracing: ENABLE_TRACING=true npm run dev
2. Check Jaeger dashboard for slow spans
3. Run API performance tests: node scripts/debug/performance-test.js api
4. Profile during load: npm run debug:profile
```

#### 3. Provider Failures
```bash
# Investigation steps:
1. Test providers: node scripts/debug/debug-providers.js
2. Check provider logs: grep "provider" debug/lt3-debug.log
3. Verify API keys: node scripts/debug/debug-providers.js ai
4. Check network connectivity and rate limits
```

#### 4. Database Performance
```bash
# Investigation steps:
1. Run DB tests: node scripts/debug/performance-test.js db
2. Check query logs: grep "db\." debug/lt3-debug.log
3. Monitor connection pool: Check Prisma metrics
4. Analyze N+1 queries in traces
```

### Debug Commands Cheat Sheet

```bash
# Quick debugging
npm run dev:debug                    # Start with all debugging
npm run debug:dashboard             # Launch debug dashboard
npm run debug:providers             # Test provider initialization
npm run debug:performance          # Run performance suite

# Profiling
node scripts/debug/heap-snapshot.js         # Take heap snapshot
node scripts/debug/performance-test.js      # Performance testing
node --inspect-brk npm run dev             # Node inspector

# VS Code debugging
F5                                  # Start debugging
Ctrl+Shift+D                      # Debug view
Ctrl+Shift+P > "Debug: ..."       # Debug commands

# Log analysis
tail -f debug/lt3-debug.log        # Live debug logs
grep "ERROR" debug/lt3-errors.log  # Error analysis
jq . debug/reports/*.json          # Pretty print reports
```

---

## 🔧 Advanced Configuration

### Custom Trace Exporters

```typescript
// lib/debug/custom-exporter.ts
import { SpanExporter } from '@opentelemetry/sdk-trace-base';

export class CustomSpanExporter implements SpanExporter {
  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    // Custom export logic (e.g., to your monitoring service)
    resultCallback({ code: ExportResultCode.SUCCESS });
  }
}
```

### Custom Logger Transport

```typescript
// lib/debug/custom-transport.ts
import winston from 'winston';

export class CustomTransport extends winston.Transport {
  log(info: any, callback: () => void): void {
    // Custom logging logic (e.g., to external service)
    callback();
  }
}
```

### Performance Metrics Integration

```typescript
// lib/debug/metrics-integration.ts
import { lt3Profiler } from './profiler';

// Custom metrics collection
setInterval(() => {
  const metrics = lt3Profiler.getMetricsSummary();
  // Send to your metrics service
}, 60000);
```

---

## 📦 Dependencies

### Required Dependencies
```json
{
  "@opentelemetry/api": "^1.7.0",
  "@opentelemetry/sdk-node": "^0.45.0",
  "@opentelemetry/auto-instrumentations-node": "^0.40.0",
  "winston": "^3.11.0",
  "ws": "^8.14.0"
}
```

### Optional Dependencies
```json
{
  "v8-profiler-next": "^1.9.0",
  "@opentelemetry/exporter-jaeger": "^1.17.0"
}
```

---

## 🎯 Best Practices

### 1. Debugging Guidelines
- Use structured logging with consistent metadata
- Add trace correlation to all async operations
- Implement circuit breakers for external services
- Use conditional breakpoints sparingly in production

### 2. Performance Monitoring
- Monitor memory trends continuously
- Profile CPU usage during peak loads
- Track provider response times
- Set up alerts for performance degradation

### 3. Production Safety
- Always authenticate debug requests
- Limit debug session duration
- Export debug data for analysis
- Have emergency disable procedures

### 4. Development Workflow
- Use VS Code configurations for consistent debugging
- Run provider tests before deployment
- Profile performance tests in CI/CD
- Review trace data for optimization opportunities

---

## 📞 Support & Resources

### Debug Dashboard
- URL: `http://localhost:9231`
- WebSocket: `ws://localhost:9231`
- API: `http://localhost:9231/api/metrics`

### Log Files
- Debug logs: `./debug/lt3-debug.log`
- Error logs: `./debug/lt3-errors.log`
- Performance reports: `./debug/reports/`
- Heap snapshots: `./debug/snapshots/`
- Debug sessions: `./debug/sessions/`

### External Tools
- **Jaeger UI**: http://localhost:16686 (if running)
- **Chrome DevTools**: chrome://inspect
- **Node Inspector**: http://localhost:9229

---

## 🚀 Next Steps

1. **Enable debugging** in your development environment
2. **Configure tracing** for your specific needs
3. **Set up monitoring** dashboards
4. **Train your team** on debugging workflows
5. **Establish production** debugging procedures

This debug and trace system provides comprehensive visibility into your Law Transcribed application, enabling rapid issue resolution and performance optimization.

---

**Last Updated**: October 2025
**Compatibility**: Next.js 15, Node.js 18+, TypeScript 5+