import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { QueryProvider } from '../src/lib/react-query/QueryProvider'
import { AuthProvider } from '../src/context/SupabaseAuthContext'
import { Toaster } from '../src/components/ui/toaster'
import '../src/lib/utils/suppressAuthWarnings'
import PWARegistration from '../src/components/shared/PWARegistration'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://jigri-social-media.vercel.app'),
  title: {
    default: 'Jigri',
    template: '%s | Jigri',
  },
  description: 'Jigri is a social-first web app with a fast, installable, app-like experience for mobile and desktop.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Jigri',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Jigri',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/assets/images/App%20Icon.svg', type: 'image/svg+xml' },
      { url: '/assets/images/tablogo.ico' },
    ],
    shortcut: ['/assets/images/App%20Icon.svg'],
    apple: [{ url: '/assets/images/App%20Icon.svg', type: 'image/svg+xml' }],
  },
  openGraph: {
    title: 'Jigri',
    description: 'Share moments, connect faster, and install Jigri for a real app-like experience on mobile and desktop.',
    siteName: 'Jigri',
    type: 'website',
    images: [
      {
        url: '/assets/images/App%20Icon.svg',
        width: 512,
        height: 512,
        alt: 'Jigri app icon',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Jigri',
    description: 'Share moments, connect faster, and install Jigri for a real app-like experience on mobile and desktop.',
    images: ['/assets/images/App%20Icon.svg'],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#7c3aed',
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <PWARegistration />
        <QueryProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
