import type { NextConfig } from 'next'
import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Experimental features
  experimental: {
    // Enable server actions
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // Optimize package imports to reduce bundle size
    // Note: Radix UI packages are excluded due to import errors with optimization
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
    ],
  },

  // Server external packages (moved from experimental)
  serverExternalPackages: [
    '@prisma/client',
    'bcrypt',
    'pdf-lib',
    'mammoth',
    'docxtemplater',
    'html-pdf-node',
    '@supabase/realtime-js',
    '@supabase/supabase-js',
    '@supabase/ssr',
    '@deepgram/sdk',
    '@deepgram/captions',
    '@google-cloud/speech',
    '@google-cloud/common',
    'assemblyai',
    'protobufjs',
    'tar-stream',
    'streamx',
  ],

  // Image optimization for Core Web Vitals (LCP)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },

  // Compress output
  compress: true,
  // Production source maps for debugging
  productionBrowserSourceMaps: false,

  // Webpack configuration
  webpack: (config, { dev, isServer }) => {
    // Fix for Windows case-sensitivity issues
    config.resolve.symlinks = false

    // Suppress specific warnings
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      // Suppress webpack cache serialization warnings for large strings
      /Serializing big strings/,
    ]

    // Externalize heavy server-only packages and optional dependencies
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
    })

    // Tree shaking for large libraries
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // Reduce bundle size by using lighter alternatives where possible
        '@aws-sdk/client-s3': false,
      }
    }

    // Enable module concatenation for better minification
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
      ...(dev
        ? {}
        : {
            splitChunks: {
              chunks: 'all',
              cacheGroups: {
                // Separate vendor chunks for better caching
                default: false,
                vendors: false,
                // Framework chunk (React, Next.js)
                framework: {
                  name: 'framework',
                  test: /[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-sync-external-store)[\\/]/,
                  priority: 40,
                  enforce: true,
                },
                // Large third-party libraries
                lib: {
                  test: /[\\/]node_modules[\\/]/,
                  name(module: any) {
                    const packageName = module.context.match(
                      /[\\/]node_modules[\\/](.*?)([\\/]|$)/
                    )?.[1]
                    return `npm.${packageName?.replace('@', '')}`
                  },
                  priority: 30,
                  minChunks: 1,
                  reuseExistingChunk: true,
                },
                // Common chunks used across pages
                commons: {
                  name: 'commons',
                  minChunks: 2,
                  priority: 20,
                },
              },
            },
          }),
    }

    return config
  },

  // Headers for security and caching (improves CLS)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}

export default withBundleAnalyzer(nextConfig)
