/**
 * PageHeader - Persistent top bar for all non-home pages.
 *
 * Shows:
 *   [← Home]  Ricardo Cidale's Library › [segment] › [segment] ...
 *
 * The Home button is always visible and returns to "/" on click.
 *
 * Usage:
 *   <PageHeader crumbs={[{ label: "Preferences" }]} />
 *   <PageHeader crumbs={[{ label: "Authors", href: "/" }, { label: "Adam Grant" }]} />
 */
import { HouseIcon, CaretRightIcon, ArrowLeftIcon } from "@phosphor-icons/react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export interface Crumb {
  label: string;
  /** If provided, the crumb is a clickable link. */
  href?: string;
}

interface PageHeaderProps {
  crumbs: Crumb[];
  /** Optional title shown on the right side of the bar */
  title?: string;
}

export default function PageHeader({ crumbs, title }: PageHeaderProps) {
  const [, setLocation] = useLocation();

  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 px-4 h-12 border-b border-border bg-background/95 backdrop-blur-sm">
      {/* Home button - always visible, prominent */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setLocation("/")}
        className="flex items-center gap-1.5 h-8 px-3 shrink-0 font-medium"
        aria-label="Return to home"
      >
        <ArrowLeftIcon weight="bold" size={13} />
        <HouseIcon weight="duotone" size={14} />
        <span className="text-sm">Home</span>
      </Button>

      {/* Divider */}
      <span className="text-border/60 select-none text-lg leading-none">|</span>

      {/* Breadcrumb trail */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0 flex-1"
      >
        {/* Root: Ricardo Cidale's Library */}
        <Link
          href="/"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          Ricardo Cidale's Library
        </Link>

        {/* Crumb segments */}
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5 min-w-0">
            <CaretRightIcon size={11} className="text-border flex-shrink-0" />
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="hover:text-foreground transition-colors font-medium truncate"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="text-foreground font-medium truncate">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      {/* Optional right-side title */}
      {title && (
        <span className="text-sm font-semibold text-foreground shrink-0 ml-auto pr-2">
          {title}
        </span>
      )}
    </header>
  );
}
