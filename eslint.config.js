import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  // `.claude/worktrees` holds nested git worktrees — full checkouts of this
  // same repo. Without ignoring them ESLint lints every copy, and having
  // several candidate tsconfig roots on disk makes typescript-eslint fail to
  // resolve one at all ("multiple candidate TSConfigRootDirs are present"),
  // which turns every file in the real source tree into a parsing error.
  globalIgnores(['dist', '.claude', 'src/components/ui']),
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['src/components/ui/**'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      eslintConfigPrettier,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
]);
