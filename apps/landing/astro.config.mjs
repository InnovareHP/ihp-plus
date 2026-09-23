// @ts-check
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Pure static marketing site — nginx serves dist/ directly.
  output: 'static',
  // The marketing domain, baked into canonical, Open Graph and sitemap URLs; the portal has its own.
  site: 'https://www.ihpplusglobal.com',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
  server: {
    port: 4321,
    host: true,
  },
})
