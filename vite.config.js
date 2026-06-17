import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  server: {
    port: 5199,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        flight: resolve(__dirname, 'flight.html'),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.js'],
  },
})
