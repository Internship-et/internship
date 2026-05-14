/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: false,
  extends: ['../../.eslintrc.js'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    // API-specific rules can go here
  },
};
