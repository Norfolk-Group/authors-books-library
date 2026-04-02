/**
 * tags.router.ts
 * Full CRUD for the global tags table, plus apply/remove tag from author/book.
 * Tags are stored as JSON arrays in author_profiles.tagsJson and book_profiles.tagsJson.
 */
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { tags, authorProfiles, bookProfiles } from "../../drizzle/schema";
import { eq, asc, sql } from "drizzle-orm";

// ── Helpers ────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseTagsJson(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Router ─────────────────────────────────────────────────────────────────

export const tagsRouter = router({
  /**
   * List all tags ordered by displayOrder then name.
   */
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(tags).orderBy(asc(tags.displayOrder), asc(tags.name));
  }),

  /**
   * Create a new tag (admin only).
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(128),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#6366F1"),
        description: z.string().max(512).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const slug = slugify(input.name);
      await db.insert(tags).values({
        slug,
        name: input.name,
        color: input.color,
        description: input.description ?? null,
        displayOrder: 0,
      });
      const [created] = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1);
      return created;
    }),

  /**
   * Update a tag's name, color, or description (admin only).
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(128).optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        description: z.string().max(512).nullable().optional(),
        displayOrder: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const updates: Partial<typeof tags.$inferInsert> = {};
      if (input.name !== undefined) {
        updates.name = input.name;
        updates.slug = slugify(input.name);
      }
      if (input.color !== undefined) updates.color = input.color;
      if (input.description !== undefined) updates.description = input.description;
      if (input.displayOrder !== undefined) updates.displayOrder = input.displayOrder;
      await db.update(tags).set(updates).where(eq(tags.id, input.id));
      const [updated] = await db.select().from(tags).where(eq(tags.id, input.id)).limit(1);
      return updated;
    }),

  /**
   * Delete a tag by ID. Also removes the tag slug from all author/book tagsJson arrays.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      // Get the slug before deleting
      const [tag] = await db.select({ slug: tags.slug }).from(tags).where(eq(tags.id, input.id)).limit(1);
      if (!tag) throw new Error("Tag not found");
      // Remove from all author tagsJson
      const authors = await db.select({ authorName: authorProfiles.authorName, tagsJson: authorProfiles.tagsJson })
        .from(authorProfiles)
        .where(sql`JSON_SEARCH(${authorProfiles.tagsJson}, 'one', ${tag.slug}) IS NOT NULL`);
      for (const author of authors) {
        const current = parseTagsJson(author.tagsJson);
        const updated = current.filter(s => s !== tag.slug);
        await db.update(authorProfiles)
          .set({ tagsJson: JSON.stringify(updated) })
          .where(eq(authorProfiles.authorName, author.authorName));
      }
      // Remove from all book tagsJson
      const books = await db.select({ bookTitle: bookProfiles.bookTitle, tagsJson: bookProfiles.tagsJson })
        .from(bookProfiles)
        .where(sql`JSON_SEARCH(${bookProfiles.tagsJson}, 'one', ${tag.slug}) IS NOT NULL`);
      for (const book of books) {
        const current = parseTagsJson(book.tagsJson);
        const updated = current.filter(s => s !== tag.slug);
        await db.update(bookProfiles)
          .set({ tagsJson: JSON.stringify(updated) })
          .where(eq(bookProfiles.bookTitle, book.bookTitle));
      }
      await db.delete(tags).where(eq(tags.id, input.id));
      return { success: true, deletedSlug: tag.slug };
    }),

  /**
   * Apply or remove a tag from an author or book.
   * Returns the new tags array for the entity.
   */
  applyToEntity: protectedProcedure
    .input(
      z.object({
        entityType: z.enum(["author", "book"]),
        entityKey: z.string().min(1), // authorName or bookTitle
        tagSlug: z.string().min(1),
        action: z.enum(["add", "remove"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      if (input.entityType === "author") {
        const [row] = await db.select({ tagsJson: authorProfiles.tagsJson })
          .from(authorProfiles)
          .where(eq(authorProfiles.authorName, input.entityKey))
          .limit(1);
        const current = parseTagsJson(row?.tagsJson ?? null);
        const updated = input.action === "add"
          ? Array.from(new Set([...current, input.tagSlug]))
          : current.filter(s => s !== input.tagSlug);
        await db.update(authorProfiles)
          .set({ tagsJson: JSON.stringify(updated) })
          .where(eq(authorProfiles.authorName, input.entityKey));
        // Update usageCount
        const delta = input.action === "add" ? 1 : -1;
        await db.update(tags)
          .set({ usageCount: sql`GREATEST(0, usageCount + ${delta})` })
          .where(eq(tags.slug, input.tagSlug));
        return { tags: updated };
      } else {
        const [row] = await db.select({ tagsJson: bookProfiles.tagsJson })
          .from(bookProfiles)
          .where(eq(bookProfiles.bookTitle, input.entityKey))
          .limit(1);
        const current = parseTagsJson(row?.tagsJson ?? null);
        const updated = input.action === "add"
          ? Array.from(new Set([...current, input.tagSlug]))
          : current.filter(s => s !== input.tagSlug);
        await db.update(bookProfiles)
          .set({ tagsJson: JSON.stringify(updated) })
          .where(eq(bookProfiles.bookTitle, input.entityKey));
        const delta = input.action === "add" ? 1 : -1;
        await db.update(tags)
          .set({ usageCount: sql`GREATEST(0, usageCount + ${delta})` })
          .where(eq(tags.slug, input.tagSlug));
        return { tags: updated };
      }
    }),

  /**
   * Get tags for a specific entity.
   */
  getForEntity: publicProcedure
    .input(
      z.object({
        entityType: z.enum(["author", "book"]),
        entityKey: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      let tagsJson: string | null = null;
      if (input.entityType === "author") {
        const [row] = await db.select({ tagsJson: authorProfiles.tagsJson })
          .from(authorProfiles)
          .where(eq(authorProfiles.authorName, input.entityKey))
          .limit(1);
        tagsJson = row?.tagsJson ?? null;
      } else {
        const [row] = await db.select({ tagsJson: bookProfiles.tagsJson })
          .from(bookProfiles)
          .where(eq(bookProfiles.bookTitle, input.entityKey))
          .limit(1);
        tagsJson = row?.tagsJson ?? null;
      }
      const slugs = parseTagsJson(tagsJson);
      if (slugs.length === 0) return [];
      // Fetch full tag objects for the slugs
      const allTags = await db.select().from(tags).orderBy(asc(tags.name));
      return allTags.filter(t => slugs.includes(t.slug));
    }),
});
