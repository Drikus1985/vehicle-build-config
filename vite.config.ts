import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// DEMO_SINGLE_FILE=1 (scripts/build-demo.mjs) produces one JS bundle with no
// lazy chunks, so the whole app can be inlined into a single shareable file.
const singleFile = process.env.DEMO_SINGLE_FILE === '1';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: singleFile ? 4000 : 1200,
    rollupOptions: {
      output: singleFile
        ? { inlineDynamicImports: true }
        : {
            manualChunks: {
              three: ['three'],
              r3f: ['@react-three/fiber', '@react-three/drei'],
            },
          },
    },
  },
});
