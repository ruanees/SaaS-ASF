import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // A aplicação inteira sobe no beforeAll; em máquina lenta passa dos 10 s padrão.
    hookTimeout: 60_000,
  },
});
