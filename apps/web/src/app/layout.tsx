import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core'
import type { Metadata, Viewport } from 'next'
import { Providers } from '@/components/providers'
import { RouteAnnouncer } from '@/components/route-announcer'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'IHP Plus', template: '%s · IHP Plus' },
  description: 'IHP Plus application portal',
  applicationName: 'IHP Plus',
  manifest: 'manifest.webmanifest',
}

export const viewport: Viewport = {
  // The brand blue tints mobile browser chrome; the canvas tone does the same in dark mode.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1346c5' },
    { media: '(prefers-color-scheme: dark)', color: '#0b286b' },
  ],
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
      </head>
      <body>
        <Providers>
          <RouteAnnouncer />
          {children}
        </Providers>
      </body>
    </html>
  )
}
