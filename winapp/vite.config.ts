import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()], 
  base: './',
  build: {
    outDir:'dist-react'
  },
  server: {
    port: 24000,
    strictPort: true
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/ui/test/setupTests.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage'
    }
  }
})
