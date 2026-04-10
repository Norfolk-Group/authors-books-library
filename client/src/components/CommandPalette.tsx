/**
 * CommandPalette — Global Cmd/Ctrl+K command palette
 *
 * Features:
 * - Opens with Cmd+K (Mac) or Ctrl+K (Windows/Linux)
 * - Searches authors and books from static library data
 * - Navigate to author detail page or book detail page
 * - Navigate to home and filter by author/book (highlight + scroll)
 * - Keyboard navigation: ↑↓ arrows, Enter to select, Escape to close
 * - Shows category badge on author results
 * - Shows author name on book results
 */
import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Command } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Search,
  BookOpen,
  Users,
  ArrowRight,
  X,
} from "lucide-react";
import { AUTHORS, BOOKS, CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/libraryData";
import { useAuthorAliases } from "@/hooks/useAuthorAliases";
import { ICON_MAP } from "@/components/library/libraryConstants";
import { Briefcase } from "lucide-react";

type LucideIcon = React.FC<{ className?: string }>;

interface CommandPaletteProps {
  /** Called when user selects an author to navigate to on the home page */
  onNavigateAuthor?: (authorName: string) => void;
  /** Called when user selects a book to navigate to on the home page */
  onNavigateBook?: (titleKey: string) => void;
}

export function CommandPalette({ onNavigateAuthor, onNavigateBook }: CommandPaletteProps) {
  const { canonicalName } = useAuthorAliases();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [, navigate] = useLocation();

  // Open on Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setInputValue("");
  }, []);

  // Deduplicated author list
  const authorList = (() => {
    const seen = new Set<string>();
    return AUTHORS.filter((a) => {
      const key = canonicalName(a.name).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  // Deduplicated book list (by title key)
  const bookList = (() => {
    const seen = new Set<string>();
    return BOOKS.filter((b) => {
      const tk = b.name.includes(" - ")
        ? b.name.slice(0, b.name.lastIndexOf(" - ")).trim().toLowerCase()
        : b.name.trim().toLowerCase();
      if (seen.has(tk)) return false;
      seen.add(tk);
      return true;
    });
  })();

  const handleSelectAuthor = useCallback(
    (authorName: string) => {
      handleClose();
      const canonical = canonicalName(authorName);
      if (onNavigateAuthor) {
        // We're on the home page — scroll to the card
        onNavigateAuthor(canonical);
      } else {
        // Navigate to author detail page
        const slug = canonical.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        navigate(`/author/${slug}`);
      }
    },
    [handleClose, onNavigateAuthor, navigate, canonicalName]
  );

  const handleSelectBook = useCallback(
    (bookName: string) => {
      handleClose();
      const titleKey = bookName.includes(" - ")
        ? bookName.slice(0, bookName.lastIndexOf(" - ")).trim().toLowerCase()
        : bookName.trim().toLowerCase();
      if (onNavigateBook) {
        // We're on the home page — scroll to the card
        onNavigateBook(titleKey);
      } else {
        // Navigate to book detail page
        const slug = titleKey.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        navigate(`/book/${slug}`);
      }
    },
    [handleClose, onNavigateBook, navigate]
  );

  const handleSelectPage = useCallback(
    (path: string) => {
      handleClose();
      navigate(path);
    },
    [handleClose, navigate]
  );

  // Filter results
  const q = inputValue.trim().toLowerCase();
  const filteredAuthors = q
    ? authorList.filter((a) => canonicalName(a.name).toLowerCase().includes(q)).slice(0, 8)
    : authorList.slice(0, 5);

  const filteredBooks = q
    ? bookList
        .filter((b) => {
          const title = b.name.includes(" - ")
            ? b.name.slice(0, b.name.lastIndexOf(" - ")).trim().toLowerCase()
            : b.name.trim().toLowerCase();
          const author = b.name.includes(" - ")
            ? b.name.slice(b.name.lastIndexOf(" - ") + 3).trim().toLowerCase()
            : "";
          return title.includes(q) || author.includes(q);
        })
        .slice(0, 8)
    : bookList.slice(0, 5);

  const pages = [
    { label: "Home — Authors", path: "/", icon: Users },
    { label: "Leaderboard", path: "/leaderboard", icon: ArrowRight },
    { label: "Reading Stats", path: "/stats", icon: ArrowRight },
    { label: "Admin Console", path: "/admin", icon: ArrowRight },
  ].filter((p) => !q || p.label.toLowerCase().includes(q));

  return (
    <>
      {/* Keyboard hint shown in the search bar area — optional trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-muted-foreground bg-muted/60 border border-border/50 hover:bg-muted hover:text-foreground transition-colors cursor-pointer select-none"
        aria-label="Open command palette"
      >
        <Search className="w-3.5 h-3.5" />
        <span>Quick search…</span>
        <kbd className="ml-1 px-1 py-0.5 text-[10px] font-mono bg-background border border-border rounded">
          ⌘K
        </kbd>
      </button>

      <DialogPrimitive.Root open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className="fixed left-1/2 top-[15%] z-50 w-full max-w-xl -translate-x-1/2 rounded-xl border border-border bg-background/95 backdrop-blur-xl shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-top-[2%] data-[state=open]:slide-in-from-top-[2%]"
            aria-describedby={undefined}
          >
            <DialogPrimitive.Title className="sr-only">Command Palette</DialogPrimitive.Title>
            <Command className="rounded-xl overflow-hidden" shouldFilter={false}>
              {/* Search input */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <Command.Input
                  value={inputValue}
                  onValueChange={setInputValue}
                  placeholder="Search authors, books, pages…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
                  autoFocus
                />
                {inputValue && (
                  <button
                    onClick={() => setInputValue("")}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <kbd
                  onClick={handleClose}
                  className="px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted border border-border rounded cursor-pointer hover:bg-muted/80"
                >
                  ESC
                </kbd>
              </div>

              <Command.List className="max-h-[420px] overflow-y-auto p-2">
                <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
                  No results for "{inputValue}"
                </Command.Empty>

                {/* Authors */}
                {filteredAuthors.length > 0 && (
                  <Command.Group
                    heading={
                      <span className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <Users className="w-3 h-3" />
                        Authors
                      </span>
                    }
                  >
                    {filteredAuthors.map((author) => {
                      const canonical = canonicalName(author.name);
                      const iconName = CATEGORY_ICONS[author.category] ?? "briefcase";
                      const CatIcon = (ICON_MAP[iconName] ?? Briefcase) as LucideIcon;
                      const color = (CATEGORY_COLORS as Record<string, string>)[author.category] ?? "#6b7280";
                      return (
                        <Command.Item
                          key={author.name}
                          value={`author-${canonical}`}
                          onSelect={() => handleSelectAuthor(author.name)}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-accent/60 aria-selected:bg-accent transition-colors group"
                        >
                          <span
                            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${color}20`, color }}
                          >
                            <CatIcon className="w-3.5 h-3.5" />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-foreground truncate block">{canonical}</span>
                            <span className="text-[11px] text-muted-foreground capitalize">{author.category}</span>
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-aria-selected:opacity-100 transition-opacity" />
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                )}

                {/* Books */}
                {filteredBooks.length > 0 && (
                  <Command.Group
                    heading={
                      <span className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <BookOpen className="w-3 h-3" />
                        Books
                      </span>
                    }
                  >
                    {filteredBooks.map((book) => {
                      const title = book.name.includes(" - ")
                        ? book.name.slice(0, book.name.lastIndexOf(" - ")).trim()
                        : book.name.trim();
                      const authorPart = book.name.includes(" - ")
                        ? book.name.slice(book.name.lastIndexOf(" - ") + 3).trim()
                        : "";
                      return (
                        <Command.Item
                          key={book.name}
                          value={`book-${title.toLowerCase()}`}
                          onSelect={() => handleSelectBook(book.name)}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-accent/60 aria-selected:bg-accent transition-colors group"
                        >
                          <span className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary">
                            <BookOpen className="w-3.5 h-3.5" />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-foreground truncate block">{title}</span>
                            {authorPart && (
                              <span className="text-[11px] text-muted-foreground truncate block">{authorPart}</span>
                            )}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-aria-selected:opacity-100 transition-opacity" />
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                )}

                {/* Pages */}
                {pages.length > 0 && (
                  <Command.Group
                    heading={
                      <span className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <ArrowRight className="w-3 h-3" />
                        Pages
                      </span>
                    }
                  >
                    {pages.map((page) => (
                      <Command.Item
                        key={page.path}
                        value={`page-${page.label.toLowerCase()}`}
                        onSelect={() => handleSelectPage(page.path)}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-accent/60 aria-selected:bg-accent transition-colors group"
                      >
                        <span className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground">
                          <page.icon className="w-3.5 h-3.5" />
                        </span>
                        <span className="flex-1 text-sm font-medium text-foreground">{page.label}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-aria-selected:opacity-100 transition-opacity" />
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>

              {/* Footer hint */}
              <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 font-mono bg-muted border border-border rounded text-[10px]">↑↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 font-mono bg-muted border border-border rounded text-[10px]">↵</kbd>
                  select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 font-mono bg-muted border border-border rounded text-[10px]">esc</kbd>
                  close
                </span>
                <span className="ml-auto">{filteredAuthors.length + filteredBooks.length} results</span>
              </div>
            </Command>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
