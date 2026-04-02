/**
 * Book CRUD Router
 * Handles create, update, and delete operations for book_profiles.
 * Extracted from bookProfiles.router.ts to keep each router under ~150 lines.
 */
import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import {
  handleCreateBook,
  handleUpdateBook,
  handleDeleteBook,
} from "../lib/bookHandlers/crudHandlers";

// Shared input schemas (reused by both create and update)
const bookFieldsSchema = {
  authorName:      z.string().optional(),
  summary:         z.string().optional(),
  keyThemes:       z.string().optional(),
  amazonUrl:       z.string().url().optional().or(z.literal("")),
  goodreadsUrl:    z.string().url().optional().or(z.literal("")),
  wikipediaUrl:    z.string().url().optional().or(z.literal("")),
  publisherUrl:    z.string().url().optional().or(z.literal("")),
  coverImageUrl:   z.string().url().optional().or(z.literal("")),
  isbn:            z.string().optional(),
  publishedDate:   z.string().optional(),
  publisher:       z.string().optional(),
  rating:          z.number().min(0).max(5).optional(),
  format:          z.enum(["physical", "digital", "audio", "physical_digital", "physical_audio", "digital_audio", "all", "none"]).optional(),
  possessionStatus: z.enum(["owned", "wishlist", "reference", "borrowed", "gifted", "read", "reading", "unread"]).optional(),
};

export const bookCrudRouter = router({
  createBook: adminProcedure
    .input(z.object({
      bookTitle: z.string().min(1).max(512),
      ...bookFieldsSchema,
    }))
    .mutation(({ input }) => handleCreateBook(input)),

  updateBook: adminProcedure
    .input(z.object({
      bookTitle: z.string().min(1),
      ...bookFieldsSchema,
      format:          z.enum(["physical", "digital", "audio", "physical_digital", "physical_audio", "digital_audio", "all", "none"]).optional().nullable(),
      possessionStatus: z.enum(["owned", "wishlist", "reference", "borrowed", "gifted", "read", "reading", "unread"]).optional().nullable(),
    }))
    .mutation(({ input }) => handleUpdateBook(input)),

  deleteBook: adminProcedure
    .input(z.object({ bookTitle: z.string().min(1) }))
    .mutation(({ input }) => handleDeleteBook(input)),
});
