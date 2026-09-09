import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core'
import type { Metadata } from 'next'
import { Providers } from '@/components/providers'
import { RouteAnnouncer } from '@/components/route-announcer'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'IHP Plus', template: '%s · IHP Plus' },
  description: 'IHP Plus application portal',
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
