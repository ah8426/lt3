/**
 * React hooks for performance optimization
 * Implements React 19 concurrent features and optimization patterns
 */

'use client'

import { useEffect, useRef, useCallback, useMemo, startTransition } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Hook to track component mount/unmount performance
 */
export function usePerformanceMonitor(componentName: string) {
  const mountTime = useRef<number>()
  const renderCount = useRef(0)

  useEffect(() => {
    mountTime.current = performance.now()
    renderCount.current = 0

    return () => {
      if (mountTime.current) {
        const lifetime = performance.now() - mountTime.current
        console.log(`[Performance] ${componentName} lifetime:`, {
          duration: lifetime,
          renders: renderCount.current,
        })
      }
    }
  }, [componentName])

  useEffect(() => {
    renderCount.current++
  })
}

/**
 * Debounced value hook for expensive operations
 * Prevents unnecessary re-renders during rapid input changes
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      startTransition(() => {
        setDebouncedValue(value)
      })
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Intersection Observer hook for lazy loading
 * Only renders content when it enters viewport
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefCallback<Element>, boolean] {
  const [isIntersecting, setIsIntersecting] = React.useState(false)
  const [node, setNode] = React.useState<Element | null>(null)

  const observer = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    if (!node) return

    // Disconnect previous observer
    if (observer.current) {
      observer.current.disconnect()
    }

    observer.current = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting)
      },
      {
        rootMargin: '50px',
        threshold: 0.01,
        ...options,
      }
    )

    observer.current.observe(node)

    return () => {
      observer.current?.disconnect()
    }
  }, [node, options])

  return [setNode, isIntersecting]
}

/**
 * Prefetch data when link is hovered
 * Improves perceived performance
 */
export function usePrefetch<T>(
  fetcher: () => Promise<T>,
  enabled: boolean = true
): () => void {
  const cache = useRef<{ data?: T; promise?: Promise<void> }>({})

  return useCallback(() => {
    if (!enabled || cache.current.promise || cache.current.data) return

    cache.current.promise = fetcher()
      .then((data) => {
        cache.current.data = data
        cache.current.promise = undefined
      })
      .catch(() => {
        cache.current.promise = undefined
      })
  }, [fetcher, enabled])
}

/**
 * Track page navigation performance
 */
export function usePagePerformance() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const navigationStart = useRef<number>(performance.now())

  useEffect(() => {
    const navigationEnd = performance.now()
    const duration = navigationEnd - navigationStart.current

    console.log('[Page Performance]', {
      path: pathname,
      duration,
      timestamp: new Date().toISOString(),
    })

    // Send to analytics
    fetch('/api/analytics/page-performance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: pathname,
        duration,
        params: Object.fromEntries(searchParams.entries()),
        timestamp: Date.now(),
      }),
    }).catch(() => {})

    navigationStart.current = performance.now()
  }, [pathname, searchParams])
}

/**
 * Optimized memo comparison for objects
 */
export function useDeepMemo<T>(value: T): T {
  const ref = useRef<T>(value)
  const signalRef = useRef<number>(0)

  if (!deepEqual(ref.current, value)) {
    ref.current = value
    signalRef.current++
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => ref.current, [signalRef.current])
}

function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true

  if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
    return false
  }

  const keys1 = Object.keys(obj1)
  const keys2 = Object.keys(obj2)

  if (keys1.length !== keys2.length) return false

  for (const key of keys1) {
    if (!keys2.includes(key) || !deepEqual(obj1[key], obj2[key])) {
      return false
    }
  }

  return true
}

/**
 * Track render performance with React Profiler
 */
export function useRenderPerformance(componentName: string) {
  const renderCount = useRef(0)
  const totalDuration = useRef(0)

  useEffect(() => {
    renderCount.current++
  })

  return useCallback(
    (id: string, phase: 'mount' | 'update', actualDuration: number) => {
      totalDuration.current += actualDuration

      if (actualDuration > 16) {
        console.warn(`[Render Performance] ${componentName} slow render:`, {
          phase,
          duration: actualDuration,
          renderCount: renderCount.current,
          avgDuration: totalDuration.current / renderCount.current,
        })
      }
    },
    [componentName]
  )
}

/**
 * Memory leak detection for effect cleanup
 */
export function useEffectCleanup(effect: () => void | (() => void), deps: React.DependencyList) {
  const isMounted = useRef(true)

  useEffect(() => {
    const cleanup = effect()

    return () => {
      isMounted.current = false
      cleanup?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return isMounted
}

// Add React import at the top
import React from 'react'
