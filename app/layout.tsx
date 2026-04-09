import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { QueryProvider } from '../src/lib/react-query/QueryProvider'
import { AuthProvider } from '../src/context/SupabaseAuthContext'
import { Toaster } from '../src/components/ui/toaster'
import '../src/lib/utils/suppressAuthWarnings'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Jigri',
  description: 'A social media application powered by Next.js and Supabase',
  icons: {
    icon: '/assets/images/tablogo.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
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
