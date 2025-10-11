#!/usr/bin/env node

/**
 * Heap snapshot utility for memory debugging
 * Usage: node scripts/debug/heap-snapshot.js [tag]
 */

const fs = require('fs');
const path = require('path');

async function takeHeapSnapshot(tag = 'manual') {
  const outputDir = './debug/snapshots';

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    console.log('🧠 Taking heap snapshot...');

    // Try to use v8-profiler-next for detailed snapshots
    try {
      const v8Profiler = require('v8-profiler-next');

      const snapshot = v8Profiler.takeSnapshot();
      const fileName = `heap-${tag}-${Date.now()}.heapsnapshot`;
      const filePath = path.join(outputDir, fileName);

      await new Promise((resolve, reject) => {
        snapshot.export((error, result) => {
          if (error) {
            reject(error);
          } else {
            fs.writeFileSync(filePath, result);
            snapshot.delete();
            resolve(result);
          }
        });
      });

      const size = fs.statSync(filePath).size;
      console.log(`✅ Heap snapshot saved: ${filePath} (${Math.round(size / 1024 / 1024)}MB)`);

      return filePath;
    } catch (profilerError) {
      console.warn('⚠️  v8-profiler-next not available, using fallback method');

      // Fallback to memory usage dump
      const memUsage = process.memoryUsage();

      // Force garbage collection if available
      if (global.gc) {
        console.log('🗑️  Running garbage collection...');
        global.gc();
        const afterGC = process.memoryUsage();

        const snapshot = {
          timestamp: new Date().toISOString(),
          tag,
          beforeGC: memUsage,
          afterGC: afterGC,
          freed: {
            rss: memUsage.rss - afterGC.rss,
            heapTotal: memUsage.heapTotal - afterGC.heapTotal,
            heapUsed: memUsage.heapUsed - afterGC.heapUsed,
            external: memUsage.external - afterGC.external,
          },
          process: {
            pid: process.pid,
            uptime: process.uptime(),
            platform: process.platform,
            version: process.version,
          },
        };

        const fileName = `memory-dump-${tag}-${Date.now()}.json`;
        const filePath = path.join(outputDir, fileName);

        fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));

        console.log(`📊 Memory dump saved: ${filePath}`);
        console.log(`💾 Memory freed by GC: ${Math.round(snapshot.freed.heapUsed / 1024 / 1024)}MB`);

        return filePath;
      } else {
        console.log('ℹ️  Run with --expose-gc for garbage collection analysis');

        const snapshot = {
          timestamp: new Date().toISOString(),
          tag,
          memory: memUsage,
          process: {
            pid: process.pid,
            uptime: process.uptime(),
            platform: process.platform,
            version: process.version,
          },
        };

        const fileName = `memory-info-${tag}-${Date.now()}.json`;
        const filePath = path.join(outputDir, fileName);

        fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
        console.log(`📋 Memory info saved: ${filePath}`);

        return filePath;
      }
    }
  } catch (error) {
    console.error('❌ Failed to take heap snapshot:', error.message);
    throw error;
  }
}

// Memory analysis utilities
function analyzeMemoryTrend(snapshotDir = './debug/snapshots') {
  if (!fs.existsSync(snapshotDir)) {
    console.log('No snapshots directory found');
    return;
  }

  const files = fs.readdirSync(snapshotDir)
    .filter(f => f.endsWith('.json'))
    .sort();

  if (files.length < 2) {
    console.log('Need at least 2 snapshots for trend analysis');
    return;
  }

  console.log('📈 Analyzing memory trend...');

  const snapshots = files.map(file => {
    const content = JSON.parse(fs.readFileSync(path.join(snapshotDir, file), 'utf8'));
    return {
      file,
      timestamp: content.timestamp,
      memory: content.memory || content.afterGC || content.beforeGC,
    };
  });

  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const curr = snapshots[i];

    const heapGrowth = curr.memory.heapUsed - prev.memory.heapUsed;
    const rssGrowth = curr.memory.rss - prev.memory.rss;

    console.log(`${prev.file} → ${curr.file}`);
    console.log(`  Heap: ${formatBytes(heapGrowth, true)}`);
    console.log(`  RSS:  ${formatBytes(rssGrowth, true)}`);
    console.log('');
  }
}

function formatBytes(bytes, showSign = false) {
  const sign = showSign && bytes > 0 ? '+' : '';
  const abs = Math.abs(bytes);

  if (abs >= 1024 * 1024) {
    return `${sign}${(bytes / 1024 / 1024).toFixed(1)}MB`;
  } else if (abs >= 1024) {
    return `${sign}${(bytes / 1024).toFixed(1)}KB`;
  } else {
    return `${sign}${bytes}B`;
  }
}

// Continuous monitoring mode
function startContinuousMonitoring(interval = 60000, threshold = 50 * 1024 * 1024) {
  console.log(`🔄 Starting continuous monitoring (${interval/1000}s interval, ${formatBytes(threshold)} threshold)`);

  let baselineMemory = process.memoryUsage().heapUsed;
  let snapshotCount = 0;

  const monitor = setInterval(async () => {
    const currentMemory = process.memoryUsage().heapUsed;
    const growth = currentMemory - baselineMemory;

    console.log(`📊 Memory check: ${formatBytes(currentMemory)} (${formatBytes(growth, true)} from baseline)`);

    if (growth > threshold) {
      console.log('🚨 Memory threshold exceeded, taking snapshot...');

      try {
        await takeHeapSnapshot(`auto-${++snapshotCount}`);
        baselineMemory = currentMemory; // Reset baseline
      } catch (error) {
        console.error('Failed to take automatic snapshot:', error.message);
      }
    }
  }, interval);

  // Cleanup on exit
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping continuous monitoring...');
    clearInterval(monitor);
    process.exit(0);
  });

  return monitor;
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'snapshot';

  switch (command) {
    case 'snapshot':
      const tag = args[1] || 'manual';
      takeHeapSnapshot(tag).catch(console.error);
      break;

    case 'analyze':
      analyzeMemoryTrend(args[1]);
      break;

    case 'monitor':
      const interval = parseInt(args[1]) || 60000;
      const threshold = parseInt(args[2]) || 50 * 1024 * 1024;
      startContinuousMonitoring(interval, threshold);
      break;

    default:
      console.log('Usage: node heap-snapshot.js <command> [options]');
      console.log('Commands:');
      console.log('  snapshot [tag]           - Take a single heap snapshot');
      console.log('  analyze [dir]            - Analyze memory trend from snapshots');
      console.log('  monitor [interval] [threshold] - Continuous monitoring');
      break;
  }
}

module.exports = {
  takeHeapSnapshot,
  analyzeMemoryTrend,
  startContinuousMonitoring,
};