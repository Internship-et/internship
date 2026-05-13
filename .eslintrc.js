/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // No `any` types
    '@typescript-eslint/no-explicit-any': 'error',

    // No `// @ts-ignore`
    '@typescript-eslint/ban-ts-comment': [
      'error',
      { 'ts-ignore': 'allow-with-description' },
    ],

    // No unused variables
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],

    // Prefer `const` over `let`
    'prefer-const': 'error',

    // No console.log (use logger)
    'no-console': 'warn',

    // Consistent return
    'consistent-return': 'error',

    // Require === and !==
    eqeqeq: ['error', 'always'],

    // No var
    'no-var': 'error',

    // Curly braces for all control statements
    curly: ['error', 'all'],
  },
  ignorePatterns: ['dist', 'node_modules', '.turbo', '*.js'],
};
