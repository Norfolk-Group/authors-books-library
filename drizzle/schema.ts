import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  /** Real author photo URL sourced from Wikipedia or publisher pages via Apify */
  photoUrl: varchar("photoUrl", { length: 1024 }),
  /** Source URL where the photo was found */
  photoSourceUrl: varchar("photoSourceUrl", { length: 1024 }),
  enrichedAt: timestamp("enrichedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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
  /** Book cover image URL from Google Books */
  coverImageUrl: varchar("coverImageUrl", { length: 1024 }),
  /** Published date string, e.g. "2023-04-18" */
  publishedDate: varchar("publishedDate", { length: 32 }),
  /** ISBN-13 */
  isbn: varchar("isbn", { length: 20 }),
  /** Publisher name */
  publisher: varchar("publisher", { length: 256 }),
  enrichedAt: timestamp("enrichedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BookProfile = typeof bookProfiles.$inferSelect;
export type InsertBookProfile = typeof bookProfiles.$inferInsert;
