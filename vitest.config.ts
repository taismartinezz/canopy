import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    // Node v25 enables --experimental-require-module by default, which causes
    // vitest fork workers to hang on startup. Passing the flag only to fork
    // children (not the main process) restores correct worker IPC without
    // breaking jsdom's ESM-require interop in Vite's transform pipeline.
    pool: 'forks',
    // @ts-expect-error -- poolOptions removed from types in v4 but runtime still
    // reads it; needed to pass --no-experimental-require-module only to workers.
    poolOptions: { forks: { execArgv: ['--no-experimental-require-module'] } },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
