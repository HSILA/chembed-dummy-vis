import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'ChEmbed checkpoint explorer',
  description: 'Interactive dashboard for comparing ChEmbed checkpoint performance across tasks, learning rates, and epochs.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
