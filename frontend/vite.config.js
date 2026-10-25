import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In development the React app runs on :5173 and forwards /api calls to the Python API on :8000.
// `vite build --mode demo` makes one self-contained script that answers the API in the browser.
export default defineConfig(({ mode }) => {
  const demo = mode === 'demo'
  return {
    plugins: [react()],
    define: demo ? { 'import.meta.env.VITE_DEMO': 'true' } : {},
    build: demo ? {
      outDir: 'dist-demo', cssCodeSplit: false,
      rollupOptions: { output: { format: 'iife', inlineDynamicImports: true, entryFileNames: 'demo.js', assetFileNames: 'demo[extname]' } },
    } : {},
    server: { proxy: { '/api': 'http://localhost:8000' } },
    preview: { proxy: { '/api': 'http://localhost:8000' } },
    test: { environment: 'jsdom', globals: true, setupFiles: './src/test-setup.js', css: false },
  }
})
