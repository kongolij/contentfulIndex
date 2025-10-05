import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',            // ✅ important for apps hosted by Contentful
  build: { outDir: 'build' }
});