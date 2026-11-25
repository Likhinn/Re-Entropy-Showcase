import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// added to the model's URL so browsers fetch it again whenever it changes
const modelVersion = createHash('sha1').update(readFileSync(new URL('./public/model/robot.glb', import.meta.url))).digest('hex').slice(0, 10);

export default defineConfig({
  base: './', // relative paths: works at user.github.io/repo/, a custom domain, or locally
  define: { 'import.meta.env.VITE_MODEL_VERSION': JSON.stringify(modelVersion) },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 }, // three.js is most of the bundle
});
