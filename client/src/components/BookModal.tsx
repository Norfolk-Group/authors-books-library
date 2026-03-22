/**
 * @deprecated BookModal has been unified into BookDetailPanel (variant="compact" + asDialog).
 *
 * This file is kept as a compatibility shim. No new code should import from here.
 * Migrate callers to:
 *   import { BookDetailPanel } from "@/components/library/BookDetailPanel";
 *   <BookDetailPanel book={bookRecord} variant="compact" asDialog open={!!book} onClose={onClose} />
 */

export type { BookDetailVariant as BookModalVariant } from "@/components/library/BookDetailPanel";

// Legacy type alias kept for any remaining callers during migration
export interface BookModalBook {
  id: string;
  titleKey: string;
  coverUrl?: string;
  contentTypes: Record<string, number>;
  authorName?: string;
}

// No-op component — callers should migrate to BookDetailPanel
export function BookModal(_props: { book: BookModalBook | null; onClose: () => void }) {
  return null;
}
