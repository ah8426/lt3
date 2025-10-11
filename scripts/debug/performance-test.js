#!/usr/bin/env node

/**
 * Performance testing and profiling script
 * Usage: node scripts/debug/performance-test.js [test-type]
 */

const { performance } = require('perf_hooks');
const { logger } = require('../../lib/debug/logger');
const { lt3Profiler } = require('../../lib/debug/profiler');
const { lt3Tracing } = require('../../lib/debug/tracing');

class PerformanceTestSuite {
  constructor() {
    this.results = [];
    this.config = {
      warmupRuns: 3,
      testRuns: 10,
      maxDuration: 30000, // 30 seconds
    };
  }

  /**
   * Run complete performance test suite
   */
  async runFullSuite() {
    logger.info('🚀 Starting performance test suite');

    try {
      // Initialize tracing and profiling
      await lt3Tracing.initialize();
      lt3Profiler.startMemoryMonitoring(5000);

      // Start CPU profiling
      const profileId = lt3Profiler.startCPUProfile('performance-test');

      // Run individual test categories
      await this.testDatabaseOperations();
      await this.testAIProviderCalls();
      await this.testASRProviderCalls();
      await this.testEncryptionOperations();
      await this.testAPIRouteProcessing();
      await this.testMemoryAllocations();

      // Stop profiling
      const profileResult = await lt3Profiler.stopCPUProfile(profileId);
      logger.info('CPU profile completed', profileResult);

      // Generate report
      this.generateReport();

    } catch (error) {
      logger.error('Performance test suite failed', { error: error.message });
    } finally {
      lt3Profiler.stopMemoryMonitoring();
    }
  }

  /**
   * Test database operations performance
   */
  async testDatabaseOperations() {
    logger.info('📊 Testing database operations...');

    const tests = [
      { name: 'Simple Query', fn: this.simulateSimpleQuery },
      { name: 'Complex Join', fn: this.simulateComplexQuery },
      { name: 'Bulk Insert', fn: this.simulateBulkInsert },
      { name: 'Transaction', fn: this.simulateTransaction },
    ];

    for (const test of tests) {
      await this.runBenchmark(`db.${test.name}`, test.fn.bind(this));
    }
  }

  /**
   * Test AI provider call performance
   */
  async testAIProviderCalls() {
    logger.info('🤖 Testing AI provider calls...');

    const tests = [
      { name: 'Short Completion', fn: () => this.simulateAICall(50) },
      { name: 'Long Completion', fn: () => this.simulateAICall(500) },
      { name: 'Streaming', fn: this.simulateAIStreaming },
    ];

    for (const test of tests) {
      await this.runBenchmark(`ai.${test.name}`, test.fn);
    }
  }

  /**
   * Test ASR provider performance
   */
  async testASRProviderCalls() {
    logger.info('🎤 Testing ASR provider calls...');

    const tests = [
      { name: 'Short Audio', fn: () => this.simulateASRCall(5000) },
      { name: 'Long Audio', fn: () => this.simulateASRCall(30000) },
      { name: 'Streaming', fn: this.simulateASRStreaming },
    ];

    for (const test of tests) {
      await this.runBenchmark(`asr.${test.name}`, test.fn);
    }
  }

  /**
   * Test encryption operations
   */
  async testEncryptionOperations() {
    logger.info('🔐 Testing encryption operations...');

    const tests = [
      { name: 'Encrypt Small', fn: () => this.simulateEncryption(100) },
      { name: 'Encrypt Large', fn: () => this.simulateEncryption(10000) },
      { name: 'Decrypt Small', fn: () => this.simulateDecryption(100) },
      { name: 'Decrypt Large', fn: () => this.simulateDecryption(10000) },
    ];

    for (const test of tests) {
      await this.runBenchmark(`crypto.${test.name}`, test.fn);
    }
  }

  /**
   * Test API route processing
   */
  async testAPIRouteProcessing() {
    logger.info('🌐 Testing API route processing...');

    const tests = [
      { name: 'Auth Check', fn: this.simulateAuthCheck },
      { name: 'JSON Parse', fn: this.simulateJSONParsing },
      { name: 'Validation', fn: this.simulateValidation },
      { name: 'Response Format', fn: this.simulateResponseFormatting },
    ];

    for (const test of tests) {
      await this.runBenchmark(`api.${test.name}`, test.fn.bind(this));
    }
  }

  /**
   * Test memory allocation patterns
   */
  async testMemoryAllocations() {
    logger.info('🧠 Testing memory allocations...');

    const tests = [
      { name: 'Small Objects', fn: () => this.simulateMemoryAllocation(1000, 100) },
      { name: 'Large Objects', fn: () => this.simulateMemoryAllocation(100, 10000) },
      { name: 'Array Operations', fn: this.simulateArrayOperations },
      { name: 'Buffer Operations', fn: this.simulateBufferOperations },
    ];

    for (const test of tests) {
      await this.runBenchmark(`memory.${test.name}`, test.fn);
    }
  }

  /**
   * Run a benchmark test
   */
  async runBenchmark(name, testFn) {
    logger.debug(`Running benchmark: ${name}`);

    // Warmup runs
    for (let i = 0; i < this.config.warmupRuns; i++) {
      await testFn();
    }

    // Actual test runs
    const durations = [];
    const startMemory = process.memoryUsage();

    for (let i = 0; i < this.config.testRuns; i++) {
      const start = performance.now();

      try {
        await testFn();
        const duration = performance.now() - start;
        durations.push(duration);
      } catch (error) {
        logger.error(`Benchmark ${name} failed`, { error: error.message });
        return;
      }
    }

    const endMemory = process.memoryUsage();
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

    // Calculate statistics
    const stats = this.calculateStats(durations);
    stats.memoryDelta = memoryDelta;

    this.results.push({
      name,
      stats,
      timestamp: Date.now(),
    });

    logger.info(`Benchmark completed: ${name}`, {
      avg: `${stats.avg.toFixed(2)}ms`,
      min: `${stats.min.toFixed(2)}ms`,
      max: `${stats.max.toFixed(2)}ms`,
      memory: `${Math.round(memoryDelta / 1024)}KB`,
    });
  }

  /**
   * Calculate performance statistics
   */
  calculateStats(durations) {
    const sorted = durations.sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      avg: sum / durations.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdDev: Math.sqrt(
        durations.map(x => Math.pow(x - sum / durations.length, 2))
          .reduce((a, b) => a + b, 0) / durations.length
      ),
    };
  }

  // Simulation functions for different operations

  async simulateSimpleQuery() {
    // Simulate database query delay
    await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 10));
    return { rows: [{ id: 1, name: 'test' }] };
  }

  async simulateComplexQuery() {
    // Simulate complex query with joins
    await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 30));
    return { rows: Array(10).fill(null).map((_, i) => ({ id: i, data: 'test' })) };
  }

  async simulateBulkInsert() {
    // Simulate bulk insert operation
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
    return { insertedCount: 100 };
  }

  async simulateTransaction() {
    // Simulate transaction with multiple operations
    await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 40));
    return { success: true };
  }

  async simulateAICall(tokens) {
    // Simulate AI API call based on token count
    const baseDelay = Math.log(tokens) * 20;
    await new Promise(resolve => setTimeout(resolve, baseDelay + Math.random() * baseDelay));
    return { tokens, response: 'Generated text' };
  }

  async simulateAIStreaming() {
    // Simulate streaming AI response
    const chunks = 10;
    for (let i = 0; i < chunks; i++) {
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
    }
    return { chunks };
  }

  async simulateASRCall(durationMs) {
    // Simulate ASR processing based on audio duration
    const processingTime = durationMs / 100; // 1% of audio duration
    await new Promise(resolve => setTimeout(resolve, processingTime + Math.random() * processingTime));
    return { transcript: 'Transcribed text', confidence: 0.95 };
  }

  async simulateASRStreaming() {
    // Simulate real-time ASR
    const segments = 5;
    for (let i = 0; i < segments; i++) {
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
    }
    return { segments };
  }

  async simulateEncryption(dataSize) {
    // Simulate encryption based on data size
    const buffer = Buffer.alloc(dataSize, 'test data');
    const processingTime = Math.log(dataSize) * 2;
    await new Promise(resolve => setTimeout(resolve, processingTime));
    return { encrypted: buffer.toString('base64') };
  }

  async simulateDecryption(dataSize) {
    // Simulate decryption
    const processingTime = Math.log(dataSize) * 1.5;
    await new Promise(resolve => setTimeout(resolve, processingTime));
    return { decrypted: 'original data' };
  }

  async simulateAuthCheck() {
    // Simulate JWT verification
    await new Promise(resolve => setTimeout(resolve, 2 + Math.random() * 3));
    return { valid: true, user: { id: 1 } };
  }

  async simulateJSONParsing() {
    // Simulate JSON parsing of large payload
    const largeObject = { data: Array(1000).fill('test') };
    const json = JSON.stringify(largeObject);
    const parsed = JSON.parse(json);
    return parsed;
  }

  async simulateValidation() {
    // Simulate data validation
    await new Promise(resolve => setTimeout(resolve, 1 + Math.random() * 2));
    return { valid: true };
  }

  async simulateResponseFormatting() {
    // Simulate response formatting
    const data = { result: Array(100).fill('data') };
    const formatted = JSON.stringify(data);
    return formatted;
  }

  async simulateMemoryAllocation(count, size) {
    // Simulate memory allocation patterns
    const objects = [];
    for (let i = 0; i < count; i++) {
      objects.push(Buffer.alloc(size, i));
    }
    return objects.length;
  }

  async simulateArrayOperations() {
    // Simulate array operations
    const arr = Array(10000).fill(0).map((_, i) => i);
    const filtered = arr.filter(x => x % 2 === 0);
    const mapped = filtered.map(x => x * 2);
    const reduced = mapped.reduce((a, b) => a + b, 0);
    return reduced;
  }

  async simulateBufferOperations() {
    // Simulate buffer operations
    const buffer1 = Buffer.alloc(5000, 'A');
    const buffer2 = Buffer.alloc(5000, 'B');
    const combined = Buffer.concat([buffer1, buffer2]);
    return combined.length;
  }

  /**
   * Generate performance report
   */
  generateReport() {
    logger.info('📋 Generating performance report...');

    const report = {
      timestamp: new Date().toISOString(),
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage(),
      },
      config: this.config,
      results: this.results,
      summary: this.generateSummary(),
    };

    // Save to file
    const fs = require('fs');
    const path = require('path');

    const reportDir = './debug/reports';
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const fileName = `performance-report-${Date.now()}.json`;
    const filePath = path.join(reportDir, fileName);

    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));

    logger.info(`Performance report saved: ${filePath}`);
    this.printSummary();
  }

  /**
   * Generate performance summary
   */
  generateSummary() {
    const categories = {};

    this.results.forEach(result => {
      const [category] = result.name.split('.');
      if (!categories[category]) {
        categories[category] = {
          tests: 0,
          avgDuration: 0,
          totalMemory: 0,
        };
      }

      categories[category].tests++;
      categories[category].avgDuration += result.stats.avg;
      categories[category].totalMemory += result.stats.memoryDelta || 0;
    });

    Object.keys(categories).forEach(category => {
      const cat = categories[category];
      cat.avgDuration = cat.avgDuration / cat.tests;
    });

    return categories;
  }

  /**
   * Print summary to console
   */
  printSummary() {
    console.log('\n🎯 Performance Test Summary');
    console.log('═'.repeat(50));

    const summary = this.generateSummary();

    Object.entries(summary).forEach(([category, stats]) => {
      console.log(`\n📊 ${category.toUpperCase()}`);
      console.log(`  Tests: ${stats.tests}`);
      console.log(`  Avg Duration: ${stats.avgDuration.toFixed(2)}ms`);
      console.log(`  Memory Impact: ${Math.round(stats.totalMemory / 1024)}KB`);
    });

    // Find slowest operations
    const slowest = this.results
      .sort((a, b) => b.stats.avg - a.stats.avg)
      .slice(0, 5);

    console.log('\n🐌 Slowest Operations:');
    slowest.forEach((result, i) => {
      console.log(`  ${i + 1}. ${result.name}: ${result.stats.avg.toFixed(2)}ms`);
    });

    // Find memory hungry operations
    const memoryHungry = this.results
      .filter(r => r.stats.memoryDelta > 0)
      .sort((a, b) => b.stats.memoryDelta - a.stats.memoryDelta)
      .slice(0, 5);

    if (memoryHungry.length > 0) {
      console.log('\n🧠 Memory Intensive Operations:');
      memoryHungry.forEach((result, i) => {
        console.log(`  ${i + 1}. ${result.name}: ${Math.round(result.stats.memoryDelta / 1024)}KB`);
      });
    }

    console.log('\n✅ Performance testing completed');
  }
}

// Command line interface
if (require.main === module) {
  const testType = process.argv[2] || 'full';
  const suite = new PerformanceTestSuite();

  switch (testType) {
    case 'full':
      suite.runFullSuite();
      break;
    case 'db':
      suite.testDatabaseOperations();
      break;
    case 'ai':
      suite.testAIProviderCalls();
      break;
    case 'asr':
      suite.testASRProviderCalls();
      break;
    case 'crypto':
      suite.testEncryptionOperations();
      break;
    case 'api':
      suite.testAPIRouteProcessing();
      break;
    case 'memory':
      suite.testMemoryAllocations();
      break;
    default:
      console.log('Usage: node performance-test.js [test-type]');
      console.log('Test types: full, db, ai, asr, crypto, api, memory');
      break;
  }
}

module.exports = PerformanceTestSuite;