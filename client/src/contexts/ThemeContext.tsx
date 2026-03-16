import React, { createContext, useContext, useEffect, useState } from "react";

export type AppTheme = "norfolk-ai" | "noir-dark";

interface ThemeContextType {
  appTheme: AppTheme;
  setAppTheme: (theme: AppTheme) => void;
  // Legacy light/dark compatibility
  theme: "light" | "dark";
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: "light" | "dark";
  switchable?: boolean;
}

const THEME_STORAGE_KEY = "ncg-app-theme";

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = true,
}: ThemeProviderProps) {
  const [appTheme, setAppThemeState] = useState<AppTheme>(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "norfolk-ai" || stored === "noir-dark") return stored;
    } catch {}
    return "norfolk-ai";
  });

  const theme: "light" | "dark" = appTheme === "noir-dark" ? "dark" : "light";

  useEffect(() => {
    const root = document.documentElement;
    // Remove all theme classes first
    root.classList.remove("dark", "norfolk-ai", "noir-dark");
    // Apply the correct theme classes
    root.classList.add(appTheme);
    if (appTheme === "noir-dark") {
      root.classList.add("dark");
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, appTheme);
    } catch {}
  }, [appTheme]);

  const setAppTheme = (t: AppTheme) => setAppThemeState(t);

  const toggleTheme = switchable
    ? () => setAppThemeState(prev => prev === "norfolk-ai" ? "noir-dark" : "norfolk-ai")
    : undefined;

  return (
    <ThemeContext.Provider value={{ appTheme, setAppTheme, theme, toggleTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
