import { createAppThemeScope } from '@canvas-tools/theme';

const { ThemeProvider, useTheme } = createAppThemeScope({
  storageKey: 'room-planner-theme',
});

export { ThemeProvider, useTheme };
