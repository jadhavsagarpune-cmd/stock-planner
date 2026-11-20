import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const appRoot = path.dirname(fileURLToPath(import.meta.url));

let buildSha = 'dev';
try {
  buildSha = execSync('git rev-parse --short HEAD', { cwd: appRoot })
    .toString()
    .trim();
} catch {
  buildSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev';
}

export default defineConfig({
  root: appRoot,
  plugins: [react(), tailwindcss()],
  base: './',
  define: {
    __APP_BUILD_SHA__: JSON.stringify(buildSha),
  },
  build: {
    outDir: path.join(appRoot, 'dist'),
    emptyOutDir: true,
  },
});
