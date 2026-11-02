import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import astro from 'eslint-plugin-astro';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  ...astro.configs.recommended,
  {
    // Node ESM tooling (site-contract/verification/format helpers and the
    // Node test-runner tests). These run outside the browser, so Node globals
    // must be declared rather than disabled.
    files: ['scripts/**/*.mjs', 'tests/site/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        Buffer: 'readonly',
      },
    },
  },
  {
    // eslint-plugin-astro exposes client-side <script> content as virtual
    // `*.astro/*.ts` files. Configure the placeholder-name policy there too,
    // otherwise the core rule cannot ignore intentionally unused type
    // parameter names while still catching real unused variables.
    files: ['*.astro/*.js', '*.astro/*.ts', '**/*.astro/*.js', '**/*.astro/*.ts'],
    rules: {
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'all' },
      ],
    },
  },
  {
    files: ['**/*.astro'],
    plugins: {
      'jsx-a11y': jsxA11y,
    },
    rules: {
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/anchor-has-content': 'warn',
      // Allow intentionally unused placeholder parameter names in type
      // signatures (e.g. the Plyr constructor shape in VideoEmbed.astro).
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: [
      'dist/**',
      '.astro/**',
      'node_modules/**',
      'public/_pagefind/**',
      // Ignored local editor caches: do not delete them, do not lint them.
      '.obsidian/**',
      '**/.obsidian/**',
      '.idea/**',
      // Generated/test fixture trees (built by tests, not maintained code).
      'tests/site/fixtures/**',
      // Agent worktrees and local package-manager caches.
      '.teammates/**',
      '.bun-install/**',
      '.bun-tmp/**',
    ],
  },
];
