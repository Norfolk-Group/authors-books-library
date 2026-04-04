/**
 * contentItems.router.ts
 * tRPC procedures for the content_items table.
 * Supports the Media tab in the Home page.
 */
import { z } from "zod";
import { eq, and, like, desc, asc, sql, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { contentItems, authorContentLinks, bookProfiles } from "../../drizzle/schema";
import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";

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

  /**
   * Enrich a content item from a YouTube video or channel URL.
   * Fetches title, description, thumbnail, channel name, and publish date
   * from the YouTube Data API v3.
   */
  enrichFromYouTube: adminProcedure
    .input(
      z.object({
        /** YouTube video or channel URL */
        url: z.string().url(),
        /** Optional: link to an existing content item to update */
        contentItemId: z.number().optional(),
        /** Author names to link */
        authorNames: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ input }) => {
      const apiKey = ENV.youtubeApiKey;
      if (!apiKey) throw new Error("YOUTUBE_API_KEY is not configured");

      // Detect video vs channel
      const videoMatch = input.url.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
      const channelMatch = input.url.match(/(?:channel\/|@)([\w-]+)/);

      let title = "";
      let description = "";
      let thumbnailUrl: string | null = null;
      let publishedDate: string | null = null;
      let url = input.url;
      let contentType: "youtube_video" | "youtube_channel" = "youtube_video";
      let channelName: string | null = null;

      if (videoMatch) {
        const videoId = videoMatch[1];
        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
        const data = await res.json() as { items?: Array<{ snippet: { title: string; description: string; thumbnails?: { high?: { url: string } }; publishedAt?: string; channelTitle?: string } }> };
        const item = data.items?.[0];
        if (!item) throw new Error("Video not found on YouTube");
        title = item.snippet.title;
        description = item.snippet.description?.slice(0, 1000) ?? "";
        thumbnailUrl = item.snippet.thumbnails?.high?.url ?? null;
        publishedDate = item.snippet.publishedAt?.slice(0, 10) ?? null;
        channelName = item.snippet.channelTitle ?? null;
        url = `https://www.youtube.com/watch?v=${videoId}`;
        contentType = "youtube_video";
      } else if (channelMatch) {
        const handle = channelMatch[1];
        // Try forHandle first, fall back to search
        const apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${handle}&key=${apiKey}`;
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
        const data = await res.json() as { items?: Array<{ id: string; snippet: { title: string; description: string; thumbnails?: { high?: { url: string } }; publishedAt?: string } }> };
        const item = data.items?.[0];
        if (!item) throw new Error("Channel not found on YouTube");
        title = item.snippet.title;
        description = item.snippet.description?.slice(0, 1000) ?? "";
        thumbnailUrl = item.snippet.thumbnails?.high?.url ?? null;
        publishedDate = item.snippet.publishedAt?.slice(0, 10) ?? null;
        url = `https://www.youtube.com/channel/${item.id}`;
        contentType = "youtube_channel";
      } else {
        throw new Error("Could not extract a YouTube video ID or channel handle from the URL");
      }

      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      if (input.contentItemId) {
        // Update existing item
        await db.update(contentItems).set({
          title,
          description: description || undefined,
          coverImageUrl: thumbnailUrl ?? undefined,
          publishedDate: publishedDate ?? undefined,
          url,
          contentType,
          updatedAt: new Date(),
        }).where(eq(contentItems.id, input.contentItemId));
        return { success: true, id: input.contentItemId, title, thumbnailUrl, contentType };
      } else {
        // Create new item
        const [inserted] = await db.insert(contentItems).values({
          title,
          subtitle: channelName ?? undefined,
          description: description || undefined,
          coverImageUrl: thumbnailUrl ?? undefined,
          publishedDate: publishedDate ?? undefined,
          url,
          contentType,
          includedInLibrary: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        const newId = (inserted as unknown as { insertId: number }).insertId;
        if (input.authorNames.length > 0 && newId) {
          await db.insert(authorContentLinks).values(
            input.authorNames.map((name, i) => ({
              contentItemId: newId,
              authorName: name,
              role: "primary" as const,
              displayOrder: i,
            }))
          );
        }
        return { success: true, id: newId, title, thumbnailUrl, contentType };
      }
    }),

  /**
   * Enrich a content item from a TED talk URL.
   * Uses the TED public website API (talk.ted.com) to fetch title, speaker,
   * description, view count, event name, and thumbnail.
   * Supports both ted.com/talks/... and talks.ted.com/... URLs.
   */
  enrichFromTed: adminProcedure
    .input(
      z.object({
        /** TED talk URL, e.g. https://www.ted.com/talks/brene_brown_the_power_of_vulnerability */
        url: z.string().url(),
        /** Optional: link to an existing content item to update */
        contentItemId: z.number().optional(),
        /** Author names to link */
        authorNames: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ input }) => {
      // Extract slug from URL
      const slugMatch = input.url.match(/ted\.com\/talks\/([-\w]+)/);
      if (!slugMatch) throw new Error("Could not extract a TED talk slug from the URL");
      const slug = slugMatch[1];

      // TED public API endpoint
      const apiUrl = `https://www.ted.com/talks/${slug}.json`;
      const res = await fetch(apiUrl, {
        headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
      });

      let title = slug.replace(/_/g, " ");
      let description: string | null = null;
      let thumbnailUrl: string | null = null;
      let publishedDate: string | null = null;
      let speakerName: string | null = null;
      let eventName: string | null = null;
      let viewCount: number | null = null;

      if (res.ok) {
        try {
          const data = await res.json() as {
            title?: string;
            description?: string;
            image?: string;
            filmed?: string;
            published?: string;
            speaker_name?: string;
            event?: string;
            view_count?: number;
            speakers?: Array<{ first_name?: string; last_name?: string }>;
          };
          title = data.title ?? title;
          description = data.description ?? null;
          thumbnailUrl = data.image ?? null;
          publishedDate = (data.published ?? data.filmed ?? "").slice(0, 10) || null;
          speakerName = data.speaker_name ?? null;
          if (!speakerName && data.speakers?.[0]) {
            const s = data.speakers[0];
            speakerName = `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || null;
          }
          eventName = data.event ?? null;
          viewCount = data.view_count ?? null;
        } catch {
          // JSON parse failed — fall back to scraped data below
        }
      }

      // If JSON API failed, try scraping the OG tags via a simple HTML fetch
      if (!description) {
        const htmlRes = await fetch(`https://www.ted.com/talks/${slug}`, {
          headers: { "User-Agent": "Mozilla/5.0" },
        }).catch(() => null);
        if (htmlRes?.ok) {
          const html = await htmlRes.text();
          const ogDesc = html.match(/<meta property="og:description" content="([^"]+)"/);
          const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/);
          const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/);
          if (ogDesc) description = ogDesc[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"');
          if (ogImage && !thumbnailUrl) thumbnailUrl = ogImage[1];
          if (ogTitle && title === slug.replace(/_/g, " ")) title = ogTitle[1];
        }
      }

      const metadataJson = JSON.stringify({
        speakerName,
        eventName,
        viewCount,
        tedSlug: slug,
      });

      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      if (input.contentItemId) {
        await db.update(contentItems).set({
          title,
          subtitle: speakerName ?? undefined,
          description: description ?? undefined,
          coverImageUrl: thumbnailUrl ?? undefined,
          publishedDate: publishedDate ?? undefined,
          url: `https://www.ted.com/talks/${slug}`,
          contentType: "ted_talk",
          metadataJson,
          enrichedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(contentItems.id, input.contentItemId));
        return { success: true, id: input.contentItemId, title, thumbnailUrl, speakerName, viewCount };
      } else {
        const [inserted] = await db.insert(contentItems).values({
          title,
          subtitle: speakerName ?? undefined,
          description: description ?? undefined,
          coverImageUrl: thumbnailUrl ?? undefined,
          publishedDate: publishedDate ?? undefined,
          url: `https://www.ted.com/talks/${slug}`,
          contentType: "ted_talk",
          metadataJson,
          includedInLibrary: 1,
          enrichedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        const newId = (inserted as unknown as { insertId: number }).insertId;
        if (input.authorNames.length > 0 && newId) {
          await db.insert(authorContentLinks).values(
            input.authorNames.map((name, i) => ({
              contentItemId: newId,
              authorName: name,
              role: "primary" as const,
              displayOrder: i,
            }))
          );
        }
        return { success: true, id: newId, title, thumbnailUrl, speakerName, viewCount };
      }
    }),

  /**
   * Enrich a content item from an academic paper DOI or OpenAlex URL.
   * Uses the OpenAlex API (free, no key required) to fetch title, abstract,
   * authors, journal, citation count, and DOI.
   */
  enrichFromPaper: adminProcedure
    .input(
      z.object({
        /** DOI (e.g. 10.1038/nature12373) or full DOI URL or OpenAlex work ID */
        identifier: z.string().min(3),
        /** Optional: link to an existing content item to update */
        contentItemId: z.number().optional(),
        /** Author names to link */
        authorNames: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ input }) => {
      // Normalise identifier to DOI or OpenAlex work URL
      let openAlexUrl: string;
      const doiMatch = input.identifier.match(/10\.\d{4,}[\/.][\S]+/);
      const openAlexMatch = input.identifier.match(/openalex\.org\/(W\d+)/);
      const workIdMatch = input.identifier.match(/^W\d+$/);

      if (openAlexMatch || workIdMatch) {
        const workId = openAlexMatch ? openAlexMatch[1] : input.identifier;
        openAlexUrl = `https://api.openalex.org/works/${workId}?mailto=library@norfolkai.com`;
      } else if (doiMatch) {
        const doi = doiMatch[0];
        openAlexUrl = `https://api.openalex.org/works/https://doi.org/${doi}?mailto=library@norfolkai.com`;
      } else {
        // Try as a search query
        const q = encodeURIComponent(input.identifier);
        openAlexUrl = `https://api.openalex.org/works?search=${q}&per-page=1&mailto=library@norfolkai.com`;
      }

      const res = await fetch(openAlexUrl, {
        headers: { "User-Agent": "NCGLibrary/1.0 (library@norfolkai.com)" },
      });
      if (!res.ok) throw new Error(`OpenAlex API error: ${res.status}`);
      const raw = await res.json() as {
        id?: string;
        title?: string;
        abstract_inverted_index?: Record<string, number[]>;
        publication_year?: number;
        publication_date?: string;
        doi?: string;
        primary_location?: { source?: { display_name?: string } };
        cited_by_count?: number;
        authorships?: Array<{ author?: { display_name?: string } }>;
        open_access?: { oa_url?: string };
        results?: Array<{
          id?: string;
          title?: string;
          abstract_inverted_index?: Record<string, number[]>;
          publication_year?: number;
          publication_date?: string;
          doi?: string;
          primary_location?: { source?: { display_name?: string } };
          cited_by_count?: number;
          authorships?: Array<{ author?: { display_name?: string } }>;
          open_access?: { oa_url?: string };
        }>;
      };

      // Handle search result vs direct work result
      const work = raw.results ? raw.results[0] : raw;
      if (!work || !work.title) throw new Error("Paper not found in OpenAlex");

      const title = work.title;
      const doi = work.doi?.replace("https://doi.org/", "") ?? null;
      const journalName = work.primary_location?.source?.display_name ?? null;
      const citedByCount = work.cited_by_count ?? null;
      const publishedDate = work.publication_date ?? (work.publication_year ? `${work.publication_year}-01-01` : null);
      const paperUrl = work.open_access?.oa_url ?? (doi ? `https://doi.org/${doi}` : work.id ?? input.identifier);
      const paperAuthors = (work.authorships ?? []).map((a) => a.author?.display_name ?? "").filter(Boolean);

      // Reconstruct abstract from inverted index
      let abstract: string | null = null;
      if (work.abstract_inverted_index) {
        const wordPositions: Array<[string, number]> = [];
        for (const [word, positions] of Object.entries(work.abstract_inverted_index)) {
          for (const pos of positions) wordPositions.push([word, pos]);
        }
        wordPositions.sort((a, b) => a[1] - b[1]);
        abstract = wordPositions.map(([w]) => w).join(" ").slice(0, 1500);
      }

      const metadataJson = JSON.stringify({
        doi,
        journalName,
        citedByCount,
        paperAuthors,
        openAlexId: work.id,
      });

      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      if (input.contentItemId) {
        await db.update(contentItems).set({
          title,
          subtitle: journalName ?? undefined,
          description: abstract ?? undefined,
          url: paperUrl,
          publishedDate: publishedDate ?? undefined,
          contentType: "paper",
          metadataJson,
          ratingCount: citedByCount ?? undefined,
          enrichedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(contentItems.id, input.contentItemId));
        return { success: true, id: input.contentItemId, title, doi, citedByCount, journalName, paperAuthors };
      } else {
        const [inserted] = await db.insert(contentItems).values({
          title,
          subtitle: journalName ?? undefined,
          description: abstract ?? undefined,
          url: paperUrl,
          publishedDate: publishedDate ?? undefined,
          contentType: "paper",
          metadataJson,
          ratingCount: citedByCount ?? undefined,
          includedInLibrary: 1,
          enrichedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        const newId = (inserted as unknown as { insertId: number }).insertId;
        if (input.authorNames.length > 0 && newId) {
          await db.insert(authorContentLinks).values(
            input.authorNames.map((name, i) => ({
              contentItemId: newId,
              authorName: name,
              role: "primary" as const,
              displayOrder: i,
            }))
          );
        }
        return { success: true, id: newId, title, doi, citedByCount, journalName, paperAuthors };
      }
    }),

  /**
   * Enrich a content item from an IMDB URL or title search.
   * Uses the OMDB API (free tier: 1000 req/day) to fetch title, year,
   * plot, poster, genre, director, cast, and IMDB rating.
   * Falls back to RapidAPI IMDB if OMDB key is not set.
   */
  enrichFromFilm: adminProcedure
    .input(
      z.object({
        /** IMDB URL (https://www.imdb.com/title/tt...) or search title */
        identifier: z.string().min(2),
        /** Optional: link to an existing content item to update */
        contentItemId: z.number().optional(),
        /** Author names to link */
        authorNames: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ input }) => {
      const omdbKey = ENV.omdbApiKey;

      // Extract IMDB ID from URL if provided
      const imdbIdMatch = input.identifier.match(/tt\d{7,8}/);
      const imdbId = imdbIdMatch ? imdbIdMatch[0] : null;

      let apiUrl: string;
      if (imdbId && omdbKey) {
        apiUrl = `https://www.omdbapi.com/?i=${imdbId}&apikey=${omdbKey}&plot=full`;
      } else if (omdbKey) {
        const q = encodeURIComponent(input.identifier);
        apiUrl = `https://www.omdbapi.com/?t=${q}&apikey=${omdbKey}&plot=full`;
      } else {
        throw new Error("OMDB_API_KEY is not configured. Add it in Admin → Secrets to enable Film/TV enrichment.");
      }

      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error(`OMDB API error: ${res.status}`);
      const data = await res.json() as {
        Response?: string;
        Error?: string;
        Title?: string;
        Year?: string;
        Type?: string;
        Plot?: string;
        Poster?: string;
        imdbID?: string;
        imdbRating?: string;
        imdbVotes?: string;
        Genre?: string;
        Director?: string;
        Actors?: string;
        Released?: string;
        Runtime?: string;
        Language?: string;
      };

      if (data.Response === "False") {
        throw new Error(data.Error ?? "Film/TV show not found in OMDB");
      }

      const title = data.Title ?? input.identifier;
      const year = data.Year ?? null;
      const plot = data.Plot && data.Plot !== "N/A" ? data.Plot : null;
      const posterUrl = data.Poster && data.Poster !== "N/A" ? data.Poster : null;
      const imdbRating = data.imdbRating && data.imdbRating !== "N/A" ? parseFloat(data.imdbRating) : null;
      const imdbVotes = data.imdbVotes && data.imdbVotes !== "N/A" ? parseInt(data.imdbVotes.replace(/,/g, "")) : null;
      const genre = data.Genre ?? null;
      const director = data.Director && data.Director !== "N/A" ? data.Director : null;
      const actors = data.Actors && data.Actors !== "N/A" ? data.Actors : null;
      const released = data.Released && data.Released !== "N/A" ? data.Released : null;
      const language = data.Language && data.Language !== "N/A" ? data.Language.split(",")[0].trim() : null;
      const filmImdbId = data.imdbID ?? imdbId ?? null;
      const filmType = data.Type === "series" ? "tv_show" : "film";
      const filmUrl = filmImdbId ? `https://www.imdb.com/title/${filmImdbId}/` : null;

      // Parse release date
      let publishedDate: string | null = null;
      if (released) {
        const d = new Date(released);
        if (!isNaN(d.getTime())) publishedDate = d.toISOString().slice(0, 10);
      } else if (year) {
        publishedDate = `${year.slice(0, 4)}-01-01`;
      }

      const metadataJson = JSON.stringify({
        imdbId: filmImdbId,
        imdbRating,
        imdbVotes,
        genre,
        director,
        actors,
        runtime: data.Runtime,
      });

      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      if (input.contentItemId) {
        await db.update(contentItems).set({
          title,
          subtitle: genre ?? undefined,
          description: plot ?? undefined,
          coverImageUrl: posterUrl ?? undefined,
          publishedDate: publishedDate ?? undefined,
          url: filmUrl ?? undefined,
          contentType: filmType,
          rating: imdbRating ? String(imdbRating) : undefined,
          ratingCount: imdbVotes ?? undefined,
          language: language ?? undefined,
          metadataJson,
          enrichedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(contentItems.id, input.contentItemId));
        return { success: true, id: input.contentItemId, title, imdbRating, posterUrl, filmType };
      } else {
        const [inserted] = await db.insert(contentItems).values({
          title,
          subtitle: genre ?? undefined,
          description: plot ?? undefined,
          coverImageUrl: posterUrl ?? undefined,
          publishedDate: publishedDate ?? undefined,
          url: filmUrl ?? undefined,
          contentType: filmType,
          rating: imdbRating ? String(imdbRating) : undefined,
          ratingCount: imdbVotes ?? undefined,
          language: language ?? undefined,
          metadataJson,
          includedInLibrary: 1,
          enrichedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        const newId = (inserted as unknown as { insertId: number }).insertId;
        if (input.authorNames.length > 0 && newId) {
          await db.insert(authorContentLinks).values(
            input.authorNames.map((name, i) => ({
              contentItemId: newId,
              authorName: name,
              role: "primary" as const,
              displayOrder: i,
            }))
          );
        }
        return { success: true, id: newId, title, imdbRating, posterUrl, filmType };
      }
    }),

  /**
   * Enrich a content item from a Substack post URL.
   * Fetches post metadata via the Substack public API (no key required).
   * Supports both individual post URLs and publication home pages.
   */
  enrichFromSubstack: adminProcedure
    .input(
      z.object({
        /** Substack post URL, e.g. https://authorname.substack.com/p/post-slug */
        url: z.string().url(),
        /** Optional: link to an existing content item to update */
        contentItemId: z.number().optional(),
        /** Author names to link */
        authorNames: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ input }) => {
      // Parse the Substack URL
      const postMatch = input.url.match(/https?:\/\/([-\w]+)\.substack\.com\/p\/([-\w]+)/);
      const pubMatch = input.url.match(/https?:\/\/([-\w]+)\.substack\.com/);

      if (!pubMatch) throw new Error("Not a valid Substack URL");

      const publication = pubMatch[1];
      const postSlug = postMatch ? postMatch[2] : null;

      let title = "";
      let description: string | null = null;
      let thumbnailUrl: string | null = null;
      let publishedDate: string | null = null;
      let authorName: string | null = null;
      let likeCount: number | null = null;
      let commentCount: number | null = null;
      let postUrl = input.url;

      if (postSlug) {
        // Fetch individual post via Substack API
        const apiUrl = `https://${publication}.substack.com/api/v1/posts/${postSlug}`;
        const res = await fetch(apiUrl, {
          headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
        });
        if (res.ok) {
          const data = await res.json() as {
            title?: string;
            subtitle?: string;
            description?: string;
            cover_image?: string;
            post_date?: string;
            reactions?: { "❤"?: number };
            comment_count?: number;
            byline?: string;
            canonical_url?: string;
            publishedBylines?: Array<{ name?: string }>;
          };
          title = data.title ?? postSlug.replace(/-/g, " ");
          description = data.subtitle ?? data.description ?? null;
          thumbnailUrl = data.cover_image ?? null;
          publishedDate = data.post_date ? data.post_date.slice(0, 10) : null;
          likeCount = data.reactions?.["❤"] ?? null;
          commentCount = data.comment_count ?? null;
          authorName = data.byline ?? data.publishedBylines?.[0]?.name ?? null;
          postUrl = data.canonical_url ?? input.url;
        } else {
          // Fall back to OG tag scraping
          const htmlRes = await fetch(input.url, { headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => null);
          if (htmlRes?.ok) {
            const html = await htmlRes.text();
            const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/);
            const ogDesc = html.match(/<meta property="og:description" content="([^"]+)"/);
            const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/);
            if (ogTitle) title = ogTitle[1];
            if (ogDesc) description = ogDesc[1];
            if (ogImage) thumbnailUrl = ogImage[1];
          }
          if (!title) title = postSlug.replace(/-/g, " ");
        }
      } else {
        // Publication home page — fetch recent posts list
        const apiUrl = `https://${publication}.substack.com/api/v1/posts?limit=5`;
        const res = await fetch(apiUrl, {
          headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
        });
        if (!res.ok) throw new Error(`Substack API error: ${res.status}`);
        const data = await res.json() as Array<{
          title?: string;
          subtitle?: string;
          cover_image?: string;
          post_date?: string;
          canonical_url?: string;
        }>;
        const latest = data[0];
        if (!latest) throw new Error("No posts found for this Substack publication");
        title = `${publication} Newsletter`;
        description = latest.subtitle ?? null;
        thumbnailUrl = latest.cover_image ?? null;
        publishedDate = latest.post_date ? latest.post_date.slice(0, 10) : null;
        postUrl = `https://${publication}.substack.com`;
      }

      const metadataJson = JSON.stringify({
        publication,
        postSlug,
        likeCount,
        commentCount,
        substackAuthor: authorName,
      });

      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      if (input.contentItemId) {
        await db.update(contentItems).set({
          title,
          subtitle: authorName ?? undefined,
          description: description ?? undefined,
          coverImageUrl: thumbnailUrl ?? undefined,
          publishedDate: publishedDate ?? undefined,
          url: postUrl,
          contentType: postSlug ? "substack" : "newsletter",
          metadataJson,
          enrichedAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(contentItems.id, input.contentItemId));
        return { success: true, id: input.contentItemId, title, thumbnailUrl, likeCount, commentCount };
      } else {
        const [inserted] = await db.insert(contentItems).values({
          title,
          subtitle: authorName ?? undefined,
          description: description ?? undefined,
          coverImageUrl: thumbnailUrl ?? undefined,
          publishedDate: publishedDate ?? undefined,
          url: postUrl,
          contentType: postSlug ? "substack" : "newsletter",
          metadataJson,
          includedInLibrary: 1,
          enrichedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        const newId = (inserted as unknown as { insertId: number }).insertId;
        if (input.authorNames.length > 0 && newId) {
          await db.insert(authorContentLinks).values(
            input.authorNames.map((name, i) => ({
              contentItemId: newId,
              authorName: name,
              role: "primary" as const,
              displayOrder: i,
            }))
          );
        }
        return { success: true, id: newId, title, thumbnailUrl, likeCount, commentCount };
      }
    }),

  /**
   * Migrate book_profiles rows into content_items.
   * Idempotent: skips books whose title already exists as a content_item.
   * Maps book fields to content_item fields:
   *   bookTitle → title, summary → description, authorName → authorContentLinks,
   *   coverImageUrl/s3CoverUrl → coverImageUrl/s3CoverUrl, publishedDate, rating,
   *   ratingCount, tagsJson, amazonUrl → url, isbn/publisher → metadataJson.
   * Returns counts of migrated, skipped, and failed rows.
   */
  migrateFromBookProfiles: adminProcedure
    .input(
      z.object({
        /** Dry-run: compute counts without writing to DB */
        dryRun: z.boolean().default(false),
        /** Batch size (default 50) */
        batchSize: z.number().min(1).max(200).default(50),
        /** Offset for resumable migration */
        offset: z.number().min(0).default(0),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Fetch book_profiles batch
      const books = await db
        .select()
        .from(bookProfiles)
        .limit(input.batchSize)
        .offset(input.offset);

      if (books.length === 0) {
        return { migrated: 0, skipped: 0, failed: 0, total: 0, done: true };
      }

      // Fetch existing content_items titles to detect duplicates
      const existingTitles = new Set<string>();
      const existingRows = await db
        .select({ title: contentItems.title })
        .from(contentItems)
        .where(eq(contentItems.contentType, "book"));
      for (const row of existingRows) existingTitles.add(row.title.toLowerCase().trim());

      let migrated = 0;
      let skipped = 0;
      let failed = 0;

      for (const book of books) {
        const normalizedTitle = book.bookTitle.toLowerCase().trim();
        if (existingTitles.has(normalizedTitle)) {
          skipped++;
          continue;
        }

        if (input.dryRun) {
          migrated++;
          continue;
        }

        try {
          // Build metadata JSON from book-specific fields
          const metadataJson = JSON.stringify({
            isbn: book.isbn ?? null,
            publisher: book.publisher ?? null,
            publisherUrl: book.publisherUrl ?? null,
            amazonUrl: book.amazonUrl ?? null,
            goodreadsUrl: book.goodreadsUrl ?? null,
            wikipediaUrl: book.wikipediaUrl ?? null,
            keyThemes: book.keyThemes ?? null,
            format: book.format ?? null,
            possessionStatus: book.possessionStatus ?? null,
            resourceLinksJson: book.resourceLinksJson ?? null,
            sourceBookProfileId: book.id,
          });

          const [inserted] = await db.insert(contentItems).values({
            contentType: "book",
            title: book.bookTitle,
            description: book.summary ?? undefined,
            coverImageUrl: book.s3CoverUrl ?? book.coverImageUrl ?? undefined,
            s3CoverUrl: book.s3CoverUrl ?? undefined,
            s3CoverKey: book.s3CoverKey ?? undefined,
            publishedDate: book.publishedDate ?? undefined,
            url: book.amazonUrl ?? undefined,
            rating: book.rating ?? undefined,
            ratingCount: book.ratingCount ?? undefined,
            tagsJson: book.tagsJson ?? undefined,
            metadataJson,
            includedInLibrary: 1,
            enrichedAt: book.enrichedAt ?? undefined,
            createdAt: book.createdAt,
            updatedAt: book.updatedAt,
          });
          const newId = (inserted as unknown as { insertId: number }).insertId;

          // Link author
          if (book.authorName && newId) {
            await db.insert(authorContentLinks).values({
              contentItemId: newId,
              authorName: book.authorName,
              role: "primary",
              displayOrder: 0,
            }).onDuplicateKeyUpdate({ set: { role: "primary" } });
          }

          existingTitles.add(normalizedTitle);
          migrated++;
        } catch (err) {
          console.error(`[migrateFromBookProfiles] Failed for "${book.bookTitle}":`, err);
          failed++;
        }
      }

      // Get total count for progress reporting
      const [{ total }] = await db
        .select({ total: sql<number>`COUNT(*)` })
        .from(bookProfiles);

      return {
        migrated,
        skipped,
        failed,
        total: Number(total),
        done: input.offset + books.length >= Number(total),
      };
    }),

  /**
   * Enrich a content item from a podcast search query.
   * Uses the iTunes Search API (no key required) to find podcast episodes.
   */
  enrichFromPodcast: adminProcedure
    .input(
      z.object({
        /** Search query: podcast name + episode title or author name */
        query: z.string().min(2),
        /** Optional: link to an existing content item to update */
        contentItemId: z.number().optional(),
        /** Author names to link */
        authorNames: z.array(z.string()).default([]),
        /** Max results to return for selection */
        limit: z.number().min(1).max(10).default(5),
      })
    )
    .mutation(async ({ input }) => {
      const encoded = encodeURIComponent(input.query);
      const apiUrl = `https://itunes.apple.com/search?term=${encoded}&media=podcast&entity=podcastEpisode&limit=${input.limit}`;
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error(`iTunes API error: ${res.status}`);
      const data = await res.json() as {
        results?: Array<{
          trackName?: string;
          collectionName?: string;
          description?: string;
          artworkUrl600?: string;
          releaseDate?: string;
          trackViewUrl?: string;
          episodeUrl?: string;
          shortDescription?: string;
        }>
      };
      const results = (data.results ?? []).map((r) => ({
        title: r.trackName ?? "",
        podcastName: r.collectionName ?? "",
        description: r.description ?? r.shortDescription ?? "",
        thumbnailUrl: r.artworkUrl600 ?? null,
        publishedDate: r.releaseDate ? r.releaseDate.slice(0, 10) : null,
        url: r.trackViewUrl ?? r.episodeUrl ?? null,
      }));

      if (results.length === 0) {
        return { success: false, results: [], message: "No podcast episodes found for this query" };
      }

      // If contentItemId provided, auto-apply the first result
      if (input.contentItemId && results[0]) {
        const r = results[0];
        const db = await getDb();
        if (!db) throw new Error("DB unavailable");
        await db.update(contentItems).set({
          title: r.title,
          subtitle: r.podcastName || undefined,
          description: r.description || undefined,
          coverImageUrl: r.thumbnailUrl ?? undefined,
          publishedDate: r.publishedDate ?? undefined,
          url: r.url ?? undefined,
          contentType: "podcast_episode",
          updatedAt: new Date(),
        }).where(eq(contentItems.id, input.contentItemId));
        return { success: true, results, applied: results[0] };
      }

      // Otherwise return results for the caller to pick from
      return { success: true, results };
    }),

  /** Get all non-book content items linked to a specific author */
  getByAuthor: publicProcedure
    .input(z.object({ authorName: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
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
        })
        .from(contentItems)
        .innerJoin(
          authorContentLinks,
          eq(authorContentLinks.contentItemId, contentItems.id)
        )
        .where(
          and(
            eq(authorContentLinks.authorName, input.authorName),
            sql`${contentItems.contentType} != 'book'`,
            eq(contentItems.includedInLibrary, 1)
          )
        )
        .orderBy(desc(contentItems.createdAt))
        .limit(50);
      return rows;
    }),
});
