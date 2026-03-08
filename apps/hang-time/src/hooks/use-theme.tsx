import { createAppThemeScope } from '@canvas-tools/theme';

const { ThemeProvider, useTheme } = createAppThemeScope({
  storageKey: 'picture-hanging-theme',
});

export { ThemeProvider, useTheme };
