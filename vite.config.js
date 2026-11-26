import path from 'node:path';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const appRoot = path.dirname(fileURLToPath(import.meta.url));

let buildSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || '';
if (!buildSha) {
  try {
    buildSha = execSync('git rev-parse --short HEAD', { cwd: appRoot, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    /* no git */
  }
}
buildSha = buildSha || 'dev';
const pkg = JSON.parse(readFileSync(path.join(appRoot, 'package.json'), 'utf8'));

export default defineConfig({
  root: appRoot,
  plugins: [react(), tailwindcss()],
  base: './',
  define: {
    __APP_BUILD_SHA__: JSON.stringify(buildSha),
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  build: {
    outDir: path.join(appRoot, 'dist'),
    emptyOutDir: true,
  },
});
