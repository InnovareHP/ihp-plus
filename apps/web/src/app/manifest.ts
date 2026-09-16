import type { MetadataRoute } from 'next'

// Icon and start URLs are relative so they resolve under the basePath the manifest is served at.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'IHP Plus',
    short_name: 'IHP+',
    description: 'IHP Plus application portal',
    start_url: './',
    display: 'standalone',
    background_color: '#f7f9fc',
    theme_color: '#1346c5',
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
