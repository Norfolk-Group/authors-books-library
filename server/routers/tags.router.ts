/**
 * tags.router.ts
 * Full CRUD for the global tags table, plus apply/remove tag from author/book.
 * Tags are stored as JSON arrays in author_profiles.tagsJson and book_profiles.tagsJson.
 */
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { tags, authorProfiles, bookProfiles } from "../../drizzle/schema";
import { eq, asc, sql, desc, isNotNull, ne } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { logger } from "../lib/logger";

// ── Predefined tag taxonomy ────────────────────────────────────────────────
// These are the canonical categories used for auto-tagging.
// The LLM must choose from this list only.
const TAG_TAXONOMY: { slug: string; name: string; color: string }[] = [
  { slug: "business",        name: "Business",        color: "#3B82F6" },
  { slug: "psychology",      name: "Psychology",      color: "#8B5CF6" },
  { slug: "science",         name: "Science",         color: "#10B981" },
  { slug: "leadership",      name: "Leadership",      color: "#F59E0B" },
  { slug: "economics",       name: "Economics",       color: "#EF4444" },
  { slug: "philosophy",      name: "Philosophy",      color: "#6366F1" },
  { slug: "history",         name: "History",         color: "#D97706" },
  { slug: "technology",      name: "Technology",      color: "#06B6D4" },
  { slug: "self-help",       name: "Self-Help",       color: "#EC4899" },
  { slug: "neuroscience",    name: "Neuroscience",    color: "#14B8A6" },
  { slug: "communication",   name: "Communication",   color: "#F97316" },
  { slug: "creativity",      name: "Creativity",      color: "#A855F7" },
  { slug: "health",          name: "Health",          color: "#22C55E" },
  { slug: "sociology",       name: "Sociology",       color: "#64748B" },
  { slug: "politics",        name: "Politics",        color: "#DC2626" },
  { slug: "spirituality",    name: "Spirituality",    color: "#7C3AED" },
  { slug: "marketing",       name: "Marketing",       color: "#0EA5E9" },
  { slug: "finance",         name: "Finance",         color: "#16A34A" },
  { slug: "education",       name: "Education",       color: "#CA8A04" },
  { slug: "journalism",      name: "Journalism",      color: "#9CA3AF" },
];

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

      // Fetch the current tag so we know the old slug before renaming
      const [current] = await db.select().from(tags).where(eq(tags.id, input.id)).limit(1);
      if (!current) throw new Error("Tag not found");
      const oldSlug = current.slug;

      const updates: Partial<typeof tags.$inferInsert> = {};
      let newSlug: string | undefined;
      if (input.name !== undefined) {
        updates.name = input.name;
        newSlug = slugify(input.name);
        updates.slug = newSlug;
      }
      if (input.color !== undefined) updates.color = input.color;
      if (input.description !== undefined) updates.description = input.description;
      if (input.displayOrder !== undefined) updates.displayOrder = input.displayOrder;
      await db.update(tags).set(updates).where(eq(tags.id, input.id));

      // ── Cascade slug rename to all tagsJson arrays ──────────────────────
      if (newSlug && newSlug !== oldSlug) {
        // Update author_profiles
        const authorRows = await db
          .select({ authorName: authorProfiles.authorName, tagsJson: authorProfiles.tagsJson })
          .from(authorProfiles)
          .where(sql`JSON_SEARCH(${authorProfiles.tagsJson}, 'one', ${oldSlug}) IS NOT NULL`);
        for (const row of authorRows) {
          const slugs = parseTagsJson(row.tagsJson);
          const renamed = slugs.map((s) => (s === oldSlug ? newSlug! : s));
          await db
            .update(authorProfiles)
            .set({ tagsJson: JSON.stringify(renamed) })
            .where(eq(authorProfiles.authorName, row.authorName));
        }
        // Update book_profiles
        const bookRows = await db
          .select({ bookTitle: bookProfiles.bookTitle, tagsJson: bookProfiles.tagsJson })
          .from(bookProfiles)
          .where(sql`JSON_SEARCH(${bookProfiles.tagsJson}, 'one', ${oldSlug}) IS NOT NULL`);
        for (const row of bookRows) {
          const slugs = parseTagsJson(row.tagsJson);
          const renamed = slugs.map((s) => (s === oldSlug ? newSlug! : s));
          await db
            .update(bookProfiles)
            .set({ tagsJson: JSON.stringify(renamed) })
            .where(eq(bookProfiles.bookTitle, row.bookTitle));
        }
      }

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
   * Get all author → tag slugs map (for client-side tag filtering).
   * Returns { authorName: string; tagSlugs: string[] }[]
   */
  getAllAuthorTagSlugs: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({ authorName: authorProfiles.authorName, tagsJson: authorProfiles.tagsJson })
      .from(authorProfiles);
    return rows
      .filter((r) => r.tagsJson && r.tagsJson !== "[]")
      .map((r) => ({ authorName: r.authorName, tagSlugs: parseTagsJson(r.tagsJson) }));
  }),

  /**
   * Get all book → tag slugs map (for client-side tag filtering).
   */
  getAllBookTagSlugs: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({ bookTitle: bookProfiles.bookTitle, tagsJson: bookProfiles.tagsJson })
      .from(bookProfiles);
    return rows
      .filter((r) => r.tagsJson && r.tagsJson !== "[]")
      .map((r) => ({ bookTitle: r.bookTitle, tagSlugs: parseTagsJson(r.tagsJson) }));
  }),

  /**
   * Get the most recently tagged authors and books (for the 'Recently Tagged' strip).
   * Returns up to 8 entities ordered by updatedAt DESC.
   */
  getRecentlyTagged: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const authors = await db
      .select({
        entityKey: authorProfiles.authorName,
        entityType: sql<'author'>`'author'`,
        tagsJson: authorProfiles.tagsJson,
        avatarUrl: authorProfiles.avatarUrl,
        s3AvatarUrl: authorProfiles.s3AvatarUrl,
        updatedAt: authorProfiles.updatedAt,
      })
      .from(authorProfiles)
      .where(sql`${authorProfiles.tagsJson} IS NOT NULL AND ${authorProfiles.tagsJson} != '[]'`)
      .orderBy(desc(authorProfiles.updatedAt))
      .limit(8);
    const books = await db
      .select({
        entityKey: bookProfiles.bookTitle,
        entityType: sql<'book'>`'book'`,
        tagsJson: bookProfiles.tagsJson,
        avatarUrl: bookProfiles.coverImageUrl,
        s3AvatarUrl: bookProfiles.s3CoverUrl,
        updatedAt: bookProfiles.updatedAt,
      })
      .from(bookProfiles)
      .where(sql`${bookProfiles.tagsJson} IS NOT NULL AND ${bookProfiles.tagsJson} != '[]'`)
      .orderBy(desc(bookProfiles.updatedAt))
      .limit(8);
    // Merge, sort by updatedAt, return top 8
    const combined = [...authors, ...books]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 8);
    // Fetch all tags for display
    const allTags = await db.select({ slug: tags.slug, name: tags.name, color: tags.color }).from(tags);
    const tagMap = new Map(allTags.map(t => [t.slug, t]));
    return combined.map((row) => ({
      entityKey: row.entityKey,
      entityType: row.entityType as 'author' | 'book',
      tagSlugs: parseTagsJson(row.tagsJson),
      avatarUrl: row.avatarUrl ?? null,
      s3AvatarUrl: row.s3AvatarUrl ?? null,
      updatedAt: row.updatedAt,
      tags: parseTagsJson(row.tagsJson).map(slug => tagMap.get(slug)).filter(Boolean) as { slug: string; name: string; color: string | null }[],
    }));
  }),

  /**
   * Get usage counts per tag (authors + books breakdown).
   * Returns array sorted by total count descending.
   */
  getUsageCounts: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const allTags = await db.select({ slug: tags.slug, name: tags.name, color: tags.color }).from(tags).orderBy(asc(tags.name));
    const authorRows = await db.select({ tagsJson: authorProfiles.tagsJson }).from(authorProfiles);
    const bookRows = await db.select({ tagsJson: bookProfiles.tagsJson }).from(bookProfiles);
    const authorCounts = new Map<string, number>();
    const bookCounts = new Map<string, number>();
    for (const row of authorRows) {
      for (const slug of parseTagsJson(row.tagsJson)) {
        authorCounts.set(slug, (authorCounts.get(slug) ?? 0) + 1);
      }
    }
    for (const row of bookRows) {
      for (const slug of parseTagsJson(row.tagsJson)) {
        bookCounts.set(slug, (bookCounts.get(slug) ?? 0) + 1);
      }
    }
    return allTags
      .map((tag) => ({
        slug: tag.slug,
        name: tag.name,
        color: tag.color,
        authors: authorCounts.get(tag.slug) ?? 0,
        books: bookCounts.get(tag.slug) ?? 0,
        total: (authorCounts.get(tag.slug) ?? 0) + (bookCounts.get(tag.slug) ?? 0),
      }))
      .sort((a, b) => b.total - a.total);
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

  /**
   * Auto-tag all untagged authors using LLM + predefined taxonomy.
   * 1. Ensures all 20 canonical tags exist in the tags table.
   * 2. For each untagged author, asks LLM to pick 2-4 tags from the taxonomy.
   * 3. Writes the chosen slugs to author_profiles.tagsJson.
   * Idempotent — skips authors that already have tags.
   * Returns progress stats.
   */
  autoTagAll: protectedProcedure
    .input(z.object({
      skipExisting: z.boolean().default(true),
      maxAuthors: z.number().int().min(1).max(500).default(200),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Step 1: Ensure all taxonomy tags exist in the tags table
      for (const tag of TAG_TAXONOMY) {
        await db
          .insert(tags)
          .values({
            slug: tag.slug,
            name: tag.name,
            color: tag.color,
            displayOrder: TAG_TAXONOMY.findIndex(t => t.slug === tag.slug),
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onDuplicateKeyUpdate({ set: { color: tag.color, updatedAt: new Date() } });
      }

      // Step 2: Fetch all authors (optionally skip already-tagged)
      const allAuthors = await db
        .select({
          authorName: authorProfiles.authorName,
          bio: authorProfiles.bio,
          richBioJson: authorProfiles.richBioJson,
          tagsJson: authorProfiles.tagsJson,
        })
        .from(authorProfiles)
        .limit(input.maxAuthors);

      const targets = input.skipExisting
        ? allAuthors.filter(a => !a.tagsJson || a.tagsJson === "[]" || a.tagsJson === "null")
        : allAuthors;

      if (targets.length === 0) {
        return { tagged: 0, skipped: allAuthors.length, message: "All authors already have tags" };
      }

      const taxonomyList = TAG_TAXONOMY.map(t => `${t.slug} (${t.name})`).join(", ");
      let tagged = 0;
      let failed = 0;

      // Step 3: Tag each author with LLM
      for (const author of targets) {
        try {
          // Build bio text
          let bioText = author.bio ?? "";
          try {
            if (author.richBioJson) {
              const rich = JSON.parse(author.richBioJson);
              const richBio = rich?.fullBio ?? rich?.bio ?? "";
              if (richBio.length > bioText.length) bioText = richBio;
            }
          } catch { /* use plain bio */ }

          if (bioText.length < 30) {
            // Not enough bio to tag — assign "self-help" as a safe default
            await db
              .update(authorProfiles)
              .set({ tagsJson: JSON.stringify(["self-help"]), updatedAt: new Date() })
              .where(eq(authorProfiles.authorName, author.authorName));
            tagged++;
            continue;
          }

          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are a librarian categorizing non-fiction authors. Given an author bio, select 2-4 tags from the provided taxonomy that best describe their primary subject areas. Return ONLY a JSON array of slug strings, e.g. ["business","psychology"]. Do not include any explanation.`,
              },
              {
                role: "user",
                content: `Author: ${author.authorName}\nBio: ${bioText.slice(0, 800)}\n\nAvailable tags: ${taxonomyList}\n\nReturn a JSON array of 2-4 tag slugs.`,
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "tag_slugs",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    slugs: {
                      type: "array",
                      items: { type: "string" },
                      description: "Array of 2-4 tag slugs from the taxonomy",
                    },
                  },
                  required: ["slugs"],
                  additionalProperties: false,
                },
              },
            },
          });

          const rawContent = response?.choices?.[0]?.message?.content;
          if (!rawContent) throw new Error("Empty LLM response");
          const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
          const parsed = JSON.parse(content) as { slugs: string[] };;
          const validSlugs = parsed.slugs
            .filter(s => TAG_TAXONOMY.some(t => t.slug === s))
            .slice(0, 4);

          if (validSlugs.length === 0) throw new Error("No valid slugs returned");

          await db
            .update(authorProfiles)
            .set({ tagsJson: JSON.stringify(validSlugs), updatedAt: new Date() })
            .where(eq(authorProfiles.authorName, author.authorName));

          tagged++;
          logger.info(`[autoTagAll] Tagged "${author.authorName}": ${validSlugs.join(", ")}`);
        } catch (err) {
          failed++;
          logger.warn(`[autoTagAll] Failed to tag "${author.authorName}": ${String(err)}`);
        }
      }

      return {
        tagged,
        failed,
        skipped: allAuthors.length - targets.length,
        total: allAuthors.length,
        message: `Tagged ${tagged} authors, ${failed} failed, ${allAuthors.length - targets.length} skipped (already tagged)`,
      };
    }),
});
