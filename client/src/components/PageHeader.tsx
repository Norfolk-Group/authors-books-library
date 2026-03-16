/**
 * PageHeader — Breadcrumb navigation bar for non-home pages.
 *
 * Shows:
 *   NCG Library (home link) › [segment] › [segment] ...
 *
 * Usage:
 *   <PageHeader crumbs={[{ label: "Preferences" }]} />
 *   <PageHeader crumbs={[{ label: "Authors", href: "/" }, { label: "Adam Grant" }]} />
 */
import { HouseIcon, CaretRightIcon } from "@phosphor-icons/react";
import { Link } from "wouter";

export interface Crumb {
  label: string;
  /** If provided, the crumb is a clickable link. */
  href?: string;
}

interface PageHeaderProps {
  crumbs: Crumb[];
}

export default function PageHeader({ crumbs }: PageHeaderProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 px-6 py-3 border-b border-border bg-background text-sm text-muted-foreground select-none"
    >
      {/* Home icon + label */}
      <Link
        href="/"
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group"
        aria-label="Home"
      >
        <HouseIcon
          weight="duotone"
          size={16}
          className="text-muted-foreground group-hover:text-foreground transition-colors"
        />
        <span className="font-medium">NCG Library</span>
      </Link>

      {/* Crumb segments */}
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <CaretRightIcon size={12} className="text-border flex-shrink-0" />
          {crumb.href ? (
            <Link
              href={crumb.href}
              className="hover:text-foreground transition-colors font-medium"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
