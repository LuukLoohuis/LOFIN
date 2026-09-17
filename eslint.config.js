import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  // De edge functions draaien op Deno, met hun eigen imports en globals.
  globalIgnores(['dist', 'coverage', 'eslint.config.js', 'supabase/functions']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    // De rekenkern is puur en deterministisch: geen UI, geen opslag, geen klok of toeval.
    files: ['src/engine/**/*.ts'],
    ignores: ['src/engine/**/__tests__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-*', '@supabase/*', '@/*', '../../*/**', '!../../engine/**'],
              message: 'De rekenkern importeert alleen uit src/engine.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "NewExpression[callee.name='Date']", message: 'Geen klok in de rekenkern.' },
        { selector: "MemberExpression[object.name='Date']", message: 'Geen klok in de rekenkern.' },
        { selector: "MemberExpression[object.name='Math'][property.name='random']", message: 'Geen toeval in de rekenkern.' },
      ],
    },
  },
]);
