import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { defineConfig } from 'vite';

// every built model (and the data built alongside, tools/changes.mjs) with a short hash of its contents: added to the model's URL so browsers fetch it
// again whenever it changes, and robots whose model isn't built yet show as coming soon
const dir = new URL('./public/model/', import.meta.url);
const models = Object.fromEntries(readdirSync(dir).filter((f) => /\.(glb|json)$/.test(f))
  .map((f) => [f, createHash('sha1').update(readFileSync(new URL(f, dir))).digest('hex').slice(0, 10)]));

export default defineConfig({
  base: './', // relative paths: works at user.github.io/repo/, a custom domain, or locally
  define: { 'import.meta.env.VITE_MODELS': JSON.stringify(JSON.stringify(models)) },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 }, // three.js is most of the bundle
  // the list above is read once, so start over when a model is built or added while `npm run dev` runs
  plugins: [{
    name: 'reload-models',
    configureServer(server) {
      const restart = (file) => { if (/\/public\/model\/[^/]+\.(glb|json)$/.test(file.replace(/\\/g, '/'))) server.restart(); };
      server.watcher.on('add', restart).on('change', restart).on('unlink', restart);
    },
  }],
});
