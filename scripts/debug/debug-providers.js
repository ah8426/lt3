#!/usr/bin/env node

/**
 * Debug script for testing AI and ASR provider initialization
 * Usage: node scripts/debug/debug-providers.js [provider-type]
 */

const { logger, aiLogger, asrLogger } = require('../../lib/debug/logger');
const { lt3Tracing } = require('../../lib/debug/tracing');

async function debugProviders(providerType = 'all') {
  logger.info('🚀 Starting provider debug session', { providerType });

  try {
    // Initialize tracing
    await lt3Tracing.initialize();

    if (providerType === 'all' || providerType === 'ai') {
      await debugAIProviders();
    }

    if (providerType === 'all' || providerType === 'asr') {
      await debugASRProviders();
    }

    logger.info('✅ Provider debug session completed');
  } catch (error) {
    logger.error('❌ Provider debug session failed', { error: error.message });
    process.exit(1);
  }
}

async function debugAIProviders() {
  aiLogger.info('🤖 Testing AI providers...');

  const providers = ['anthropic', 'openai', 'google'];
  const testPrompt = {
    messages: [{ role: 'user', content: 'Hello, this is a test message.' }],
    model: 'default',
    maxTokens: 50,
  };

  for (const provider of providers) {
    try {
      aiLogger.info(`Testing ${provider} provider...`);

      // Simulate provider test (replace with actual provider test)
      const apiKey = process.env[`${provider.toUpperCase()}_API_KEY`];

      if (!apiKey) {
        aiLogger.warn(`${provider} API key not found, skipping test`);
        continue;
      }

      // Add trace for provider test
      await lt3Tracing.traceProviderOperation(
        'ai',
        provider,
        'test-connection',
        async (span) => {
          // Simulate API call delay
          await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 500));

          if (span) {
            span.setAttributes({
              'lt3.test.prompt_length': testPrompt.messages[0].content.length,
              'lt3.test.model': testPrompt.model,
            });
          }

          aiLogger.info(`✅ ${provider} provider test successful`);
          return { status: 'success', provider };
        }
      );

    } catch (error) {
      aiLogger.error(`❌ ${provider} provider test failed`, {
        provider,
        error: error.message,
      });
    }
  }
}

async function debugASRProviders() {
  asrLogger.info('🎤 Testing ASR providers...');

  const providers = ['deepgram', 'assemblyai', 'google-speech'];
  const testAudio = {
    format: 'wav',
    sampleRate: 16000,
    duration: 5000, // 5 seconds
  };

  for (const provider of providers) {
    try {
      asrLogger.info(`Testing ${provider} provider...`);

      const apiKey = process.env[`${provider.toUpperCase().replace('-', '_')}_API_KEY`];

      if (!apiKey) {
        asrLogger.warn(`${provider} API key not found, skipping test`);
        continue;
      }

      // Add trace for provider test
      await lt3Tracing.traceProviderOperation(
        'asr',
        provider,
        'test-connection',
        async (span) => {
          // Simulate ASR processing delay
          await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 800));

          if (span) {
            span.setAttributes({
              'lt3.test.audio_format': testAudio.format,
              'lt3.test.sample_rate': testAudio.sampleRate,
              'lt3.test.duration': testAudio.duration,
            });
          }

          asrLogger.info(`✅ ${provider} provider test successful`);
          return { status: 'success', provider };
        }
      );

    } catch (error) {
      asrLogger.error(`❌ ${provider} provider test failed`, {
        provider,
        error: error.message,
      });
    }
  }
}

// Performance monitoring during tests
function setupPerformanceMonitoring() {
  const { performance, PerformanceObserver } = require('perf_hooks');

  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach(entry => {
      if (entry.duration > 1000) { // Log slow operations
        logger.warn('Slow operation detected', {
          name: entry.name,
          duration: entry.duration,
          type: entry.entryType,
        });
      }
    });
  });

  observer.observe({ entryTypes: ['measure', 'mark'] });

  // Mark start of debug session
  performance.mark('debug-session-start');

  // Cleanup on exit
  process.on('exit', () => {
    performance.mark('debug-session-end');
    performance.measure('debug-session', 'debug-session-start', 'debug-session-end');
    observer.disconnect();
  });
}

// Memory leak detection
function setupMemoryMonitoring() {
  const initialMemory = process.memoryUsage();
  logger.info('Initial memory usage', initialMemory);

  setInterval(() => {
    const currentMemory = process.memoryUsage();
    const heapGrowth = currentMemory.heapUsed - initialMemory.heapUsed;

    if (heapGrowth > 50 * 1024 * 1024) { // 50MB growth
      logger.warn('Significant heap growth detected', {
        initial: Math.round(initialMemory.heapUsed / 1024 / 1024),
        current: Math.round(currentMemory.heapUsed / 1024 / 1024),
        growth: Math.round(heapGrowth / 1024 / 1024),
      });
    }
  }, 5000);
}

// Main execution
if (require.main === module) {
  const providerType = process.argv[2] || 'all';

  // Setup monitoring
  setupPerformanceMonitoring();
  setupMemoryMonitoring();

  // Run debug session
  debugProviders(providerType).finally(() => {
    setTimeout(() => {
      process.exit(0);
    }, 1000); // Give time for cleanup
  });
}

module.exports = { debugProviders, debugAIProviders, debugASRProviders };