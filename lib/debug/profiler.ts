import * as fs from 'fs';
import * as path from 'path';
import { performance, PerformanceObserver } from 'perf_hooks';
import { logger } from './logger';

/**
 * Performance Profiler for Law Transcribed
 * Provides CPU profiling, memory monitoring, and performance analysis
 */
export class LT3Profiler {
  private profiles: Map<string, any> = new Map();
  private outputDir: string;
  private performanceObserver: PerformanceObserver | null = null;
  private memoryMonitor: NodeJS.Timeout | null = null;
  private metricsHistory: PerformanceMetric[] = [];
  private readonly MAX_HISTORY = 1000;

  constructor(outputDir = './debug/profiles') {
    this.outputDir = outputDir;
    this.ensureOutputDir();
    this.setupPerformanceObserver();
  }

  /**
   * Ensure output directory exists
   */
  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Setup performance observer for automatic metric collection
   */
  private setupPerformanceObserver(): void {
    this.performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();

      for (const entry of entries) {
        if (entry.entryType === 'measure') {
          this.recordMetric({
            type: 'timing',
            name: entry.name,
            value: entry.duration,
            timestamp: Date.now(),
            details: {
              startTime: entry.startTime,
              duration: entry.duration,
            },
          });
        }
      }
    });

    this.performanceObserver.observe({ entryTypes: ['measure', 'mark'] });
  }

  /**
   * Start CPU profiling (requires v8-profiler-next)
   */
  startCPUProfile(id: string, options: CPUProfileOptions = {}): string {
    try {
      // Try to load v8-profiler-next dynamically
      const v8Profiler = require('v8-profiler-next');

      const title = options.title || `lt3-cpu-profile-${id}`;
      v8Profiler.startProfiling(title, true);

      this.profiles.set(id, {
        type: 'cpu',
        title,
        startTime: Date.now(),
        options,
      });

      logger.info(`Started CPU profile: ${id}`, { title });
      return id;
    } catch (error) {
      logger.warn('v8-profiler-next not available, using fallback timing', { error: (error as Error).message });

      // Fallback to performance timing
      performance.mark(`cpu-profile-${id}-start`);
      this.profiles.set(id, {
        type: 'timing',
        title: id,
        startTime: Date.now(),
        options,
      });

      return id;
    }
  }

  /**
   * Stop CPU profiling and save results
   */
  async stopCPUProfile(id: string): Promise<ProfileResult> {
    const profileInfo = this.profiles.get(id);
    if (!profileInfo) {
      throw new Error(`CPU profile ${id} not found`);
    }

    const duration = Date.now() - profileInfo.startTime;

    try {
      if (profileInfo.type === 'cpu') {
        const v8Profiler = require('v8-profiler-next');
        const profile = v8Profiler.stopProfiling(profileInfo.title);

        // Save profile to file
        const fileName = `${profileInfo.title}-${Date.now()}.cpuprofile`;
        const filePath = path.join(this.outputDir, fileName);

        await this.saveProfile(profile, filePath);
        profile.delete();

        logger.info(`CPU profile saved: ${filePath}`, { duration });

        return {
          id,
          type: 'cpu',
          duration,
          filePath,
          size: fs.statSync(filePath).size,
        };
      } else {
        // Fallback timing profile
        performance.mark(`cpu-profile-${id}-end`);
        performance.measure(`cpu-profile-${id}`, `cpu-profile-${id}-start`, `cpu-profile-${id}-end`);

        return {
          id,
          type: 'timing',
          duration,
          filePath: null,
          size: 0,
        };
      }
    } catch (error) {
      logger.error(`Failed to stop CPU profile ${id}`, { error: (error as Error).message });
      throw error;
    } finally {
      this.profiles.delete(id);
    }
  }

  /**
   * Take a heap snapshot
   */
  async takeHeapSnapshot(tag = ''): Promise<ProfileResult> {
    try {
      const v8Profiler = require('v8-profiler-next');

      const fileName = `heap-${tag}-${Date.now()}.heapsnapshot`;
      const filePath = path.join(this.outputDir, fileName);

      const snapshot = v8Profiler.takeSnapshot();
      await this.saveProfile(snapshot, filePath);
      snapshot.delete();

      const size = fs.statSync(filePath).size;
      logger.info(`Heap snapshot saved: ${filePath}`, { size });

      return {
        id: `heap-${tag}`,
        type: 'heap',
        duration: 0,
        filePath,
        size,
      };
    } catch (error) {
      logger.warn('v8-profiler-next not available for heap snapshots', { error: (error as Error).message });

      // Fallback to memory usage logging
      const memUsage = process.memoryUsage();
      const fileName = `memory-usage-${tag}-${Date.now()}.json`;
      const filePath = path.join(this.outputDir, fileName);

      fs.writeFileSync(filePath, JSON.stringify({
        timestamp: new Date().toISOString(),
        tag,
        memory: memUsage,
        gc: global.gc ? 'available' : 'not available',
      }, null, 2));

      return {
        id: `memory-${tag}`,
        type: 'memory',
        duration: 0,
        filePath,
        size: fs.statSync(filePath).size,
      };
    }
  }

  /**
   * Save profile data to file
   */
  private async saveProfile(profile: any, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      profile.export((error: Error | null, result: string) => {
        if (error) {
          reject(error);
        } else {
          fs.writeFileSync(filePath, result);
          resolve();
        }
      });
    });
  }

  /**
   * Start memory monitoring
   */
  startMemoryMonitoring(interval = 5000): void {
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
    }

    this.memoryMonitor = setInterval(() => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      this.recordMetric({
        type: 'memory',
        name: 'heap_used',
        value: memUsage.heapUsed,
        timestamp: Date.now(),
        details: memUsage,
      });

      this.recordMetric({
        type: 'cpu',
        name: 'cpu_usage',
        value: cpuUsage.user + cpuUsage.system,
        timestamp: Date.now(),
        details: cpuUsage,
      });

      // Check for memory leaks
      this.checkMemoryLeak();
    }, interval);

    logger.info('Started memory monitoring', { interval });
  }

  /**
   * Stop memory monitoring
   */
  stopMemoryMonitoring(): void {
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
      this.memoryMonitor = null;
      logger.info('Stopped memory monitoring');
    }
  }

  /**
   * Check for potential memory leaks
   */
  private checkMemoryLeak(): void {
    const memoryMetrics = this.metricsHistory
      .filter(m => m.type === 'memory' && m.name === 'heap_used')
      .slice(-10); // Last 10 measurements

    if (memoryMetrics.length >= 5) {
      const trend = this.calculateMemoryTrend(memoryMetrics);

      if (trend.increasing && trend.avgIncrease > 10 * 1024 * 1024) { // 10MB average increase
        logger.warn('Potential memory leak detected', {
          trend,
          currentMemory: memoryMetrics[memoryMetrics.length - 1].value,
        });

        // Take automatic heap snapshot
        this.takeHeapSnapshot('auto-leak-detection');
      }
    }
  }

  /**
   * Calculate memory usage trend
   */
  private calculateMemoryTrend(metrics: PerformanceMetric[]): MemoryTrend {
    if (metrics.length < 2) {
      return { increasing: false, avgIncrease: 0, samples: metrics.length };
    }

    const increases = [];
    for (let i = 1; i < metrics.length; i++) {
      increases.push(metrics[i].value - metrics[i - 1].value);
    }

    const avgIncrease = increases.reduce((sum, inc) => sum + inc, 0) / increases.length;
    const increasing = increases.filter(inc => inc > 0).length > increases.length * 0.7; // 70% increasing

    return {
      increasing,
      avgIncrease,
      samples: metrics.length,
    };
  }

  /**
   * Record performance metric
   */
  private recordMetric(metric: PerformanceMetric): void {
    this.metricsHistory.push(metric);

    // Keep only recent metrics
    if (this.metricsHistory.length > this.MAX_HISTORY) {
      this.metricsHistory = this.metricsHistory.slice(-this.MAX_HISTORY);
    }
  }

  /**
   * Measure function execution with detailed profiling
   */
  measureFunction<T>(
    name: string,
    fn: () => T | Promise<T>,
    options: MeasureOptions = {}
  ): T | Promise<T> {
    const startMark = `${name}-start`;
    const endMark = `${name}-end`;
    const measureName = `${name}-execution`;

    performance.mark(startMark);

    const recordEndMeasurement = () => {
      performance.mark(endMark);
      performance.measure(measureName, startMark, endMark);

      if (options.logResult) {
        const measurement = performance.getEntriesByName(measureName)[0];
        logger.debug(`Function measurement: ${name}`, {
          duration: measurement.duration,
          startTime: measurement.startTime,
        });
      }
    };

    try {
      const result = fn();

      if (result instanceof Promise) {
        return result
          .then((res) => {
            recordEndMeasurement();
            return res;
          })
          .catch((error) => {
            recordEndMeasurement();
            throw error;
          });
      }

      recordEndMeasurement();
      return result;
    } catch (error) {
      recordEndMeasurement();
      throw error;
    }
  }

  /**
   * Get performance metrics summary
   */
  getMetricsSummary(type?: string): MetricsSummary {
    const filteredMetrics = type
      ? this.metricsHistory.filter(m => m.type === type)
      : this.metricsHistory;

    if (filteredMetrics.length === 0) {
      return {
        count: 0,
        average: 0,
        min: 0,
        max: 0,
        latest: null,
      };
    }

    const values = filteredMetrics.map(m => m.value);
    const latest = filteredMetrics[filteredMetrics.length - 1];

    return {
      count: filteredMetrics.length,
      average: values.reduce((sum, val) => sum + val, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      latest,
    };
  }

  /**
   * Export metrics to file
   */
  exportMetrics(fileName?: string): string {
    const exportData = {
      timestamp: new Date().toISOString(),
      service: 'law-transcribed',
      metrics: this.metricsHistory,
      summary: {
        memory: this.getMetricsSummary('memory'),
        cpu: this.getMetricsSummary('cpu'),
        timing: this.getMetricsSummary('timing'),
      },
    };

    const exportFileName = fileName || `metrics-export-${Date.now()}.json`;
    const filePath = path.join(this.outputDir, exportFileName);

    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
    logger.info(`Metrics exported to: ${filePath}`);

    return filePath;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
    }

    logger.info('Profiler cleanup completed');
  }
}

// Types and interfaces
interface CPUProfileOptions {
  title?: string;
  sampleInterval?: number;
}

interface ProfileResult {
  id: string;
  type: 'cpu' | 'heap' | 'timing' | 'memory';
  duration: number;
  filePath: string | null;
  size: number;
}

interface PerformanceMetric {
  type: string;
  name: string;
  value: number;
  timestamp: number;
  details?: any;
}

interface MemoryTrend {
  increasing: boolean;
  avgIncrease: number;
  samples: number;
}

interface MeasureOptions {
  logResult?: boolean;
  includeStackTrace?: boolean;
}

interface MetricsSummary {
  count: number;
  average: number;
  min: number;
  max: number;
  latest: PerformanceMetric | null;
}

// Global profiler instance
export const lt3Profiler = new LT3Profiler();

// Auto-start memory monitoring in development
if (process.env.NODE_ENV === 'development' && process.env.ENABLE_MEMORY_MONITORING === 'true') {
  lt3Profiler.startMemoryMonitoring(10000); // Every 10 seconds
}

// Cleanup on process exit
process.on('exit', () => {
  lt3Profiler.cleanup();
});

export default lt3Profiler;