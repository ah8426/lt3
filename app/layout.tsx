import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { WebVitals } from '@/components/web-vitals'
import { Providers } from '@/components/providers'
import './globals.css'

// Optimized font loading with display swap and subset
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  variable: '--font-inter',
  adjustFontFallback: true,
})

export const metadata: Metadata = {
  title: {
    default: 'Law Transcribed - AI-Powered Legal Dictation',
    template: '%s | Law Transcribed',
  },
  description: 'Professional-grade voice dictation and AI assistance for attorneys',
  keywords: ['legal dictation', 'AI transcription', 'attorney software', 'voice recognition'],
  authors: [{ name: 'Law Transcribed' }],
  creator: 'Law Transcribed',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Law Transcribed',
    title: 'Law Transcribed - AI-Powered Legal Dictation',
    description: 'Professional-grade voice dictation and AI assistance for attorneys',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Law Transcribed',
    description: 'Professional-grade voice dictation and AI assistance for attorneys',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#00BFA5' },
    { media: '(prefers-color-scheme: dark)', color: '#1E3A8A' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect to critical origins with rel="preconnect" required by Next.js */}
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>
          <WebVitals />
          {children}
        </Providers>
      </body>
    </html>
  )
}
