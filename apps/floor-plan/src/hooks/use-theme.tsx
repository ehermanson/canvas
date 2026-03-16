import { createAppThemeScope } from "@canvas-tools/theme";

const { ThemeProvider, useTheme } = createAppThemeScope({
  legacyStorageKeys: ["room-planner-theme"],
  storageKey: "floor-planner-theme",
});

export { ThemeProvider, useTheme };
