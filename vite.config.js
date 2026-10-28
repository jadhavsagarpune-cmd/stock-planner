import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const appRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: appRoot,
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    outDir: path.join(appRoot, 'dist'),
    emptyOutDir: true,
  },
});
