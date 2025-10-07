# Frontend Performance Optimization Guide

## Overview
This document outlines comprehensive performance optimizations implemented for the Law Transcribed application, targeting Core Web Vitals improvements and bundle size reduction.

---

## 1. Bundle Size Reduction Strategies

### 1.1 Package Import Optimization
**File:** `next.config.ts`

Configured `optimizePackageImports` for automatic tree-shaking:
- Radix UI components (20+ packages)
- lucide-react icons
- date-fns utilities

**Expected Impact:**
- Bundle size reduction: 30-40%
- Initial load time improvement: 1-2 seconds
- First Contentful Paint (FCP): < 1.8s

### 1.2 Code Splitting & Dynamic Imports
**File:** `lib/lazy-load.ts`

Implemented lazy loading for heavy components:
- Audio/Video components (wavesurfer.js, recordrtc)
- PDF/Document viewers (pdf-lib, mammoth)
- Data tables (tanstack table)
- Charts and visualizations
- Rich text editors

**Usage:**
```typescript
import { AudioRecorder, PDFViewer } from '@/lib/lazy-load'

// Components load only when needed
<AudioRecorder />
```

**Expected Impact:**
- Initial bundle reduction: 500KB - 1MB
- Time to Interactive (TTI): 2-3s improvement
- Main thread blocking: -40%

### 1.3 Webpack Optimization
**File:** `next.config.ts`

Custom splitChunks configuration:
- Separate framework chunk (React, Next.js)
- Vendor chunks per package
- Common chunks for shared code
- Deterministic module IDs for better caching

**Expected Impact:**
- Cache hit rate: +60%
- Return visitor load time: -50%
- Long-term caching effectiveness: Improved

### 1.4 Server Components External Packages
Moved heavy packages to server-only execution:
- @prisma/client
- bcrypt
- pdf-lib
- mammoth
- docxtemplater
- html-pdf-node

**Expected Impact:**
- Client bundle reduction: 2-3MB
- JavaScript execution time: -30%

---

## 2. Lazy Loading Implementation

### 2.1 Component-Level Lazy Loading
**File:** `lib/lazy-load.ts`

Three lazy loading strategies:

1. **Standard Lazy Load**
   ```typescript
   const MyComponent = lazyLoad(() => import('@/components/my-component'))
   ```

2. **Client-Only Lazy Load**
   ```typescript
   const AudioRecorder = lazyLoad(
     () => import('@/components/audio-recorder'),
     { ssr: false }
   )
   ```

3. **Route-Based Code Splitting**
   ```typescript
   import { routeComponents } from '@/lib/lazy-load'

   const DashboardOverview = routeComponents.dashboard.Overview
   ```

### 2.2 Intersection Observer Hook
**File:** `lib/performance/hooks.ts`

Load components when they enter viewport:
```typescript
const [ref, isIntersecting] = useIntersectionObserver()

<div ref={ref}>
  {isIntersecting && <HeavyComponent />}
</div>
```

**Expected Impact:**
- Above-the-fold load time: -40%
- Largest Contentful Paint (LCP): < 2.5s
- Initial JavaScript execution: -50%

---

## 3. Rendering Optimization

### 3.1 Font Loading Optimization
**File:** `app/layout.tsx`

Optimized Inter font loading:
- Display swap strategy (prevents FOIT)
- Preload enabled
- Adjust font fallback
- Font variable for CSS
- DNS prefetch & preconnect

**Expected Impact:**
- Cumulative Layout Shift (CLS): < 0.1
- Font load time: -200ms
- Text rendering delay: Eliminated

### 3.2 Performance Monitoring Hooks
**File:** `lib/performance/hooks.ts`

Custom hooks for optimization:

1. **usePerformanceMonitor**: Track component lifecycle
2. **useDebouncedValue**: Prevent unnecessary re-renders
3. **useIntersectionObserver**: Viewport-based rendering
4. **usePrefetch**: Prefetch on hover
5. **useDeepMemo**: Optimized object comparison

**Usage:**
```typescript
// Debounce expensive operations
const debouncedSearch = useDebouncedValue(searchTerm, 300)

// Prefetch on hover
const prefetch = usePrefetch(() => fetchData(id))
<Link onMouseEnter={prefetch}>
```

### 3.3 React 19 Concurrent Features
Leveraging React 19 capabilities:
- startTransition for non-urgent updates
- Suspense boundaries for streaming
- Server Components for zero-JS pages
- Optimistic updates with useOptimistic

---

## 4. Core Web Vitals (LCP, FID, CLS)

### 4.1 Largest Contentful Paint (LCP)
**Target:** < 2.5 seconds

**Optimizations:**
1. **Image Optimization** (`lib/performance/image-loader.ts`)
   - AVIF/WebP format support
   - Responsive image sizes
   - Priority loading for above-fold images
   - Blur placeholders

2. **Resource Hints**
   - DNS prefetch for external domains
   - Preconnect to critical origins
   - Preload critical resources

3. **Server Components**
   - Static generation where possible
   - Streaming with Suspense
   - Edge runtime for middleware

**Expected LCP Score:**
- Desktop: 1.5 - 2.0s (Good)
- Mobile: 2.0 - 2.5s (Good)

### 4.2 First Input Delay (FID) / Interaction to Next Paint (INP)
**Target:** < 100ms (FID), < 200ms (INP)

**Optimizations:**
1. **Long Task Monitoring**
   - Automatic detection of tasks > 50ms
   - Console warnings for optimization opportunities

2. **Code Splitting**
   - Defer non-critical JavaScript
   - Reduce main thread blocking

3. **Debouncing & Throttling**
   - Event handler optimization
   - Prevent excessive re-renders

**Expected FID/INP Score:**
- Desktop: 50-80ms (Good)
- Mobile: 80-150ms (Good)

### 4.3 Cumulative Layout Shift (CLS)
**Target:** < 0.1

**Optimizations:**
1. **Font Display Swap**
   - Prevents invisible text flash
   - Fallback font matching

2. **Image Size Reservations**
   - Width/height attributes
   - Aspect ratio preservation
   - Skeleton loaders

3. **Dynamic Content**
   - Reserved space for ads/embeds
   - Smooth transitions with CSS

**Expected CLS Score:**
- Desktop: 0.05 - 0.08 (Good)
- Mobile: 0.06 - 0.10 (Good)

---

## 5. Network Request Optimization

### 5.1 Request Batching
**File:** `lib/performance/index.ts`

Batch multiple requests into single network call:
```typescript
const batcher = new RequestBatcher(fetchMultiple, 10)

// Multiple calls batched automatically
const data1 = await batcher.request('key1')
const data2 = await batcher.request('key2')
```

**Expected Impact:**
- Network requests: -70%
- API latency: -40%
- Server load: -60%

### 5.2 Request Deduplication
Prevent duplicate simultaneous requests:
```typescript
const deduplicator = new RequestDeduplicator()

// Second call reuses first call's promise
const data1 = await deduplicator.request('user', fetchUser)
const data2 = await deduplicator.request('user', fetchUser) // No new fetch
```

### 5.3 LRU Cache
Memory-efficient caching with automatic eviction:
```typescript
const cache = new LRUCache<string, UserData>(100)

cache.set('user:1', userData)
const user = cache.get('user:1')
```

### 5.4 Retry with Exponential Backoff
Resilient network requests:
```typescript
const data = await retryWithBackoff(() => fetchData(), {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
})
```

### 5.5 HTTP Headers for Caching
**File:** `next.config.ts`

Optimized cache headers:
- Static assets: 1 year immutable cache
- Fonts: 1 year immutable cache
- DNS prefetch control
- Security headers

**Expected Impact:**
- Return visitor load: -80%
- CDN cache hit rate: +90%
- Bandwidth costs: -70%

---

## 6. Bundle Analysis

### 6.1 Bundle Analyzer Setup
**Command:** `pnpm run build:analyze`

Analyzes:
- Bundle composition
- Package sizes
- Duplicate dependencies
- Tree-shaking effectiveness

### 6.2 Key Metrics to Monitor
1. **First Load JS**: Should be < 200KB
2. **Total Bundle Size**: Target < 1MB
3. **Chunk Count**: Aim for 10-15 chunks
4. **Duplicate Packages**: Should be 0

### 6.3 Optimization Workflow
1. Run `pnpm run build:analyze`
2. Identify large packages
3. Consider alternatives or lazy loading
4. Re-analyze and compare

---

## 7. Performance Monitoring

### 7.1 Web Vitals Tracking
**File:** `lib/performance/web-vitals.ts`

Automatic tracking of:
- LCP (Largest Contentful Paint)
- FID (First Input Delay)
- CLS (Cumulative Layout Shift)
- FCP (First Contentful Paint)
- TTFB (Time to First Byte)
- INP (Interaction to Next Paint)

### 7.2 Integration
**File:** `components/web-vitals.tsx`

Automatically reports metrics to:
- Console (development)
- Analytics endpoint (production)
- Google Analytics 4 (if configured)

### 7.3 Custom Analytics Endpoint
Create: `app/api/analytics/web-vitals/route.ts`

```typescript
export async function POST(req: Request) {
  const metrics = await req.json()

  // Store in database or send to analytics service
  await storeMetrics(metrics)

  return Response.json({ success: true })
}
```

---

## 8. Image Optimization

### 8.1 Next.js Image Component
Use optimized Image component:
```typescript
import Image from 'next/image'
import { IMAGE_CONFIGS } from '@/lib/performance/image-loader'

<Image
  src="/hero.jpg"
  alt="Hero"
  {...IMAGE_CONFIGS.hero}
  priority // For above-fold images
/>
```

### 8.2 Responsive Images
Automatic srcset generation:
```typescript
import { generateSrcSet, RESPONSIVE_SIZES } from '@/lib/performance/image-loader'

<img
  srcSet={generateSrcSet('/image.jpg')}
  sizes={RESPONSIVE_SIZES.content}
/>
```

### 8.3 Lazy Loading
Images automatically lazy load below the fold with loading="lazy"

---

## 9. Build Configuration

### 9.1 Production Optimizations
**File:** `next.config.ts`

Enabled in production:
- Compression (gzip/brotli)
- CSS optimization
- Minification
- Tree shaking

### 9.2 TypeScript Configuration
**File:** `tsconfig.json`

Performance settings:
- Incremental compilation
- Skip lib check
- Bundler module resolution

---

## 10. Monitoring & Maintenance

### 10.1 Performance Budget
Set performance budgets:
- First Load JS: < 200KB
- LCP: < 2.5s
- FID: < 100ms
- CLS: < 0.1

### 10.2 Regular Audits
Run regularly:
- Lighthouse CI
- Bundle analysis
- Web Vitals monitoring
- Playwright performance tests

### 10.3 Continuous Optimization
Monthly tasks:
1. Review bundle analysis
2. Update dependencies
3. Remove unused code
4. Optimize images
5. Review Web Vitals scores

---

## 11. Expected Overall Impact

### Before Optimization (Estimated)
- First Load JS: 400-600KB
- LCP: 3-4s
- FID: 150-300ms
- CLS: 0.15-0.25
- Lighthouse Score: 60-70

### After Optimization (Target)
- First Load JS: 150-200KB (**-60%**)
- LCP: 1.5-2.5s (**-40%**)
- FID/INP: 50-150ms (**-50%**)
- CLS: 0.05-0.10 (**-60%**)
- Lighthouse Score: 90-100 (**+40%**)

### Business Impact
- User engagement: +15-25%
- Bounce rate: -20-30%
- Conversion rate: +10-20%
- SEO ranking: Improved
- Mobile performance: 2x faster

---

## 12. Quick Start Commands

```bash
# Development with performance monitoring
pnpm dev

# Build with bundle analysis
pnpm run build:analyze

# Production build
pnpm build

# Type checking
pnpm type-check

# Run tests
pnpm test
```

---

## 13. Resources

- [Next.js Performance Docs](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Web Vitals](https://web.dev/vitals/)
- [React Performance](https://react.dev/learn/render-and-commit)
- [Bundle Analysis Guide](https://nextjs.org/docs/app/building-your-application/optimizing/bundle-analyzer)

---

## 14. Support

For issues or questions:
1. Check bundle analysis output
2. Review Web Vitals metrics
3. Inspect Network tab in DevTools
4. Use React DevTools Profiler
5. Consult Next.js documentation

---

**Last Updated:** 2025-10-07
**Version:** 1.0.0
