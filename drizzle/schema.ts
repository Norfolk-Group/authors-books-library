import { decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  /** Which tier of the enrichment waterfall provided the avatar:
   * - wikipedia: Wikipedia REST API (Tier 1)
   * - tavily: Tavily image search (Tier 2)
   * - apify: Apify web scrape (Tier 3)
   * - ai: Replicate AI-generated avatar (Tier 5 fallback)
   * - google-imagen: Google Imagen / Nano Banana AI-generated
   * - drive: Manually uploaded via Google Drive reseed
   */
  avatarSource: mysqlEnum("avatarSource", ["wikipedia", "tavily", "apify", "ai", "google-imagen", "drive"]),
  /**
   * Cached structured JSON from the Research LLM stage.
   * Stores AuthorDescription — physical appearance, style, personality.
   * Avoids re-research on avatar regeneration.
   */
  authorDescriptionJson: text("authorDescriptionJson"),
  /** When the authorDescriptionJson was last generated */
  authorDescriptionCachedAt: timestamp("authorDescriptionCachedAt"),
  /**
   * The exact image generation prompt used to create the current avatar.
   * Stored for debugging, auditing, and prompt-only regeneration.
   */
  lastAvatarPrompt: text("lastAvatarPrompt"),
  /** When the lastAvatarPrompt was built */
  lastAvatarPromptBuiltAt: timestamp("lastAvatarPromptBuiltAt"),
  /** Google Drive file ID for the generated/uploaded avatar */
  driveAvatarFileId: varchar("driveAvatarFileId", { length: 255 }),
  /** Which vendor generated the current AI avatar (google, replicate, openai, stability) */
  avatarGenVendor: varchar("avatarGenVendor", { length: 50 }),
  /** Which model generated the current AI avatar (e.g. nano-banana, flux-schnell) */
  avatarGenModel: varchar("avatarGenModel", { length: 100 }),
  /** Which vendor was used for the research LLM stage of the meticulous pipeline (e.g. google, anthropic) */
  avatarResearchVendor: varchar("avatarResearchVendor", { length: 50 }),
  /** Which model was used for the research LLM stage (e.g. gemini-2.5-flash, claude-3-5-sonnet) */
  avatarResearchModel: varchar("avatarResearchModel", { length: 100 }),
  /**
   * The best reference photo URL used during the meticulous pipeline research stage.
   * Sourced from Tavily image search, Wikipedia, or official author website.
   * Stored for transparency, auditing, and display alongside the generated portrait.
   */
  bestReferencePhotoUrl: varchar("bestReferencePhotoUrl", { length: 1024 }),
  /** Author's podcast URL (e.g. Spotify, Apple Podcasts, own feed) */
  podcastUrl: varchar("podcastUrl", { length: 512 }),
  /** Author's personal blog URL */
  blogUrl: varchar("blogUrl", { length: 512 }),
  /** Author's Substack newsletter URL */
  substackUrl: varchar("substackUrl", { length: 512 }),
  /** Author's Medium profile URL (e.g. medium.com/@authorname) */
  mediumUrl: varchar("mediumUrl", { length: 512 }),
  /** Number of posts published on Substack (from public /api/v1/publication endpoint) */
  substackPostCount: int("substackPostCount"),
  /** Subscriber range label from Substack (e.g. '10K-50K', '50K-100K') */
  substackSubscriberRange: varchar("substackSubscriberRange", { length: 50 }),
  /** ISO timestamp of last Substack stats fetch */
  substackStatsEnrichedAt: timestamp("substackStatsEnrichedAt"),
  /**
   * JSON object storing social stats per platform.
   * Shape: {
   *   github?: { followers, publicRepos, totalStars, fetchedAt },
   *   substack?: { postCount, subscriberRange, fetchedAt },
   *   youtube?: { subscriberCount, videoCount, viewCount, channelId, fetchedAt },
   *   twitter?: { followerCount, fetchedAt },
   *   linkedin?: { followerCount, fetchedAt },
   *   instagram?: { followerCount, fetchedAt },
   *   tiktok?: { followerCount, likeCount, fetchedAt },
   *   facebook?: { fanCount, fetchedAt },
   * }
   */
  socialStatsJson: text("socialStatsJson"),
  /** When social stats were last fetched across all platforms */
  socialStatsEnrichedAt: timestamp("socialStatsEnrichedAt"),
  /** Author's YouTube channel URL */
  youtubeUrl: varchar("youtubeUrl", { length: 512 }),
  /** Author's Facebook page URL */
  facebookUrl: varchar("facebookUrl", { length: 512 }),
  /** Author's Instagram profile URL */
  instagramUrl: varchar("instagramUrl", { length: 512 }),
  /** Author's TikTok profile URL */
  tiktokUrl: varchar("tiktokUrl", { length: 512 }),
  /** Author's GitHub profile URL */
  githubUrl: varchar("githubUrl", { length: 512 }),
  /** Author's business or company website URL */
  businessWebsiteUrl: varchar("businessWebsiteUrl", { length: 512 }),
  /** Author's email newsletter URL (Mailchimp, ConvertKit, Beehiiv, etc.) */
  newsletterUrl: varchar("newsletterUrl", { length: 512 }),
  /** Author's speaking bureau or booking page URL */
  speakingUrl: varchar("speakingUrl", { length: 512 }),
  /** Stock ticker symbol for author-linked public company (e.g. 'AAPL' for Tim Cook) */
  stockTicker: varchar("stockTicker", { length: 20 }),
  /** Wikipedia article URL for this author */
  wikipediaUrl: varchar("wikipediaUrl", { length: 512 }),
  /** JSON array of newspaper/online article links: [{title, url, date, publication}] */
  newspaperArticlesJson: text("newspaperArticlesJson"),
  /** JSON array of other links: [{label, url, type}] */
  otherLinksJson: text("otherLinksJson"),
  /** When the links were last enriched via Perplexity/Tavily */
  lastLinksEnrichedAt: timestamp("lastLinksEnrichedAt"),
  /** Which tool enriched the links ('perplexity', 'tavily', 'manual') */
  linksEnrichmentSource: varchar("linksEnrichmentSource", { length: 50 }),
  /**
   * JSON object tracking enrichment status per platform.
   * Shape: { youtube?: { channelId, subscriberCount, enrichedAt }, ted?: { talkUrl, viewCount, enrichedAt }, substack?: { url, enrichedAt }, ... }
   * Null means not yet checked; empty object means checked but no presence found.
   */
  platformEnrichmentStatus: text("platformEnrichmentStatus"),
  /**
   * JSON array of all named websites for this author (supersedes individual websiteUrl/businessWebsiteUrl/speakingUrl/blogUrl/podcastUrl/newsletterUrl).
   * Shape: [{label: string, url: string, type: 'personal'|'company'|'speaking'|'podcast'|'course'|'blog'|'newsletter'|'ted'|'masterclass'|'other'}]
   */
  websitesJson: text("websitesJson"),
  /**
   * JSON array of professional/career entries (resume-style).
   * Shape: [{title: string, org: string, period: string, description: string, url?: string}]
   */
  professionalEntriesJson: text("professionalEntriesJson"),
  /**
   * JSON object with enriched full bio (double-pass LLM).
   * Shape: {fullBio: string, professionalSummary: string, personalNote?: string, enrichedAt: string, model: string}
   */
  richBioJson: text("richBioJson"),
  /** Confidence level for research quality: high | medium | low */
  researchQuality: mysqlEnum("researchQuality", ["high", "medium", "low"]),
  enrichedAt: timestamp("enrichedAt"),
  /** Google Drive folder ID for this author's folder in 02 — Knowledge Library / 01 — Authors */
  driveFolderId: varchar("driveFolderId", { length: 128 }),
  /**
   * JSON object with structured media presence data across platforms.
   * Shape: {
   *   youtube?: { channelId, channelUrl, subscriberCount, videoCount, totalViews, fetchedAt },
   *   ted?: { profileUrl, talkCount, totalViews, latestTalkUrl, latestTalkTitle, fetchedAt },
   *   substack?: { url, subscriberEstimate, postCount, fetchedAt },
   *   podcast?: { showUrl, episodeCount, platform, fetchedAt },
   *   masterclass?: { courseUrl, courseTitle, fetchedAt },
   *   enrichedAt: string,
   * }
   */
  mediaPresenceJson: text("mediaPresenceJson"),
  /** When mediaPresenceJson was last enriched */
  mediaPresenceEnrichedAt: timestamp("mediaPresenceEnrichedAt"),
  /**
   * JSON object with business and professional profile data.
   * Shape: {
   *   company?: { name, role, url, description },
   *   speakingTopics?: string[],
   *   speakingFee?: { range, currency },
   *   awards?: [{ name, year, org }],
   *   education?: [{ degree, institution, year }],
   *   boardMemberships?: [{ org, role, url }],
   *   enrichedAt: string,
   * }
   */
  businessProfileJson: text("businessProfileJson"),
  /** When businessProfileJson was last enriched */
  businessProfileEnrichedAt: timestamp("businessProfileEnrichedAt"),
  /**
   * Academic research profile from OpenAlex / Semantic Scholar.
   * JSON string of AcademicEnrichmentResult: authorProfile (hIndex, citations, affiliations),
   * topPapers (most-cited works), bookRelatedPapers (research behind books).
   */
  academicResearchJson: text("academicResearchJson"),
  /** When academicResearchJson was last enriched */
  academicResearchEnrichedAt: timestamp("academicResearchEnrichedAt"),
  /**
   * Similarweb traffic data for the author's primary website.
   * JSON string of SimilarwebTrafficResult: monthlyVisits, globalRank, trafficSources, etc.
   */
  webTrafficJson: text("webTrafficJson"),
  /** When webTrafficJson was last enriched */
  webTrafficEnrichedAt: timestamp("webTrafficEnrichedAt"),
  /**
   * JSON string of EnterpriseImpactResult: filingMentions, earningsCallMentions,
   * advisoryRoles, impactScore, uniqueCompanies.
   * Source: SEC EDGAR + Quartr API.
   */
  earningsCallMentionsJson: text("earningsCallMentionsJson"),
  /** When earningsCallMentionsJson was last enriched */
  earningsCallMentionsEnrichedAt: timestamp("earningsCallMentionsEnrichedAt"),
  /**
   * JSON string of ProfessionalProfileResult: roles, boardSeats, education,
   * awards, companyAffiliations.
   * Source: Wikipedia/Wikidata + Apollo.io.
   */
  professionalProfileJson: text("professionalProfileJson"),
  /** When professionalProfileJson was last enriched */
  professionalProfileEnrichedAt: timestamp("professionalProfileEnrichedAt"),
  /**
   * JSON string of DocumentArchive: documents list with Drive file metadata.
   * Source: Google Drive.
   */
  documentArchiveJson: text("documentArchiveJson"),
  /** When documentArchiveJson was last indexed */
  documentArchiveEnrichedAt: timestamp("documentArchiveEnrichedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  /** Index for fast lookups by author name (used in enrichment waterfall) */
  authorNameIdx: index("author_profiles_authorName_idx").on(table.authorName),
  /** Index for finding un-enriched rows quickly */
  enrichedAtIdx: index("author_profiles_enrichedAt_idx").on(table.enrichedAt),
  /** Index for batch queries filtering by avatar source (e.g. upgrading Drive-sourced avatars) */
  avatarSourceIdx: index("author_profiles_avatarSource_idx").on(table.avatarSource),
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
  /** Average rating out of 5, e.g. 4.6 — stored as DECIMAL(3,1) for proper numeric sorting */
  rating: decimal("rating", { precision: 3, scale: 1 }),
  /** Number of ratings/reviews as an integer, e.g. 120000 */
  ratingCount: int("ratingCount"),
  /** Amazon product page URL */
  amazonUrl: varchar("amazonUrl", { length: 512 }),
  /** Goodreads book page URL */
  goodreadsUrl: varchar("goodreadsUrl", { length: 512 }),
  /** Wikipedia article URL for this book */
  wikipediaUrl: varchar("wikipediaUrl", { length: 512 }),
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
  /** Publisher's official page for this book */
  publisherUrl: varchar("publisherUrl", { length: 512 }),
  /** When the summary was last enriched by an LLM */
  lastSummaryEnrichedAt: timestamp("lastSummaryEnrichedAt"),
  /** Which LLM/tool generated the summary ('gemini', 'claude', 'openai', 'manual') */
  summaryEnrichmentSource: varchar("summaryEnrichmentSource", { length: 50 }),
  /** Where the cover image came from ('amazon', 'google_books', 'manual') */
  coverImageSource: varchar("coverImageSource", { length: 50 }),
  /**
   * JSON array of all resource links for this book.
   * Shape: [{label: string, url: string, type: 'amazon'|'goodreads'|'wikipedia'|'youtube'|'podcast'|'summary'|'publisher'|'author_site'|'other'}]
   */
  resourceLinksJson: text("resourceLinksJson"),
  /**
   * JSON object with enriched full book summary (double-pass LLM).
   * Shape: {fullSummary: string, keyInsights: string[], quotes: string[], similarBooks: [{title, author, reason}], enrichedAt: string, model: string}
   */
  richSummaryJson: text("richSummaryJson"),
  /**
   * JSON string of TechnicalReferencesResult: code references, GitHub repos,
   * documentation links for technical books.
   * Source: GitHub API + Context7.
   */
  technicalReferencesJson: text("technicalReferencesJson"),
  /** When technicalReferencesJson was last enriched */
  technicalReferencesEnrichedAt: timestamp("technicalReferencesEnrichedAt"),
  /**
   * JSON string of ReadingNote from Notion sync: notes, highlights, status.
   * Source: Notion MCP.
   */
  readingNotesJson: text("readingNotesJson"),
  /** When readingNotesJson was last synced from Notion */
  readingNotesSyncedAt: timestamp("readingNotesSyncedAt"),
  enrichedAt: timestamp("enrichedAt"),
  /** Google Drive folder ID for this book's folder in 02 — Knowledge Library / 02 — Books by Category */
  driveFolderId: varchar("driveFolderId", { length: 128 }),
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
  /** Enrichment type for enrichment jobs: 'youtube' | 'ted' | 'substack' | 'bios' | 'covers' | etc. */
  enrichmentType: varchar("enrichmentType", { length: 64 }),
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

// Favorites — tracks user-favorited authors and books for priority refresh scheduling
export const favorites = mysqlTable("favorites", {
  id: int("id").autoincrement().primaryKey(),
  /** Owner's Manus openId — favorites are per-user */
  userId: varchar("userId", { length: 64 }).notNull(),
  /** 'author' | 'book' */
  entityType: mysqlEnum("entityType", ["author", "book"]).notNull(),
  /** The author name (for authors) or book title (for books) — matches the key used in enrichment */
  entityKey: varchar("entityKey", { length: 512 }).notNull(),
  /** Optional display name for the entity */
  displayName: varchar("displayName", { length: 512 }),
  /** Optional cover/avatar URL for display in Favorites panel */
  imageUrl: varchar("imageUrl", { length: 1024 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  /** Composite unique: one favorite per user per entity */
  userEntityIdx: index("favorites_userId_entityType_entityKey_idx").on(table.userId, table.entityType, table.entityKey),
  /** Index for listing all favorites for a user */
  userIdx: index("favorites_userId_idx").on(table.userId),
}));

export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = typeof favorites.$inferInsert;

/**
 * Enrichment schedules — defines recurring enrichment pipelines.
 * Each row represents a pipeline that can be scheduled to run at intervals.
 */
export const enrichmentSchedules = mysqlTable("enrichment_schedules", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique key for this pipeline, e.g. 'enrich-bios', 'scrape-covers', 'social-stats' */
  pipelineKey: varchar("pipelineKey", { length: 128 }).notNull().unique(),
  /** Human-readable label, e.g. 'Enrich Author Bios' */
  label: varchar("label", { length: 256 }).notNull(),
  /** Entity type this pipeline targets: 'author' | 'book' | 'both' */
  entityType: mysqlEnum("entityType", ["author", "book", "both"]).notNull(),
  /** Whether this schedule is currently active */
  enabled: int("enabled").notNull().default(0),
  /** Interval in hours between runs (e.g. 168 = weekly, 720 = monthly) */
  intervalHours: int("intervalHours").notNull().default(168),
  /** Maximum items to process per run (0 = unlimited) */
  batchSize: int("batchSize").notNull().default(10),
  /** Concurrency level for parallel processing */
  concurrency: int("concurrency").notNull().default(2),
  /** When this pipeline was last executed */
  lastRunAt: timestamp("lastRunAt"),
  /** When the next run is scheduled */
  nextRunAt: timestamp("nextRunAt"),
  /** Result of the last run: 'success' | 'partial' | 'failed' */
  lastRunStatus: mysqlEnum("lastRunStatus", ["success", "partial", "failed"]),
  /** Number of items processed in the last run */
  lastRunItemCount: int("lastRunItemCount"),
  /** Duration of the last run in milliseconds */
  lastRunDurationMs: int("lastRunDurationMs"),
  /** Error message from the last run (if any) */
  lastRunError: text("lastRunError"),
  /** Priority: higher = runs first when multiple pipelines are due (1-10) */
  priority: int("priority").notNull().default(5),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EnrichmentSchedule = typeof enrichmentSchedules.$inferSelect;
export type InsertEnrichmentSchedule = typeof enrichmentSchedules.$inferInsert;

/**
 * Enrichment jobs — individual job executions spawned by schedules or manual triggers.
 * Each row represents one run of a pipeline with progress tracking.
 */
export const enrichmentJobs = mysqlTable("enrichment_jobs", {
  id: int("id").autoincrement().primaryKey(),
  /** Foreign key to enrichment_schedules.pipelineKey (or 'manual' for ad-hoc runs) */
  pipelineKey: varchar("pipelineKey", { length: 128 }).notNull(),
  /** Job status lifecycle: queued → running → completed/failed/cancelled */
  status: mysqlEnum("status", ["queued", "running", "completed", "failed", "cancelled"]).notNull().default("queued"),
  /** Who triggered this job: 'schedule' | 'manual' | 'api' */
  triggeredBy: mysqlEnum("triggeredBy", ["schedule", "manual", "api"]).notNull().default("manual"),
  /** Total items to process in this job */
  totalItems: int("totalItems").notNull().default(0),
  /** Items processed so far */
  processedItems: int("processedItems").notNull().default(0),
  /** Items that succeeded */
  succeededItems: int("succeededItems").notNull().default(0),
  /** Items that failed */
  failedItems: int("failedItems").notNull().default(0),
  /** Items that were skipped (already fresh) */
  skippedItems: int("skippedItems").notNull().default(0),
  /** Progress percentage 0-100 */
  progress: int("progress").notNull().default(0),
  /** Human-readable status message */
  message: text("message"),
  /** Error details if failed */
  error: text("error"),
  /** JSON array of individual item results: [{entity, status, error?, durationMs}] */
  itemResultsJson: text("itemResultsJson"),
  /** When the job started executing */
  startedAt: timestamp("startedAt"),
  /** When the job finished (completed, failed, or cancelled) */
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  /** Index for listing jobs by pipeline */
  pipelineIdx: index("enrichment_jobs_pipelineKey_idx").on(table.pipelineKey),
  /** Index for finding running/queued jobs */
  statusIdx: index("enrichment_jobs_status_idx").on(table.status),
}));

export type EnrichmentJob = typeof enrichmentJobs.$inferSelect;
export type InsertEnrichmentJob = typeof enrichmentJobs.$inferInsert;
