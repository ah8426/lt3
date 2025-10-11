# 🚨 Debug & Trace Quick Reference

## 🚀 Quick Commands

```bash
# Start debugging
npm run dev:debug                    # Full debug mode
npm run dev:profile                  # With CPU profiling

# Dashboard
npm run debug:dashboard              # Launch at http://localhost:9231

# Provider testing
npm run debug:providers              # Test all providers
npm run debug:providers:ai           # Test AI providers only
npm run debug:providers:asr          # Test ASR providers only

# Performance
npm run debug:performance            # Full performance suite
npm run debug:performance:ai         # AI performance only
npm run debug:performance:asr        # ASR performance only
npm run debug:performance:db         # Database performance only

# Memory analysis
npm run debug:heap                   # Take heap snapshot
npm run debug:heap:analyze           # Analyze snapshots
npm run debug:heap:monitor           # Continuous monitoring
npm run debug:memory                 # With GC analysis

# Profiling
npm run profile:cpu                  # CPU profiling
npm run profile:heap                 # Heap profiling

# Cleanup
npm run clean:debug                  # Remove all debug files
```

## 🔧 VS Code Debugging

### Keyboard Shortcuts
- `F5` - Start debugging
- `F9` - Toggle breakpoint
- `F10` - Step over
- `F11` - Step into
- `Shift+F11` - Step out
- `Ctrl+Shift+F5` - Restart debugging
- `Shift+F5` - Stop debugging

### Debug Configurations
1. **🚀 Debug Next.js Dev Server** - Full Next.js debugging
2. **🔧 Debug Next.js API Routes** - API-specific debugging
3. **🧪 Debug Jest Tests** - Unit test debugging
4. **🔍 Debug Specific Test File** - Current file testing
5. **🌐 Debug Browser (Chrome)** - Frontend debugging
6. **🔄 Full Stack Debug** - Backend + Frontend together

## 📊 Environment Variables

```bash
# Development (add to .env.local)
DEBUG=lt3:*
LOG_LEVEL=debug
ENABLE_TRACING=true
ENABLE_DEBUG_LOGGING=true
ENABLE_MEMORY_MONITORING=true
ENABLE_DEBUG_DASHBOARD=true
DEBUG_DASHBOARD_PORT=9231

# Production (use with caution)
PRODUCTION_DEBUG=false
DEBUG_AUTH_TOKEN=your-secret-token
DEBUG_ALLOWED_IPS=127.0.0.1
DEBUG_ALLOWED_USERS=admin@example.com
```

## 🔍 Code Usage

### Basic Logging
```typescript
import { logger } from '@/lib/debug/logger';

logger.info('User action', { userId, action });
logger.error('Operation failed', { error: err.message });
logger.debug('Debug info', { data });
```

### Tracing API Routes
```typescript
import { withTracing } from '@/lib/debug/tracing';

export const POST = withTracing(async (req) => {
  // Your route logic
}, 'api.route.name');
```

### Tracing Provider Operations
```typescript
import { lt3Tracing } from '@/lib/debug/tracing';

await lt3Tracing.traceProviderOperation(
  'ai',
  'anthropic',
  'completion',
  async (span) => {
    span?.setAttributes({ model: 'claude-3' });
    return await provider.complete(options);
  }
);
```

### Performance Profiling
```typescript
import { lt3Profiler } from '@/lib/debug/profiler';

// Measure function
const result = lt3Profiler.measureFunction(
  'operation-name',
  async () => await heavyOperation(),
  { logResult: true }
);

// Take snapshot
await lt3Profiler.takeHeapSnapshot('before-operation');
```

### Component-Specific Logging
```typescript
import { aiLogger, asrLogger, apiLogger } from '@/lib/debug/logger';

aiLogger.info('AI request', { model, tokens });
asrLogger.info('ASR processing', { duration, provider });
apiLogger.info('API call', { endpoint, status });
```

## 📈 Dashboard Features

### Access
- **URL**: http://localhost:9231
- **WebSocket**: ws://localhost:9231

### Interactive Controls
- **Start CPU Profile** - Begin profiling
- **Stop CPU Profile** - Save profile
- **Take Heap Snapshot** - Capture memory state
- **Export Metrics** - Save performance data
- **Clear Logs** - Reset log display

### Real-time Metrics
- Memory usage (RSS, Heap)
- CPU usage
- System uptime
- Active connections
- Request traces

## 🎯 Common Workflows

### 1. Debug Performance Issue
```bash
# Start monitoring
npm run debug:dashboard &
npm run debug:heap:monitor &

# Run app with profiling
npm run dev:profile

# In another terminal, test the issue
# Then analyze results in dashboard
```

### 2. Debug Memory Leak
```bash
# Take baseline
npm run debug:heap snapshot baseline

# Reproduce the issue
# ...

# Take comparison
npm run debug:heap snapshot after-leak

# Analyze
npm run debug:heap:analyze
```

### 3. Debug Provider Initialization
```bash
# Test all providers
npm run debug:providers

# Check logs
tail -f debug/lt3-debug.log

# Check specific provider
npm run debug:providers:ai
```

### 4. Production Debugging
```bash
# Enable (server-side)
export PRODUCTION_DEBUG=true
export DEBUG_AUTH_TOKEN=secret

# Send debug request
curl -H "X-Debug-Token: secret" \
     -H "X-Debug-Response: true" \
     https://your-app.com/api/endpoint

# Check debug session
cat debug/sessions/debug-session-*.json
```

## 📁 Output Locations

```
debug/
├── lt3-debug.log          # Debug logs
├── lt3-errors.log         # Error logs
├── profiles/              # CPU profiles
│   └── *.cpuprofile
├── snapshots/             # Heap snapshots
│   └── *.heapsnapshot
├── reports/               # Performance reports
│   └── performance-report-*.json
└── sessions/              # Debug sessions
    └── debug-session-*.json
```

## 🔧 Troubleshooting

### "v8-profiler-next not available"
```bash
npm install v8-profiler-next --save-dev
```

### "Cannot read properties of null"
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### "Dashboard not starting"
```bash
# Check port availability
netstat -ano | findstr :9231

# Or use different port
DEBUG_DASHBOARD_PORT=9232 npm run debug:dashboard
```

### "Tracing not working"
```bash
# Verify environment
echo $ENABLE_TRACING

# Set explicitly
export ENABLE_TRACING=true
npm run dev:debug
```

## 📚 Resources

- **Full Guide**: `DEBUG_TRACE_GUIDE.md`
- **Setup Summary**: `DEBUG_SETUP_SUMMARY.md`
- **System Fixes**: `SYSTEM_FIXES_SUMMARY.md`

## 🆘 Emergency Procedures

### Disable All Debugging
```bash
unset DEBUG
unset ENABLE_TRACING
unset ENABLE_DEBUG_LOGGING
npm run dev
```

### Clean All Debug Data
```bash
npm run clean:debug
rm -rf debug/
mkdir -p debug/{profiles,snapshots,reports,sessions}
```

### Reset Configuration
```bash
# Remove VS Code settings
rm -rf .vscode/

# Reset npm config
rm .npmrc
npm config delete debug
```

---

**Need Help?** Check `DEBUG_TRACE_GUIDE.md` for detailed documentation.