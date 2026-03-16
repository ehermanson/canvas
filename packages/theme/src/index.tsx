import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export function createAppThemeScope(options: {
  defaultTheme?: Theme;
  legacyStorageKeys?: string[];
  storageKey: string;
}) {
  const { defaultTheme = "dark", legacyStorageKeys = [], storageKey } = options;
  const ThemeContext = createContext<ThemeContextValue | null>(null);

  function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(() => {
      if (typeof window === "undefined") {
        return defaultTheme;
      }

      const saved = window.localStorage.getItem(storageKey);
      if (saved === "light" || saved === "dark") {
        return saved;
      }

      for (const legacyStorageKey of legacyStorageKeys) {
        const legacySaved = window.localStorage.getItem(legacyStorageKey);
        if (legacySaved === "light" || legacySaved === "dark") {
          return legacySaved;
        }
      }

      return defaultTheme;
    });

    useEffect(() => {
      window.localStorage.setItem(storageKey, theme);
      for (const legacyStorageKey of legacyStorageKeys) {
        window.localStorage.removeItem(legacyStorageKey);
      }

      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }, [legacyStorageKeys, storageKey, theme]);

    const value: ThemeContextValue = {
      setTheme: (nextTheme) => {
        setThemeState(nextTheme);
      },
      theme,
      toggleTheme: () => {
        setThemeState((current) => (current === "dark" ? "light" : "dark"));
      },
    };

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
  }

  function useTheme() {
    const context = useContext(ThemeContext);

    if (!context) {
      throw new Error("useTheme must be used within a ThemeProvider");
    }

    return context;
  }

  return { ThemeProvider, useTheme };
}
