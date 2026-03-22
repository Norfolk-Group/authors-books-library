import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Author profiles — enriched via Wikipedia/Wikidata, keyed by author base name
export const authorProfiles = mysqlTable("author_profiles", {
  id: int("id").autoincrement().primaryKey(),
  /** Base name (before " - "), e.g. "Adam Grant" */
  authorName: varchar("authorName", { length: 256 }).notNull().unique(),
  bio: text("bio"),
  websiteUrl: varchar("websiteUrl", { length: 512 }),
  twitterUrl: varchar("twitterUrl", { length: 512 }),
  linkedinUrl: varchar("linkedinUrl", { length: 512 }),
  /** Real author avatar URL sourced from Wikipedia or publisher pages via Apify */
  avatarUrl: varchar("avatarUrl", { length: 1024 }),
  /** Source URL where the avatar was found */
  avatarSourceUrl: varchar("avatarSourceUrl", { length: 1024 }),
  /** S3-mirrored avatar URL — served from Manus CDN for reliability */
  s3AvatarUrl: varchar("s3AvatarUrl", { length: 1024 }),
  /** S3 key for the mirrored avatar (used for deduplication/cleanup) */
  s3AvatarKey: varchar("s3AvatarKey", { length: 512 }),
  /**
   * Which tier of the enrichment waterfall provided the avatar:
   * - wikipedia: Wikipedia REST API (Tier 1)
   * - tavily: Tavily image search (Tier 2)
   * - apify: Apify web scrape (Tier 3)
   * - ai: Replicate AI-generated portrait (Tier 5 fallback)
   */
  avatarSource: mysqlEnum("avatarSource", ["wikipedia", "tavily", "apify", "ai", "google-imagen"]),
  enrichedAt: timestamp("enrichedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  /** Index for fast lookups by author name (used in enrichment waterfall) */
  authorNameIdx: index("author_profiles_authorName_idx").on(table.authorName),
  /** Index for finding un-enriched rows quickly */
  enrichedAtIdx: index("author_profiles_enrichedAt_idx").on(table.enrichedAt),
}));

export type AuthorProfile = typeof authorProfiles.$inferSelect;
export type InsertAuthorProfile = typeof authorProfiles.$inferInsert;

// Book profiles — enriched via Google Books API, keyed by book title (without author suffix)
export const bookProfiles = mysqlTable("book_profiles", {
  id: int("id").autoincrement().primaryKey(),
  /** Clean title (before " - "), e.g. "Hidden Potential" */
  bookTitle: varchar("bookTitle", { length: 512 }).notNull().unique(),
  /** Author name extracted from the book entry */
  authorName: varchar("authorName", { length: 256 }),
  /** 2-3 sentence summary of the book */
  summary: text("summary"),
  /** Comma-separated key themes, e.g. "habits,productivity,neuroscience" */
  keyThemes: text("keyThemes"),
  /** Average rating out of 5, e.g. "4.6" */
  rating: varchar("rating", { length: 8 }),
  /** Number of ratings/reviews as a formatted string, e.g. "120,000" */
  ratingCount: varchar("ratingCount", { length: 32 }),
  /** Amazon product page URL */
  amazonUrl: varchar("amazonUrl", { length: 512 }),
  /** Goodreads book page URL */
  goodreadsUrl: varchar("goodreadsUrl", { length: 512 }),
  /** Additional resource URL (author's site, podcast, summary, etc.) */
  resourceUrl: varchar("resourceUrl", { length: 512 }),
  /** Label for the resource URL */
  resourceLabel: varchar("resourceLabel", { length: 128 }),
  /** Book cover image URL from Google Books or Apify scrape */
  coverImageUrl: varchar("coverImageUrl", { length: 1024 }),
  /** S3-mirrored cover URL — served from Manus CDN for reliability */
  s3CoverUrl: varchar("s3CoverUrl", { length: 1024 }),
  /** S3 key for the mirrored cover (used for deduplication/cleanup) */
  s3CoverKey: varchar("s3CoverKey", { length: 512 }),
  /** Published date string, e.g. "2023-04-18" */
  publishedDate: varchar("publishedDate", { length: 32 }),
  /** ISBN-13 */
  isbn: varchar("isbn", { length: 20 }),
  /** Publisher name */
  publisher: varchar("publisher", { length: 256 }),
  enrichedAt: timestamp("enrichedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  /** Index for fast lookups by author name (used in book enrichment joins) */
  authorNameIdx: index("book_profiles_authorName_idx").on(table.authorName),
  /** Index for finding un-enriched books quickly */
  enrichedAtIdx: index("book_profiles_enrichedAt_idx").on(table.enrichedAt),
}));

export type BookProfile = typeof bookProfiles.$inferSelect;
export type InsertBookProfile = typeof bookProfiles.$inferInsert;

// Sync status — tracks background Drive scan jobs
export const syncStatus = mysqlTable("sync_status", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID
  /** Job type: 'drive-scan' | 'mirror-covers' | 'mirror-avatars' */
  jobType: varchar("jobType", { length: 64 }).notNull().default("drive-scan"),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).notNull().default("pending"),
  /** 0-100 progress percentage */
  progress: int("progress").notNull().default(0),
  totalItems: int("totalItems"),
  processedItems: int("processedItems").notNull().default(0),
  /** Summary message shown to user */
  message: text("message"),
  /** Error message if failed */
  error: text("error"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type SyncStatus = typeof syncStatus.$inferSelect;
export type InsertSyncStatus = typeof syncStatus.$inferInsert;

// Admin action log — tracks when each admin action was last run
export const adminActionLog = mysqlTable("admin_action_log", {
  id: int("id").autoincrement().primaryKey(),
  /** Action key, e.g. 'regenerate_db', 'enrich_bios', 'scrape_covers' */
  actionKey: varchar("actionKey", { length: 128 }).notNull().unique(),
  /** Human-readable label */
  label: varchar("label", { length: 256 }),
  /** Last run timestamp */
  lastRunAt: timestamp("lastRunAt"),
  /** Duration of last run in ms */
  lastRunDurationMs: int("lastRunDurationMs"),
  /** Result: success or error message */
  lastRunResult: text("lastRunResult"),
  /** How many items were processed */
  lastRunItemCount: int("lastRunItemCount"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AdminActionLog = typeof adminActionLog.$inferSelect;
export type InsertAdminActionLog = typeof adminActionLog.$inferInsert;
