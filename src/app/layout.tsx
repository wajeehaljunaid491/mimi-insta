import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from '@/components/providers'

export const metadata: Metadata = {
  title: 'Mimi Insta - Social Calling Platform',
  description: 'Professional Instagram-style calling system with real-time communication',
  keywords: ['social media', 'video calls', 'voice calls', 'real-time', 'webrtc'],
  authors: [{ name: 'Mimi Insta Team' }],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#667eea',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
