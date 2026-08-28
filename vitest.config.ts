import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      // Nested git worktrees (manual fallback under .worktrees/, or the
      // native EnterWorktree tool's .claude/worktrees/ — see .gitignore)
      // contain their own full src/ tree with their own test files —
      // without this, running from the main checkout picks those up too,
      // loading a second copy of every module (React, signals, etc.)
      // alongside the real one and causing spurious cross-instance failures.
      exclude: [...configDefaults.exclude, '**/.worktrees/**', '**/.claude/worktrees/**'],
    },
  }),
);
