'use client'

/**
 * Web Vitals reporting component
 * Automatically tracks and reports Core Web Vitals metrics
 */

import { useEffect } from 'react'
import { useReportWebVitals } from 'next/web-vitals'
import { reportWebVitals } from '@/lib/performance'

export function WebVitals() {
  useReportWebVitals((metric) => {
    reportWebVitals(metric)
  })

  // Setup additional performance observers
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              console.warn('[Performance] Long Task detected:', {
                duration: entry.duration,
                name: entry.name,
                startTime: entry.startTime,
              })
            }
          }
        })

        longTaskObserver.observe({ entryTypes: ['longtask'] })

        return () => {
          longTaskObserver.disconnect()
        }
      } catch {
        // Long task observation not supported
      }
    }
  }, [])

  return null
}
