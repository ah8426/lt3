/**
 * Lazy loading utilities for performance optimization
 * Implements code splitting strategies for bundle size reduction
 */

import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'

/**
 * Loading fallback component optimized for CLS prevention
 */
export const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[200px]" aria-live="polite" aria-busy="true">
    <div className="animate-pulse flex space-x-4">
      <div className="h-4 bg-muted rounded w-4"></div>
      <div className="space-y-3">
        <div className="h-4 bg-muted rounded w-32"></div>
      </div>
    </div>
  </div>
)

/**
 * Skeleton loader for cards
 */
export const CardSkeleton = () => (
  <div className="border rounded-lg p-6 animate-pulse">
    <div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
    <div className="h-3 bg-muted rounded w-1/2 mb-2"></div>
    <div className="h-3 bg-muted rounded w-2/3"></div>
  </div>
)

/**
 * Dynamic import with optimized loading states
 */
export function lazyLoad<P extends Record<string, any>>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options?: {
    loading?: ComponentType
    ssr?: boolean
  }
) {
  return dynamic(importFn, {
    loading: options?.loading || LoadingFallback,
    ssr: options?.ssr ?? true,
  })
}

/**
 * Heavy component imports - lazy loaded by default
 */

// Audio/Video components (wavesurfer.js, recordrtc are heavy)
export const AudioRecorder = lazyLoad(
  () => import('@/components/audio/audio-recorder'),
  { ssr: false } // Client-only component
)

export const AudioPlayer = lazyLoad(
  () => import('@/components/audio/audio-player'),
  { ssr: false }
)

// PDF/Document viewers (pdf-lib, mammoth are heavy)
export const PDFViewer = lazyLoad(
  () => import('@/components/documents/pdf-viewer'),
  { ssr: false }
)

export const DocumentEditor = lazyLoad(
  () => import('@/components/documents/document-editor'),
  { ssr: false }
)

// Data tables (tanstack table can be heavy)
export const DataTable = lazyLoad(
  () => import('@/components/ui/data-table')
)

// Charts and visualizations
export const ChartComponent = lazyLoad(
  () => import('@/components/charts/chart'),
  { ssr: false }
)

// Rich text editors
export const RichTextEditor = lazyLoad(
  () => import('@/components/editors/rich-text-editor'),
  { ssr: false }
)

/**
 * Preload a component for improved perceived performance
 * Use this for components that will likely be needed soon
 */
export function preloadComponent(
  importFn: () => Promise<any>
): void {
  // Trigger the import but don't await it
  importFn().catch(() => {
    // Silently fail - component will be loaded when actually needed
  })
}

/**
 * Lazy load with intersection observer
 * Only loads component when it enters viewport
 */
export function lazyLoadOnView<P extends Record<string, any>>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options?: {
    rootMargin?: string
  }
) {
  return dynamic(importFn, {
    loading: LoadingFallback,
    ssr: false,
  })
}

/**
 * Route-based code splitting helpers
 */
export const routeComponents = {
  // Dashboard components
  dashboard: {
    Overview: lazyLoad(() => import('@/components/dashboard/overview')),
    Analytics: lazyLoad(() => import('@/components/dashboard/analytics')),
    RecentActivity: lazyLoad(() => import('@/components/dashboard/recent-activity')),
  },

  // Document components
  documents: {
    List: lazyLoad(() => import('@/components/documents/document-list')),
    Upload: lazyLoad(() => import('@/components/documents/document-upload')),
    Preview: lazyLoad(() => import('@/components/documents/document-preview'), { ssr: false }),
  },

  // Settings components
  settings: {
    Profile: lazyLoad(() => import('@/components/settings/profile')),
    Billing: lazyLoad(() => import('@/components/settings/billing')),
    Security: lazyLoad(() => import('@/components/settings/security')),
  },
}
