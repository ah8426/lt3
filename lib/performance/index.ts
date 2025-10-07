/**
 * Performance optimization utilities
 * Export all performance-related functions and hooks
 */

export * from './web-vitals'
export * from './hooks'
export * from './image-loader'

/**
 * Network request optimization utilities
 */

/**
 * Batch multiple requests into a single request
 */
export class RequestBatcher<T = any> {
  private queue: Array<{
    resolve: (value: T) => void
    reject: (error: any) => void
    key: string
  }> = []
  private timeout: NodeJS.Timeout | null = null
  private readonly delay: number
  private readonly fetcher: (keys: string[]) => Promise<T[]>

  constructor(fetcher: (keys: string[]) => Promise<T[]>, delay: number = 10) {
    this.fetcher = fetcher
    this.delay = delay
  }

  request(key: string): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject, key })

      if (this.timeout) {
        clearTimeout(this.timeout)
      }

      this.timeout = setTimeout(() => {
        this.flush()
      }, this.delay)
    })
  }

  private async flush(): Promise<void> {
    if (this.queue.length === 0) return

    const batch = this.queue.splice(0)
    const keys = batch.map((item) => item.key)

    try {
      const results = await this.fetcher(keys)
      batch.forEach((item, index) => {
        item.resolve(results[index])
      })
    } catch (error) {
      batch.forEach((item) => {
        item.reject(error)
      })
    }
  }
}

/**
 * Request deduplication - prevent duplicate simultaneous requests
 */
export class RequestDeduplicator<T = any> {
  private cache: Map<string, Promise<T>> = new Map()

  async request(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (this.cache.has(key)) {
      return this.cache.get(key)!
    }

    const promise = fetcher()
      .then((result) => {
        this.cache.delete(key)
        return result
      })
      .catch((error) => {
        this.cache.delete(key)
        throw error
      })

    this.cache.set(key, promise)
    return promise
  }

  clear(): void {
    this.cache.clear()
  }
}

/**
 * Memory efficient cache with LRU eviction
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>
  private readonly maxSize: number

  constructor(maxSize: number = 100) {
    this.cache = new Map()
    this.maxSize = maxSize
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined

    // Move to end (most recently used)
    const value = this.cache.get(key)!
    this.cache.delete(key)
    this.cache.set(key, value)
    return value
  }

  set(key: K, value: V): void {
    // Remove if exists (to re-add at end)
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    this.cache.set(key, value)

    // Evict oldest if over capacity
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }
}

/**
 * Retry failed requests with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelay?: number
    maxDelay?: number
    factor?: number
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2,
  } = options

  let lastError: any
  let delay = initialDelay

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (i === maxRetries) {
        throw lastError
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay))

      // Exponential backoff
      delay = Math.min(delay * factor, maxDelay)
    }
  }

  throw lastError
}

/**
 * Timeout wrapper for promises
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: Error = new Error('Request timeout')
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(timeoutError), timeoutMs)
    ),
  ])
}

/**
 * Throttle function execution
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean

  return function (this: any, ...args: Parameters<T>): void {
    if (!inThrottle) {
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
      func.apply(this, args)
    }
  }
}

/**
 * Debounce function execution
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function (this: any, ...args: Parameters<T>): void {
    if (timeout) clearTimeout(timeout)

    timeout = setTimeout(() => {
      func.apply(this, args)
    }, wait)
  }
}

/**
 * Check if code is running on server or client
 */
export const isServer = typeof window === 'undefined'
export const isClient = !isServer

/**
 * Check if browser supports a feature
 */
export function supportsFeature(feature: string): boolean {
  if (isServer) return false

  switch (feature) {
    case 'webp':
      return document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0
    case 'avif':
      return document.createElement('canvas').toDataURL('image/avif').indexOf('data:image/avif') === 0
    case 'intersection-observer':
      return 'IntersectionObserver' in window
    case 'performance-observer':
      return 'PerformanceObserver' in window
    case 'web-vitals':
      return 'PerformanceObserver' in window && 'PerformanceLongTaskTiming' in window
    default:
      return false
  }
}
