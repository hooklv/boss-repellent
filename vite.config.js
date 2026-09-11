import { defineConfig } from 'vite';

// GitHub Pages serves the app from https://<user>.github.io/<repo>/
export default defineConfig({
  base: '/boss-repellent/',
  build: { chunkSizeWarningLimit: 2000 }
});
