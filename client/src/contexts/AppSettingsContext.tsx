/**
 * AppSettingsContext - Unified App Preferences
 *
 * Single source of truth for ALL app-wide settings:
 *   - Active named theme (manus | norfolk-ai | noir-dark)
 *   - Color mode (light | dark) - applies .dark class to <html>
 *   - Active icon set (phosphor-regular | phosphor-duotone)
 *
 * Replaces the former ThemeContext (light/dark toggle).
 * Persists to localStorage. Applies theme + color-mode classes to <html>.
 *
 * Usage:
 *   const { settings, updateSettings, toggleColorMode } = useAppSettings();
 *   updateSettings({ theme: "noir-dark", colorMode: "dark" });
 *
 * Migration note:
 *   - Former useTheme() → use useAppSettings(); access settings.colorMode
 *   - Former appTheme (light|dark) → settings.colorMode
 *   - Former ThemeProvider → replaced by AppSettingsProvider in main.tsx
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

// -- Types ---------------------------------------------------------------------

export type ThemeName = "manus" | "norfolk-ai" | "noir-dark";
export type ColorMode = "light" | "dark";
export type IconSetId = "phosphor-regular" | "phosphor-duotone";

export interface AppSettings {
  /** Named palette: controls brand colors and CSS variable set */
  theme: ThemeName;
  /** Light/dark mode: applies .dark class to <html> for Tailwind/shadcn */
  colorMode: ColorMode;
  /** Icon set: which Phosphor variant to use globally */
  iconSet: IconSetId;
  /** Preferred Gemini model for LLM calls (legacy — maps to primaryModel) */
  geminiModel: string;
  /** Primary LLM vendor ID (e.g. "google") */
  primaryVendor: string;
  /** Primary LLM model ID (e.g. "gemini-2.5-pro") */
  primaryModel: string;
  /** Whether to use a secondary LLM for research processes */
  secondaryLlmEnabled: boolean;
  /** Secondary LLM vendor ID */
  secondaryVendor: string;
  /** Secondary LLM model ID */
  secondaryModel: string;
  /** Authors view mode: card grid or accordion list */
  viewMode: "cards" | "accordion";
  /** Background color injected into AI portrait generation prompt (hex string, e.g. "#0091ae") */
  avatarBgColor: string;

  // ── Per-purpose AI model settings ──────────────────────────────────────────
  /** Avatar Generation: vendor ID (default: google) */
  avatarGenVendor: string;
  /** Avatar Generation: model ID (default: nano-banana) */
  avatarGenModel: string;
  /** Author Research: primary vendor ID */
  authorResearchVendor: string;
  /** Author Research: primary model ID */
  authorResearchModel: string;
  /** Author Research: secondary LLM enabled */
  authorResearchSecondaryEnabled: boolean;
  /** Author Research: secondary vendor ID */
  authorResearchSecondaryVendor: string;
  /** Author Research: secondary model ID */
  authorResearchSecondaryModel: string;
  /** Book Research: primary vendor ID */
  bookResearchVendor: string;
  /** Book Research: primary model ID */
  bookResearchModel: string;
  /** Book Research: secondary LLM enabled */
  bookResearchSecondaryEnabled: boolean;
  /** Book Research: secondary vendor ID */
  bookResearchSecondaryVendor: string;
  /** Book Research: secondary model ID */
  bookResearchSecondaryModel: string;
  /** Other AI tasks: vendor ID */
  otherAiVendor: string;
  /** Other AI tasks: model ID */
  otherAiModel: string;
  /** Other AI tasks: secondary LLM enabled */
  otherAiSecondaryEnabled: boolean;
  /** Other AI tasks: secondary vendor ID */
  otherAiSecondaryVendor: string;
  /** Other AI tasks: secondary model ID */
  otherAiSecondaryModel: string;
}

interface AppSettingsContextType {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  /** Convenience toggle for light ↔ dark */
  toggleColorMode: () => void;
}

// -- Defaults ------------------------------------------------------------------

const DEFAULT_SETTINGS: AppSettings = {
  theme: "manus",
  colorMode: "light",
  iconSet: "phosphor-regular",
  geminiModel: "gemini-2.5-flash",
  primaryVendor: "google",
  primaryModel: "gemini-2.5-flash",   // LLM 1: research pass — fast, 1M ctx, strong factual
  secondaryLlmEnabled: false,
  secondaryVendor: "google",
  secondaryModel: "gemini-2.5-pro",   // LLM 2: refinement pass — best prose quality
  viewMode: "cards",
  avatarBgColor: "#0091ae",

  // Per-purpose AI model defaults
  avatarGenVendor: "google",
  avatarGenModel: "nano-banana",
  authorResearchVendor: "google",
  authorResearchModel: "gemini-2.5-flash",
  authorResearchSecondaryEnabled: false,
  authorResearchSecondaryVendor: "google",
  authorResearchSecondaryModel: "gemini-2.5-pro",
  bookResearchVendor: "google",
  bookResearchModel: "gemini-2.5-flash",
  bookResearchSecondaryEnabled: false,
  bookResearchSecondaryVendor: "google",
  bookResearchSecondaryModel: "gemini-2.5-pro",
  otherAiVendor: "google",
  otherAiModel: "gemini-2.5-flash",
  otherAiSecondaryEnabled: false,
  otherAiSecondaryVendor: "google",
  otherAiSecondaryModel: "gemini-2.5-pro",
};

const STORAGE_KEY = "app-settings-v2";
const LEGACY_KEY_V1 = "app-settings-v1";
const LEGACY_THEME_KEY = "ncg-app-theme";

// -- Context -------------------------------------------------------------------

const AppSettingsContext = createContext<AppSettingsContextType | null>(null);

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      // Try new storage key first
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AppSettings>;
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
      // Migrate from legacy keys
      const legacyV1 = localStorage.getItem(LEGACY_KEY_V1);
      const base = legacyV1
        ? { ...DEFAULT_SETTINGS, ...(JSON.parse(legacyV1) as Partial<AppSettings>) }
        : { ...DEFAULT_SETTINGS };
      const legacyTheme = localStorage.getItem(LEGACY_THEME_KEY);
      if (legacyTheme === "dark" || legacyTheme === "noir-dark") {
        base.colorMode = "dark";
      }
      return base;
    } catch {
      // ignore parse errors
    }
    return DEFAULT_SETTINGS;
  });

  // Apply theme + color-mode classes to <html> whenever settings change
  useEffect(() => {
    const root = document.documentElement;
    // Remove all known theme and color-mode classes
    root.classList.remove(
      "theme-manus", "theme-norfolk-ai", "theme-noir-dark",
      "dark", "light", "norfolk-ai", "noir-dark"
    );
    // Apply named theme class
    root.classList.add(`theme-${settings.theme}`);
    // Noir Dark is a light-background monochrome theme - never add .dark
    // Adding .dark would activate Flowbite's dark:bg-gray-800 and break the white bg
    const effectiveColorMode = settings.theme === "noir-dark" ? "light" : settings.colorMode;
    if (effectiveColorMode === "dark") {
      root.classList.add("dark");
    }
    // Persist
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage errors
    }
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleColorMode = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      colorMode: prev.colorMode === "dark" ? "light" : "dark",
    }));
  }, []);

  return (
    <AppSettingsContext.Provider value={{ settings, updateSettings, toggleColorMode }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettingsContextType {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error("useAppSettings must be used within AppSettingsProvider");
  return ctx;
}

// -- Compatibility shim: replaces useTheme() from former ThemeContext ----------
/**
 * @deprecated Use useAppSettings() instead.
 * Provided for backward compatibility - mirrors the old useTheme() API.
 */
export function useThemeCompat() {
  const { settings, updateSettings, toggleColorMode } = useAppSettings();
  return {
    appTheme: settings.colorMode,
    theme: settings.colorMode,
    setAppTheme: (t: ColorMode) => updateSettings({ colorMode: t }),
    toggleTheme: toggleColorMode,
    switchable: true,
  };
}
