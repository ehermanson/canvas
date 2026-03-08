import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export function createAppThemeScope(options: {
  defaultTheme?: Theme;
  storageKey: string;
}) {
  const { defaultTheme = 'dark', storageKey } = options;
  const ThemeContext = createContext<ThemeContextValue | null>(null);

  function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(() => {
      if (typeof window === 'undefined') {
        return defaultTheme;
      }

      const saved = window.localStorage.getItem(storageKey);
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }

      return defaultTheme;
    });

    useEffect(() => {
      window.localStorage.setItem(storageKey, theme);

      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }, [storageKey, theme]);

    const value: ThemeContextValue = {
      setTheme: (nextTheme) => {
        setThemeState(nextTheme);
      },
      theme,
      toggleTheme: () => {
        setThemeState((current) => (current === 'dark' ? 'light' : 'dark'));
      },
    };

    return (
      <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    );
  }

  function useTheme() {
    const context = useContext(ThemeContext);

    if (!context) {
      throw new Error('useTheme must be used within a ThemeProvider');
    }

    return context;
  }

  return { ThemeProvider, useTheme };
}
