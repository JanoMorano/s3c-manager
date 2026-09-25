import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests for pure frontend modules (no DOM); e2e tests use Playwright.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    include: ['features/**/*.test.ts', 'app/**/*.test.ts'],
    environment: 'node',
  },
});
