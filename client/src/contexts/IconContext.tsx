/**
 * IconContext - Switchable Icon Set Provider
 *
 * Allows the active icon library to be changed globally from a Preferences page.
 * Components consume icons via useIcons() instead of importing directly.
 *
 * Usage:
 *   const icons = useIcons();
 *   return <icons.search size={16} />;
 */

import { createContext, useContext, type ComponentType } from "react";

// -- Icon catalogue type -------------------------------------------------------

export interface IconProps {
  size?: number;
  weight?: "regular" | "duotone" | "bold" | "thin" | "fill" | "light";
  color?: string;
  className?: string;
}

export type IconComponent = ComponentType<IconProps>;

export interface IconCatalogue {
  // Navigation
  newTask: IconComponent;
  search: IconComponent;
  library: IconComponent;
  projects: IconComponent;
  settings: IconComponent;
  notifications: IconComponent;
  agents: IconComponent;
  // Actions
  add: IconComponent;
  edit: IconComponent;
  close: IconComponent;
  back: IconComponent;
  download: IconComponent;
  upload: IconComponent;
  share: IconComponent;
  attach: IconComponent;
  send: IconComponent;
  more: IconComponent;
  // Content types
  authors: IconComponent;
  books: IconComponent;
  audiobooks: IconComponent;
  categories: IconComponent;
  pdf: IconComponent;
  transcript: IconComponent;
  binder: IconComponent;
  supplemental: IconComponent;
  video: IconComponent;
  image: IconComponent;
  externalLink: IconComponent;
  // Status
  statusIdle: IconComponent;
  statusDone: IconComponent;
  statusFailed: IconComponent;
  statusPaused: IconComponent;
  // Utility
  sort: IconComponent;
  filter: IconComponent;
  bio: IconComponent;
}

// -- Default context -----------------------------------------------------------

// Import is deferred - the actual default is set in main.tsx via IconProvider
const IconContext = createContext<IconCatalogue | null>(null);

export function IconProvider({
  iconSet,
  children,
}: {
  iconSet: IconCatalogue;
  children: React.ReactNode;
}) {
  return <IconContext.Provider value={iconSet}>{children}</IconContext.Provider>;
}

export function useIcons(): IconCatalogue {
  const ctx = useContext(IconContext);
  if (!ctx) throw new Error("useIcons must be used within an IconProvider");
  return ctx;
}
