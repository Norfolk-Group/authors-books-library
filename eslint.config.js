import js from "@eslint/js";
import globals from "globals";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooksPlugin from "eslint-plugin-react-hooks";

// Note: This project uses the React 17+ JSX transform (no need to import React
// in every file). TypeScript handles type checking, so we disable no-undef for
// TS/TSX files (TypeScript's own checker is more accurate for these).

/** @type {import("eslint").Linter.Config[]} */
export default [
  // ── Global ignores ──────────────────────────────────────────────────────────
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "drizzle/migrations/**",
      "*.min.js",
      "scripts/**",
    ],
  },

  // ── Base JS recommended ──────────────────────────────────────────────────────
  js.configs.recommended,

  // ── TypeScript + React client source ────────────────────────────────────────
  {
    files: ["client/src/**/*.{ts,tsx}", "shared/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
        // React 17+ JSX transform: React is injected automatically, not in scope
        React: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      // ── React Hooks rules ──────────────────────────────────────────────────
      // Enforces the Rules of Hooks (no hooks outside components/custom hooks,
      // no conditional hooks). This is the rule that would have caught the
      // AuthorBioPanel.tsx bug where useAuthorAliases() was placed at module level.
      "react-hooks/rules-of-hooks": "error",

      // Warns when useEffect/useCallback/useMemo dependency arrays are incomplete.
      // Set to "warn" (not "error") to avoid blocking builds on legacy code.
      "react-hooks/exhaustive-deps": "warn",

      // ── TypeScript essentials ──────────────────────────────────────────────
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",

      // ── General JS quality ─────────────────────────────────────────────────
      // Disable base JS rules that conflict with TypeScript equivalents.
      // TypeScript's own type checker handles these more accurately.
      "no-undef": "off",
      "no-unused-vars": "off",      // Use @typescript-eslint/no-unused-vars instead
      "no-useless-assignment": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "error",
    },
  },

  // ── Server-side TypeScript (Node environment, no React hooks) ───────────────
  {
    files: ["server/**/*.ts"],
    ignores: ["server/**/*.test.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "no-debugger": "error",
    },
  },
];
