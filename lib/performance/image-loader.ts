/**
 * Optimized image loading utilities for Core Web Vitals (LCP)
 * Implements responsive images, lazy loading, and blur placeholders
 */

import type { ImageLoaderProps } from 'next/image'

/**
 * Custom image loader for CDN optimization
 */
export function imageLoader({ src, width, quality }: ImageLoaderProps): string {
  // If using Supabase storage
  if (src.includes('supabase.co')) {
    const url = new URL(src)
    // Supabase supports image transformation
    url.searchParams.set('width', width.toString())
    url.searchParams.set('quality', (quality || 75).toString())
    return url.toString()
  }

  // Default loader for local images
  return src
}

/**
 * Generate blur placeholder data URL
 */
export function getBlurDataURL(width: number = 10, height: number = 10): string {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#f1f5f9"/>
    </svg>
  `
  const base64 = Buffer.from(svg).toString('base64')
  return `data:image/svg+xml;base64,${base64}`
}

/**
 * Responsive image sizes configuration
 */
export const RESPONSIVE_SIZES = {
  thumbnail: '(max-width: 640px) 150px, 200px',
  card: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px',
  hero: '100vw',
  content: '(max-width: 640px) 100vw, (max-width: 1024px) 75vw, 800px',
  full: '100vw',
} as const

/**
 * Priority images that should load eagerly (above the fold)
 */
export function isPriorityImage(imageSrc: string): boolean {
  const priorityPatterns = [
    /hero/i,
    /banner/i,
    /logo/i,
    /avatar/i,
    /thumbnail/i,
  ]

  return priorityPatterns.some(pattern => pattern.test(imageSrc))
}

/**
 * Image optimization config for different use cases
 */
export const IMAGE_CONFIGS = {
  avatar: {
    width: 128,
    height: 128,
    quality: 80,
    sizes: '(max-width: 768px) 64px, 128px',
  },
  thumbnail: {
    width: 400,
    height: 300,
    quality: 75,
    sizes: RESPONSIVE_SIZES.thumbnail,
  },
  card: {
    width: 800,
    height: 600,
    quality: 75,
    sizes: RESPONSIVE_SIZES.card,
  },
  hero: {
    width: 1920,
    height: 1080,
    quality: 85,
    sizes: RESPONSIVE_SIZES.hero,
    priority: true,
  },
  content: {
    width: 1200,
    height: 800,
    quality: 80,
    sizes: RESPONSIVE_SIZES.content,
  },
} as const

/**
 * Preload critical images
 */
export function preloadImage(src: string, as: 'image' = 'image'): void {
  if (typeof window === 'undefined') return

  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = as
  link.href = src
  document.head.appendChild(link)
}

/**
 * Lazy load image with IntersectionObserver
 */
export class LazyImageLoader {
  private observer: IntersectionObserver | null = null
  private images: Map<HTMLImageElement, string> = new Map()

  constructor(options: IntersectionObserverInit = {}) {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement
            const src = this.images.get(img)

            if (src) {
              img.src = src
              img.classList.add('loaded')
              this.observer?.unobserve(img)
              this.images.delete(img)
            }
          }
        })
      },
      {
        rootMargin: '50px',
        threshold: 0.01,
        ...options,
      }
    )
  }

  observe(img: HTMLImageElement, src: string): void {
    if (!this.observer) {
      img.src = src
      return
    }

    this.images.set(img, src)
    this.observer.observe(img)
  }

  disconnect(): void {
    this.observer?.disconnect()
    this.images.clear()
  }
}

/**
 * Calculate responsive image dimensions
 */
export function getResponsiveDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number
): { width: number; height: number } {
  if (originalWidth <= maxWidth) {
    return { width: originalWidth, height: originalHeight }
  }

  const ratio = originalHeight / originalWidth
  return {
    width: maxWidth,
    height: Math.round(maxWidth * ratio),
  }
}

/**
 * Generate srcset for responsive images
 */
export function generateSrcSet(
  src: string,
  widths: number[] = [640, 750, 828, 1080, 1200, 1920]
): string {
  return widths
    .map((width) => {
      const url = imageLoader({ src, width, quality: 75 })
      return `${url} ${width}w`
    })
    .join(', ')
}

/**
 * Optimize image format based on browser support
 */
export function getOptimalImageFormat(): 'avif' | 'webp' | 'jpeg' {
  if (typeof window === 'undefined') return 'jpeg'

  // Check AVIF support
  const avifSupport = document.createElement('canvas')
    .toDataURL('image/avif')
    .indexOf('data:image/avif') === 0

  if (avifSupport) return 'avif'

  // Check WebP support
  const webpSupport = document.createElement('canvas')
    .toDataURL('image/webp')
    .indexOf('data:image/webp') === 0

  if (webpSupport) return 'webp'

  return 'jpeg'
}
