/**
 * contentItems.router.ts
 * tRPC procedures for the content_items table.
 * Supports the Media tab in the Home page.
 */
import { z } from "zod";
import { eq, and, like, desc, asc, sql, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { contentItems, authorContentLinks } from "../../drizzle/schema";
import { publicProcedure, adminProcedure, router } from "../_core/trpc";

// ── Content type groupings for the Media tab sub-filters ────────────────────
export const MEDIA_GROUPS = {
  written: [
    "paper", "article", "substack", "newsletter", "blog_post", "social_post",
    "website", "speech", "interview",
  ],
  audio_video: [
    "podcast", "podcast_episode", "youtube_video", "youtube_channel",
    "ted_talk", "radio",
  ],
  courses: [
    "masterclass", "online_course", "tool",
  ],
  film_tv: [
    "tv_show", "tv_episode", "film", "photography",
  ],
  other: ["other"],
} as const;

export type MediaGroup = keyof typeof MEDIA_GROUPS;

const contentTypeEnum = z.enum([
  "book", "paper", "article", "substack", "newsletter",
  "podcast", "podcast_episode", "youtube_video", "youtube_channel",
  "ted_talk", "masterclass", "online_course", "tv_show", "tv_episode",
  "film", "radio", "photography", "social_post", "speech", "interview",
  "blog_post", "website", "tool", "other",
]);

export const contentItemsRouter = router({
  /**
   * List content items with optional filtering.
   * Used by the Media tab in the Home page.
   */
  list: publicProcedure
    .input(
      z.object({
        /** Filter by media group (written | audio_video | courses | film_tv | other | all) */
        group: z.enum(["all", "written", "audio_video", "courses", "film_tv", "other"]).default("all"),
        /** Text search across title, subtitle, description */
        query: z.string().default(""),
        /** Sort order */
        sort: z.enum(["newest", "oldest", "title-asc", "title-desc", "rating-desc"]).default("newest"),
        /** Pagination */
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
        /** Only show items included in the library */
        includedOnly: z.boolean().default(true),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      // Build content type filter from group
      const typeFilter =
        input.group === "all"
          ? null
          : (MEDIA_GROUPS[input.group as MediaGroup] as readonly string[]);

      const conditions = [];

      if (input.includedOnly) {
        conditions.push(eq(contentItems.includedInLibrary, 1));
      }

      // Exclude books from the media tab (books have their own tab)
      conditions.push(
        sql`${contentItems.contentType} != 'book'`
      );

      if (typeFilter && typeFilter.length > 0) {
        // Cast to the enum type expected by drizzle inArray
        type ContentTypeVal = typeof contentItems.contentType._;
        conditions.push(
          inArray(
            contentItems.contentType,
            typeFilter as unknown as ContentTypeVal["data"][]
          )
        );
      }

      if (input.query) {
        const q = `%${input.query}%`;
        conditions.push(
          sql`(${contentItems.title} LIKE ${q} OR ${contentItems.subtitle} LIKE ${q} OR ${contentItems.description} LIKE ${q})`
        );
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      // Count total
      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(contentItems)
        .where(where);

      // Build order
      let orderBy;
      switch (input.sort) {
        case "oldest":
          orderBy = asc(contentItems.createdAt);
          break;
        case "title-asc":
          orderBy = asc(contentItems.title);
          break;
        case "title-desc":
          orderBy = desc(contentItems.title);
          break;
        case "rating-desc":
          orderBy = desc(contentItems.rating);
          break;
        default:
          orderBy = desc(contentItems.createdAt);
      }

      const rows = await db
        .select({
          id: contentItems.id,
          contentType: contentItems.contentType,
          title: contentItems.title,
          subtitle: contentItems.subtitle,
          description: contentItems.description,
          url: contentItems.url,
          coverImageUrl: contentItems.coverImageUrl,
          s3CoverUrl: contentItems.s3CoverUrl,
          publishedDate: contentItems.publishedDate,
          rating: contentItems.rating,
          ratingCount: contentItems.ratingCount,
          language: contentItems.language,
          tagsJson: contentItems.tagsJson,
          metadataJson: contentItems.metadataJson,
          enrichedAt: contentItems.enrichedAt,
          createdAt: contentItems.createdAt,
        })
        .from(contentItems)
        .where(where)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset);

      // Attach author names for each item
      const itemIds = rows.map((r) => r.id);
      let authorMap = new Map<number, string[]>();
      if (itemIds.length > 0) {
        const links = await db
          .select({
            contentItemId: authorContentLinks.contentItemId,
            authorName: authorContentLinks.authorName,
          })
          .from(authorContentLinks)
          .where(inArray(authorContentLinks.contentItemId, itemIds))
          .orderBy(asc(authorContentLinks.displayOrder));
        for (const link of links) {
          const arr = authorMap.get(link.contentItemId) ?? [];
          arr.push(link.authorName);
          authorMap.set(link.contentItemId, arr);
        }
      }

      return {
        items: rows.map((r) => ({
          ...r,
          authors: authorMap.get(r.id) ?? [],
        })),
        total: Number(count),
      };
    }),

  /**
   * Get counts per content type group (for sub-filter badges).
   */
  getGroupCounts: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { all: 0, written: 0, audio_video: 0, courses: 0, film_tv: 0, other: 0 };

    const rows = await db
      .select({
        contentType: contentItems.contentType,
        count: sql<number>`COUNT(*)`,
      })
      .from(contentItems)
      .where(
        and(
          eq(contentItems.includedInLibrary, 1),
          sql`${contentItems.contentType} != 'book'`
        )
      )
      .groupBy(contentItems.contentType);

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.contentType] = Number(row.count);
    }

    const sumGroup = (types: readonly string[]) =>
      types.reduce((acc, t) => acc + (counts[t] ?? 0), 0);

    const written = sumGroup(MEDIA_GROUPS.written);
    const audio_video = sumGroup(MEDIA_GROUPS.audio_video);
    const courses = sumGroup(MEDIA_GROUPS.courses);
    const film_tv = sumGroup(MEDIA_GROUPS.film_tv);
    const other = sumGroup(MEDIA_GROUPS.other);
    const all = written + audio_video + courses + film_tv + other;

    return { all, written, audio_video, courses, film_tv, other };
  }),

  /**
   * Create a new content item (admin only).
   */
  create: adminProcedure
    .input(
      z.object({
        contentType: contentTypeEnum,
        title: z.string().min(1).max(512),
        subtitle: z.string().max(512).optional(),
        description: z.string().optional(),
        url: z.string().url().optional(),
        coverImageUrl: z.string().url().optional(),
        publishedDate: z.string().optional(),
        language: z.string().optional(),
        metadataJson: z.string().optional(),
        authorNames: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const { authorNames, ...rest } = input;
      const [result] = await db.insert(contentItems).values({
        ...rest,
        includedInLibrary: 1,
      });
      const newId = (result as { insertId?: number }).insertId;
      if (!newId) throw new Error("Insert failed");

      if (authorNames && authorNames.length > 0) {
        await db.insert(authorContentLinks).values(
          authorNames.map((name, i) => ({
            contentItemId: newId,
            authorName: name,
            role: "primary" as const,
            displayOrder: i,
          }))
        );
      }

      return { id: newId };
    }),

  /**
   * Update a content item (admin only).
   */
  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        contentType: contentTypeEnum.optional(),
        title: z.string().min(1).max(512).optional(),
        subtitle: z.string().max(512).nullish(),
        description: z.string().nullish(),
        url: z.string().url().nullish(),
        coverImageUrl: z.string().url().nullish(),
        publishedDate: z.string().nullish(),
        language: z.string().nullish(),
        metadataJson: z.string().nullish(),
        includedInLibrary: z.number().min(0).max(1).optional(),
        authorNames: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const { id, authorNames, ...rest } = input;
      const updateData = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined)
      );

      if (Object.keys(updateData).length > 0) {
        await db.update(contentItems).set(updateData).where(eq(contentItems.id, id));
      }

      if (authorNames !== undefined) {
        // Replace all author links
        await db.delete(authorContentLinks).where(eq(authorContentLinks.contentItemId, id));
        if (authorNames.length > 0) {
          await db.insert(authorContentLinks).values(
            authorNames.map((name, i) => ({
              contentItemId: id,
              authorName: name,
              role: "primary" as const,
              displayOrder: i,
            }))
          );
        }
      }

      return { success: true };
    }),

  /**
   * Upload a cover image for a content item.
   * Accepts a base64-encoded image, stores it in S3, and updates the DB row.
   */
  uploadCoverImage: adminProcedure
    .input(
      z.object({
        id: z.number(),
        imageBase64: z.string().min(1),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const buffer = Buffer.from(input.imageBase64, "base64");
      if (buffer.byteLength > 5 * 1024 * 1024) {
        throw new Error("Image too large \u2014 maximum 5 MB");
      }
      const ext = input.mimeType.split("/")[1] ?? "jpg";
      const key = `content-items/covers/${input.id}-${Date.now()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      await db
        .update(contentItems)
        .set({ s3CoverUrl: url, s3CoverKey: key, coverImageUrl: url })
        .where(eq(contentItems.id, input.id));
      return { url };
    }),

  /**
   * Delete a content item (admin only).
   */
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(contentItems).where(eq(contentItems.id, input.id));
      return { success: true };
    }),
});
