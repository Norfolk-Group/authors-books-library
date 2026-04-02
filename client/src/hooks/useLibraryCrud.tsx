/**
 * useLibraryCrud — Centralized CRUD dialog orchestration for author and book management.
 * Extracts all dialog state and handlers from Home.tsx to reduce complexity.
 */
import { useState } from "react";
import { AuthorFormDialog } from "@/components/library/AuthorFormDialog";
import { DeleteAuthorDialog } from "@/components/library/DeleteAuthorDialog";
import { BookFormDialog } from "@/components/library/BookFormDialog";
import { DeleteBookDialog } from "@/components/library/DeleteBookDialog";
import { PhysicalBookQuickAddDialog } from "@/components/library/PhysicalBookQuickAddDialog";

export function useLibraryCrud() {
  // Author CRUD state
  const [addAuthorOpen, setAddAuthorOpen] = useState(false);
  const [editAuthorData, setEditAuthorData] = useState<{ authorName: string } | null>(null);
  const [deleteAuthorName, setDeleteAuthorName] = useState<string | null>(null);

  // Book CRUD state
  const [addBookOpen, setAddBookOpen] = useState(false);
  const [physicalBookOpen, setPhysicalBookOpen] = useState(false);
  const [editBookData, setEditBookData] = useState<{ bookTitle: string } | null>(null);
  const [deleteBookTitle, setDeleteBookTitle] = useState<string | null>(null);

  // Handlers
  const openAddAuthor = () => setAddAuthorOpen(true);
  const openEditAuthor = (authorName: string) => setEditAuthorData({ authorName });
  const openDeleteAuthor = (authorName: string) => setDeleteAuthorName(authorName);
  const closeAuthorDialogs = () => {
    setAddAuthorOpen(false);
    setEditAuthorData(null);
    setDeleteAuthorName(null);
  };

  const openAddBook = () => setAddBookOpen(true);
  const openPhysicalBook = () => setPhysicalBookOpen(true);
  const openEditBook = (bookTitle: string) => setEditBookData({ bookTitle });
  const openDeleteBook = (bookTitle: string) => setDeleteBookTitle(bookTitle);
  const closeBookDialogs = () => {
    setAddBookOpen(false);
    setPhysicalBookOpen(false);
    setEditBookData(null);
    setDeleteBookTitle(null);
  };

  // Dialog components
  const CrudDialogs = () => (
    <>
      <AuthorFormDialog
        open={addAuthorOpen || !!editAuthorData}
        onOpenChange={(open) => !open && closeAuthorDialogs()}
        initialData={editAuthorData ?? undefined}
        onSuccess={closeAuthorDialogs}
      />
      <DeleteAuthorDialog
        open={!!deleteAuthorName}
        onOpenChange={(open) => !open && setDeleteAuthorName(null)}
        authorName={deleteAuthorName ?? ""}
        onSuccess={() => setDeleteAuthorName(null)}
      />
      <BookFormDialog
        open={addBookOpen || !!editBookData}
        onOpenChange={(open) => !open && closeBookDialogs()}
        initialData={editBookData ?? undefined}
        onSuccess={closeBookDialogs}
      />
      <DeleteBookDialog
        open={!!deleteBookTitle}
        onOpenChange={(open) => !open && setDeleteBookTitle(null)}
        bookTitle={deleteBookTitle ?? ""}
        onSuccess={() => setDeleteBookTitle(null)}
      />
      <PhysicalBookQuickAddDialog
        open={physicalBookOpen}
        onOpenChange={setPhysicalBookOpen}
        onSuccess={() => setPhysicalBookOpen(false)}
      />
    </>
  );

  return {
    // Handlers
    openAddAuthor,
    openEditAuthor,
    openDeleteAuthor,
    openAddBook,
    openPhysicalBook,
    openEditBook,
    openDeleteBook,
    // Dialog components
    CrudDialogs,
  };
}
