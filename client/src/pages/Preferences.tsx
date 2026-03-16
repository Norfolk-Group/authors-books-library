/**
 * Preferences Page
 * Three tabs: Themes | Icons | About
 * Uses AppSettingsContext for persistent theme + icon set selection.
 */

import { useAppSettings, type ThemeName, type IconSetId } from "@/contexts/AppSettingsContext";
import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BooksIcon,
  UsersIcon,
  HeadphonesIcon,
  MagnifyingGlassIcon,
  GearIcon,
  BookOpenIcon,
  CheckIcon,
} from "@phosphor-icons/react";

// ── Theme definitions ─────────────────────────────────────────────────────────

const THEMES: {
  id: ThemeName;
  label: string;
  description: string;
  palette: { bg: string; fg: string; primary: string; accent: string; sidebar: string };
}[] = [
  {
    id: "manus",
    label: "Manus",
    description: "Achromatic, grey hierarchy, flat surfaces. Clean and focused.",
    palette: {
      bg: "#FAFAFA",
      fg: "#1A1A1A",
      primary: "#1A1A1A",
      accent: "#6B7280",
      sidebar: "#FFFFFF",
    },
  },
  {
    id: "norfolk-ai",
    label: "Norfolk AI",
    description: "NCG brand: deep navy sidebar, yellow accent. Bold and institutional.",
    palette: {
      bg: "#F5F8FA",
      fg: "#34475B",
      primary: "#112548",
      accent: "#FDB817",
      sidebar: "#112548",
    },
  },
  {
    id: "noir-dark",
    label: "Noir Dark",
    description: "Executive monochrome: white background, black typography and buttons.",
    palette: {
      bg: "#FFFFFF",
      fg: "#0A0A0A",
      primary: "#0A0A0A",
      accent: "#374151",
      sidebar: "#FFFFFF",
    },
  },
];

// ── Icon set definitions ──────────────────────────────────────────────────────

const ICON_SETS: {
  id: IconSetId;
  label: string;
  description: string;
  weight: "regular" | "duotone";
}[] = [
  {
    id: "phosphor-regular",
    label: "Phosphor Regular",
    description: "1.5px stroke, rounded caps. Matches the Manus icon style exactly.",
    weight: "regular",
  },
  {
    id: "phosphor-duotone",
    label: "Phosphor Duotone",
    description: "Two-tone fill style. Richer on dark themes and executive palettes.",
    weight: "duotone",
  },
];

// Preview icons for the icon set selector
const PREVIEW_ICON_COMPONENTS = [
  BooksIcon,
  UsersIcon,
  HeadphonesIcon,
  MagnifyingGlassIcon,
  GearIcon,
  BookOpenIcon,
];

// ── Color swatch ──────────────────────────────────────────────────────────────

function ColorSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="w-6 h-6 rounded border border-border/50 shadow-sm"
        style={{ backgroundColor: color }}
        title={`${label}: ${color}`}
      />
      <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</span>
    </div>
  );
}

// ── Theme card ────────────────────────────────────────────────────────────────

function ThemeCard({
  theme,
  selected,
  onSelect,
}: {
  theme: (typeof THEMES)[0];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={`p-4 cursor-pointer transition-all border-2 ${
        selected
          ? "border-foreground shadow-md"
          : "border-border hover:border-muted-foreground"
      }`}
      onClick={onSelect}
    >
      {/* Preview strip */}
      <div
        className="w-full h-10 rounded-md mb-3 overflow-hidden flex"
        style={{ backgroundColor: theme.palette.bg }}
      >
        {/* Sidebar strip */}
        <div className="w-8 h-full" style={{ backgroundColor: theme.palette.sidebar }} />
        {/* Content area */}
        <div className="flex-1 flex flex-col justify-center gap-1 px-2">
          <div className="h-1.5 rounded-full w-3/4" style={{ backgroundColor: theme.palette.fg + "30" }} />
          <div className="h-1.5 rounded-full w-1/2" style={{ backgroundColor: theme.palette.accent + "60" }} />
        </div>
        {/* Primary button preview */}
        <div
          className="m-1.5 px-2 rounded flex items-center"
          style={{ backgroundColor: theme.palette.primary, minWidth: 20 }}
        />
      </div>

      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="text-sm font-semibold font-display text-foreground">{theme.label}</span>
          {selected && (
            <span className="ml-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Active</span>
          )}
        </div>
        {selected && (
          <div className="w-5 h-5 rounded-full bg-foreground flex items-center justify-center flex-shrink-0">
            <CheckIcon size={12} className="text-background" weight="bold" />
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-3">{theme.description}</p>

      {/* Color palette swatches */}
      <div className="flex gap-2">
        <ColorSwatch color={theme.palette.bg} label="BG" />
        <ColorSwatch color={theme.palette.fg} label="FG" />
        <ColorSwatch color={theme.palette.primary} label="Primary" />
        <ColorSwatch color={theme.palette.accent} label="Accent" />
        <ColorSwatch color={theme.palette.sidebar} label="Sidebar" />
      </div>
    </Card>
  );
}

// ── Icon set card ─────────────────────────────────────────────────────────────

function IconSetCard({
  iconSet,
  selected,
  onSelect,
}: {
  iconSet: (typeof ICON_SETS)[0];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={`p-4 cursor-pointer transition-all border-2 ${
        selected
          ? "border-foreground shadow-md"
          : "border-border hover:border-muted-foreground"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold font-display text-foreground">{iconSet.label}</span>
            {selected && (
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Active</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{iconSet.description}</p>
        </div>
        {selected && (
          <div className="w-5 h-5 rounded-full bg-foreground flex items-center justify-center flex-shrink-0">
            <CheckIcon size={12} className="text-background" weight="bold" />
          </div>
        )}
      </div>

      {/* Live icon preview row */}
      <div className="flex items-center gap-3 text-foreground mt-3 p-2 bg-muted/40 rounded-md">
        {PREVIEW_ICON_COMPONENTS.map((Icon, i) => (
          <Icon key={i} size={20} weight={iconSet.weight} />
        ))}
      </div>
    </Card>
  );
}

// ── Main Preferences page ─────────────────────────────────────────────────────

export default function Preferences() {
  const { settings, updateSettings } = useAppSettings();

  return (
    <div className="min-h-screen bg-background">
      <PageHeader crumbs={[{ label: "Preferences" }]} />
      <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold font-display text-foreground mb-1">Preferences</h1>
        <p className="text-sm text-muted-foreground">
          Customize the appearance and behaviour of the NCG Knowledge Library.
        </p>
      </div>

      <Tabs defaultValue="themes">
        <TabsList className="mb-6">
          <TabsTrigger value="themes">Themes</TabsTrigger>
          <TabsTrigger value="icons">Icons</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        {/* ── Themes tab ── */}
        <TabsContent value="themes" className="space-y-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-3">
            Select Theme
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {THEMES.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                selected={settings.theme === theme.id}
                onSelect={() => updateSettings({ theme: theme.id })}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            Theme changes apply instantly and are saved to your browser.
          </p>
        </TabsContent>

        {/* ── Icons tab ── */}
        <TabsContent value="icons" className="space-y-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-3">
            Icon Style
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ICON_SETS.map((iconSet) => (
              <IconSetCard
                key={iconSet.id}
                iconSet={iconSet}
                selected={settings.iconSet === iconSet.id}
                onSelect={() => updateSettings({ iconSet: iconSet.id })}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            Icon style changes apply to navigation and UI icons throughout the app.
          </p>
        </TabsContent>

        {/* ── About tab ── */}
        <TabsContent value="about">
          <Card className="p-6">
            <h2 className="text-base font-semibold font-display text-foreground mb-4">About</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Application</span>
                <span className="text-foreground font-medium">NCG Knowledge Library</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Organisation</span>
                <span className="text-foreground font-medium">Norfolk Consulting Group</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Powered by</span>
                <span className="text-foreground font-medium">Norfolk AI</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Icon Library</span>
                <span className="text-foreground font-medium">Phosphor Icons</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="text-foreground font-medium">March 2026</span>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
