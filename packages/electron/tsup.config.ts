import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/main/index.ts'],
    outDir: 'dist/main',
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    external: ['electron', 'better-sqlite3'],
    clean: true,
    sourcemap: true,
  },
  {
    entry: ['src/preload/index.ts'],
    outDir: 'dist/preload',
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    external: ['electron'],
    clean: true,
    sourcemap: true,
  },
]);
