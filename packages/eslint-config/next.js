const { resolve } = require('node:path')

const project = resolve(process.cwd(), 'tsconfig.json')

/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: [
    '@rocketseat/eslint-config/react',
    'turbo',
    'plugin:@next/next/recommended',
    'prettier'
  ],
  rules: {
    'prettier/prettier': [
      'error',
      {
        singleQuote: true,
        semi: false,
        endOfLine: 'auto',
        trailingComma: 'none'
      }
    ]
  }
}
