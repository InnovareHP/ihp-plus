// @ts-check
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Pure static marketing site — nginx serves dist/ directly.
  output: 'static',
  // Canonical, Open Graph and sitemap URLs need the public origin, which landing and app share.
  site: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
  server: {
    port: 4321,
    host: true,
  },
})
