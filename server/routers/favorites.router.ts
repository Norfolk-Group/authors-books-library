/**
 * favorites.router.ts
 * Manages user favorites for authors and books.
 * Favorites are used to prioritize enrichment pipeline runs.
 */
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { favorites } from "../../drizzle/schema";
import { and, eq, count } from "drizzle-orm";

export const favoritesRouter = router({
  /**
   * Toggle a favorite on/off for the current user.
   * Returns { isFavorite: boolean } reflecting the new state.
   */
  toggle: protectedProcedure
    .input(
      z.object({
        entityType: z.enum(["author", "book"]),
        entityKey: z.string().min(1).max(512),
        displayName: z.string().max(512).optional(),
        imageUrl: z.string().max(1024).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const userId = ctx.user.openId;
      const existing = await db
        .select({ id: favorites.id })
        .from(favorites)
        .where(
          and(
            eq(favorites.userId, userId),
            eq(favorites.entityType, input.entityType),
            eq(favorites.entityKey, input.entityKey)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Remove favorite
        await db
          .delete(favorites)
          .where(eq(favorites.id, existing[0].id));
        return { isFavorite: false };
      } else {
        // Add favorite
        await db.insert(favorites).values({
          userId,
          entityType: input.entityType,
          entityKey: input.entityKey,
          displayName: input.displayName ?? null,
          imageUrl: input.imageUrl ?? null,
        });
        return { isFavorite: true };
      }
    }),

  /**
   * List all favorites for the current user, optionally filtered by entityType.
   */
  list: protectedProcedure
    .input(
      z.object({
        entityType: z.enum(["author", "book"]).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const userId = ctx.user.openId;
      const conditions = [eq(favorites.userId, userId)];
      if (input?.entityType) {
        conditions.push(eq(favorites.entityType, input.entityType));
      }

      return db
        .select()
        .from(favorites)
        .where(and(...conditions))
        .orderBy(favorites.createdAt);
    }),

  /**
   * Check if specific entities are favorited by the current user.
   * Returns a map of entityKey -> boolean.
   */
  checkMany: protectedProcedure
    .input(
      z.object({
        entityType: z.enum(["author", "book"]),
        entityKeys: z.array(z.string()).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return {};

      const userId = ctx.user.openId;
      const rows = await db
        .select({ entityKey: favorites.entityKey })
        .from(favorites)
        .where(
          and(
            eq(favorites.userId, userId),
            eq(favorites.entityType, input.entityType)
          )
        );

      const favoriteSet = new Set(rows.map((r) => r.entityKey));
      const result: Record<string, boolean> = {};
      for (const key of input.entityKeys) {
        result[key] = favoriteSet.has(key);
      }
      return result;
    }),

  /**
   * Get total favorite counts per entity type for the current user.
   */
  counts: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { authors: 0, books: 0 };

    const userId = ctx.user.openId;
    const [authorCount] = await db
      .select({ cnt: count() })
      .from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.entityType, "author")));
    const [bookCount] = await db
      .select({ cnt: count() })
      .from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.entityType, "book")));

    return {
      authors: Number(authorCount?.cnt ?? 0),
      books: Number(bookCount?.cnt ?? 0),
    };
  }),

  /**
   * Public: get aggregate favorite counts for all entities (for display on cards).
   * Returns top-N most favorited entities.
   */
  topFavorited: publicProcedure
    .input(z.object({ entityType: z.enum(["author", "book"]), limit: z.number().max(50).default(20) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const rows = await db
        .select({ entityKey: favorites.entityKey, cnt: count() })
        .from(favorites)
        .where(eq(favorites.entityType, input.entityType))
        .groupBy(favorites.entityKey)
        .orderBy(count())
        .limit(input.limit);

      return rows.map((r) => ({ entityKey: r.entityKey, count: Number(r.cnt) }));
    }),
});
