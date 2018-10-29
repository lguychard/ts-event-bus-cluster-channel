module.exports = {
  tabWidth: 4,
  printWidth: 80,
  proseWrap: 'preserve',
  semi: false,
  trailingComma: 'all',
  singleQuote: true,
  overrides: [
    {
      files: '{*.js?(on),*.y?(a)ml,.*.js?(on),.*.y?(a)ml,*.md,.prettierrc,.stylelintrc,.babelrc}',
      options: {
        tabWidth: 2,
      },
    },
  ],
}
