import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // relative paths: works at user.github.io/repo/, a custom domain, or locally
  build: { target: 'es2022', chunkSizeWarningLimit: 900 }, // three.js is most of the bundle
});
