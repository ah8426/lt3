/**
 * Core Web Vitals monitoring and optimization utilities
 * Tracks LCP, FID, CLS, FCP, TTFB for performance optimization
 */

export interface WebVitalsMetric {
  id: string
  name: 'CLS' | 'FCP' | 'FID' | 'LCP' | 'TTFB' | 'INP'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  navigationType: string
}

/**
 * Performance thresholds based on Google's Core Web Vitals
 */
export const THRESHOLDS = {
  // Largest Contentful Paint (LCP) - measures loading performance
  LCP: {
    good: 2500,
    needsImprovement: 4000,
  },
  // First Input Delay (FID) - measures interactivity
  FID: {
    good: 100,
    needsImprovement: 300,
  },
  // Cumulative Layout Shift (CLS) - measures visual stability
  CLS: {
    good: 0.1,
    needsImprovement: 0.25,
  },
  // First Contentful Paint (FCP)
  FCP: {
    good: 1800,
    needsImprovement: 3000,
  },
  // Time to First Byte (TTFB)
  TTFB: {
    good: 800,
    needsImprovement: 1800,
  },
  // Interaction to Next Paint (INP) - replaces FID
  INP: {
    good: 200,
    needsImprovement: 500,
  },
} as const

/**
 * Get rating for a metric based on thresholds
 */
function getRating(
  name: WebVitalsMetric['name'],
  value: number
): WebVitalsMetric['rating'] {
  const threshold = THRESHOLDS[name]
  if (value <= threshold.good) return 'good'
  if (value <= threshold.needsImprovement) return 'needs-improvement'
  return 'poor'
}

/**
 * Send metric to analytics endpoint
 */
export function sendToAnalytics(metric: WebVitalsMetric): void {
  // Send to analytics service (e.g., Google Analytics, Vercel Analytics)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    // Example: Send to Google Analytics 4
    if ('gtag' in window) {
      ;(window as any).gtag('event', metric.name, {
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        metric_id: metric.id,
        metric_value: metric.value,
        metric_delta: metric.delta,
        metric_rating: metric.rating,
      })
    }

    // Send to custom endpoint
    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
      navigationType: metric.navigationType,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    })

    // Use sendBeacon for reliable delivery even during page unload
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/web-vitals', body)
    } else {
      fetch('/api/analytics/web-vitals', {
        body,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(console.error)
    }
  }
}

/**
 * Report Web Vitals with enhanced metrics
 */
export function reportWebVitals(metric: any): void {
  const enhancedMetric: WebVitalsMetric = {
    id: metric.id,
    name: metric.name,
    value: metric.value,
    rating: getRating(metric.name, metric.value),
    delta: metric.delta,
    navigationType: metric.navigationType || 'unknown',
  }

  // Log in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Web Vitals] ${metric.name}:`, {
      value: metric.value,
      rating: enhancedMetric.rating,
      delta: metric.delta,
    })
  }

  // Send to analytics in production
  sendToAnalytics(enhancedMetric)
}

/**
 * Performance observer for long tasks (tasks > 50ms)
 */
export function observeLongTasks(callback: (entries: PerformanceEntry[]) => void): void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      callback(entries)
    })

    observer.observe({ entryTypes: ['longtask'] })
  } catch {
    console.warn('Long task observation not supported')
  }
}

/**
 * Monitor resource loading performance
 */
export function observeResourceTiming(): void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries() as PerformanceResourceTiming[]

      entries.forEach((entry) => {
        // Flag slow resources (> 1s)
        if (entry.duration > 1000) {
          console.warn(`[Performance] Slow resource: ${entry.name}`, {
            duration: entry.duration,
            size: entry.transferSize,
            type: entry.initiatorType,
          })
        }
      })
    })

    observer.observe({ entryTypes: ['resource'] })
  } catch {
    console.warn('Resource timing observation not supported')
  }
}

/**
 * Measure component render time
 */
export function measureRenderTime(componentName: string, startMark: string, endMark: string): void {
  if (typeof performance === 'undefined') return

  try {
    performance.mark(endMark)
    performance.measure(`${componentName} render`, startMark, endMark)

    const measure = performance.getEntriesByName(`${componentName} render`)[0]
    if (measure && measure.duration > 16) {
      // Warn if render takes longer than one frame (16ms at 60fps)
      console.warn(`[Performance] Slow render: ${componentName}`, {
        duration: measure.duration,
      })
    }

    // Cleanup marks
    performance.clearMarks(startMark)
    performance.clearMarks(endMark)
    performance.clearMeasures(`${componentName} render`)
  } catch {
    // Performance marks not supported
  }
}

/**
 * Hook for measuring component performance
 */
export function createPerformanceMark(name: string): {
  start: () => void
  end: () => void
} {
  const startMark = `${name}-start`
  const endMark = `${name}-end`

  return {
    start: () => {
      if (typeof performance !== 'undefined') {
        performance.mark(startMark)
      }
    },
    end: () => {
      measureRenderTime(name, startMark, endMark)
    },
  }
}

/**
 * Calculate and report navigation timing
 */
export function reportNavigationTiming(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('load', () => {
    setTimeout(() => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming

      if (!perfData) return

      const metrics = {
        dns: perfData.domainLookupEnd - perfData.domainLookupStart,
        tcp: perfData.connectEnd - perfData.connectStart,
        ttfb: perfData.responseStart - perfData.requestStart,
        download: perfData.responseEnd - perfData.responseStart,
        domInteractive: perfData.domInteractive - perfData.fetchStart,
        domComplete: perfData.domComplete - perfData.fetchStart,
        loadComplete: perfData.loadEventEnd - perfData.fetchStart,
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('[Navigation Timing]', metrics)
      }

      // Send to analytics
      fetch('/api/analytics/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...metrics,
          url: window.location.href,
          timestamp: Date.now(),
        }),
      }).catch(() => {})
    }, 0)
  })
}
