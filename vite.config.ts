import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Reality — «Это вода»: dev-сервер на :1836, статическая сборка в dist
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 1836,
    strictPort: true,
  },
  preview: {
    port: 1836,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
