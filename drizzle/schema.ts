import { boolean, decimal, index, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
   * JSON array of tag slugs applied to this author, e.g. ["must-read", "leadership", "favorite"].
   * Tags are defined in the `tags` table; this column is a denormalized cache for fast filtering.
   */
  tagsJson: text("tagsJson"),
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

  // ── Contextual Intelligence (geography, history, family, associations) ──────
  /**
   * JSON object with full geographical biography.
   * Shape: {
   *   birthCity, birthCountry, childhoodCity, formativeCities: string[],
   *   currentBase, countriesLived: string[], culturalRegions: string[],
   *   geographyNarrative: string  // LLM synthesis of how geography shaped worldview
   * }
   */
  geographyJson: text("geographyJson"),
  /**
   * JSON object with historical/era context.
   * Shape: {
   *   birthDecade: string, formativeYears: { from: number, to: number },
   *   majorWorldEvents: [{ year: number, event: string, relevance: string }],
   *   culturalEra: string, eraNarrative: string
   * }
   */
  historicalContextJson: text("historicalContextJson"),
  /**
   * JSON object with family and upbringing data.
   * Shape: {
   *   parents: [{ name, profession, nationality, notes }],
   *   siblings: { count: number, birthOrder: string, notes: string },
   *   spouse: { name, profession, duration, notes },
   *   children: { count: number, notes: string },
   *   familyCulture: { religion, politicalLeanings, socioeconomicClass, immigrationBackground, notes }
   * }
   */
  familyJson: text("familyJson"),
  /**
   * JSON object with associations, networks, and intellectual lineage.
   * Shape: {
   *   mentors: [{ name, relationship, contribution }],
   *   proteges: [{ name, notes }],
   *   collaborators: [{ name, type: 'co-author'|'co-presenter'|'business', notes }],
   *   intellectualRivals: [{ name, disagreement }],
   *   organizations: [{ name, role, type: 'think-tank'|'board'|'conference'|'association', url }],
   *   universities: [{ name, degree, year, role: 'student'|'faculty'|'honorary' }],
   *   schoolsOfThought: string[],
   *   citedInfluences: [{ name, type: 'author'|'thinker'|'book', notes }],
   *   intellectualDescendants: [{ name, notes }],
   *   signatureFrameworks: [{ name, description, year }]
   * }
   */
  associationsJson: text("associationsJson"),
  /**
   * JSON object with formative experiences (pivotal moments).
   * Shape: [{ type: 'trauma'|'epiphany'|'career'|'travel'|'loss'|'other', description: string, approximateYear?: number, source: string }]
   */
  formativeExperiencesJson: text("formativeExperiencesJson"),
  /** Raw source responses from the 8-source biographical research waterfall — stored for auditability */
  authorBioSourcesJson: text("authorBioSourcesJson"),
  /** Completeness score 0–100 based on populated biographical fields */
  bioCompleteness: int("bioCompleteness").default(0),
  /** When the contextual intelligence layer was last enriched */
  contextualIntelligenceEnrichedAt: timestamp("contextualIntelligenceEnrichedAt"),

  // ── News Cache ──────────────────────────────────────────────────────────────
  /**
   * Cached news articles for this author from Google News RSS.
   * Shape: [{ title, url, source, publishedAt, snippet }]
   */
  newsCacheJson: text("newsCacheJson"),
  /** When newsCacheJson was last fetched */
  newsCachedAt: timestamp("newsCachedAt"),
  /**
   * Cached CNBC mentions for this author.
   * Shape: [{ title, url, source, publishedAt, snippet }]
   */
  cnbcMentionsCacheJson: text("cnbcMentionsCacheJson"),
  /** When cnbcMentionsCacheJson was last fetched */
  cnbcMentionsCachedAt: timestamp("cnbcMentionsCachedAt"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  /** Index for fast lookups by author name (used in enrichment waterfall) */
  authorNameIdx: index("author_profiles_authorName_idx").on(table.authorName),
  /** Index for finding un-enriched rows quickly */
  enrichedAtIdx: index("author_profiles_enrichedAt_idx").on(table.enrichedAt),
  /** Index for batch queries filtering by avatar source (e.g. upgrading Drive-sourced avatars) */
  avatarSourceIdx: index("author_profiles_avatarSource_idx").on(table.avatarSource),
  /** T1-B: Index for sorting/filtering by bio completeness score (chatbot readiness pipeline) */
  bioCompletenessIdx: index("author_profiles_bioCompleteness_idx").on(table.bioCompleteness),
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
  /**
   * Reading progress as a percentage (0–100).
   * Updated manually by the user via the BookDetail page progress slider.
   */
  readingProgressPercent: int("readingProgressPercent"),
  /** Date the user started reading this book (UTC) */
  readingStartedAt: timestamp("readingStartedAt"),
  /** Date the user finished reading this book (UTC) */
  readingFinishedAt: timestamp("readingFinishedAt"),
  /**
   * Personal reading notes JSON.
   * Shape: { notes: string, updatedAt: string }
   */
  personalNotesJson: text("personalNotesJson"),
  enrichedAt: timestamp("enrichedAt"),
  /**
   * Physical/digital format(s) the user owns.
   * - physical: print copy only
   * - digital: ebook/PDF only
   * - audio: audiobook only
   * - physical_digital: print + ebook
   * - physical_audio: print + audiobook
   * - digital_audio: ebook + audiobook
   * - all: all three formats
   * - none: no copy owned (reference/wishlist entry)
   */
  format: mysqlEnum("format", ["physical", "digital", "audio", "physical_digital", "physical_audio", "digital_audio", "all", "none"]),
  /**
   * Possession/reading status for this book.
   * - owned: user owns a copy
   * - wishlist: user wants to acquire it
   * - reference: tracking for research/reference, no ownership intended
   * - borrowed: borrowed from library/friend
   * - gifted: gifted to someone else
   * - read: finished reading
   * - reading: currently reading
   * - unread: owned but not yet read
   */
  possessionStatus: mysqlEnum("possessionStatus", ["owned", "wishlist", "reference", "borrowed", "gifted", "read", "reading", "unread"]),
  /** Google Drive folder ID for this book's folder in 02 — Knowledge Library / 02 — Books by Category */
  driveFolderId: varchar("driveFolderId", { length: 128 }),
  /**
   * JSON array of tag slugs applied to this book, e.g. ["must-read", "leadership", "favorite"].
   * Tags are defined in the `tags` table; this column is a denormalized cache for fast filtering.
   */
  tagsJson: text("tagsJson"),

  // ── Library Availability Cache ──────────────────────────────────────────────
  /**
   * Cached Open Library enrichment data.
   * Shape: { olid, title, subjects, firstPublishYear, description, covers, links, cachedAt }
   */
  openLibraryCacheJson: text("openLibraryCacheJson"),
  /** When openLibraryCacheJson was last fetched */
  openLibraryCachedAt: timestamp("openLibraryCachedAt"),
  /**
   * Cached HathiTrust availability data.
   * Shape: { totalItems, fullTextCount, fullTextUrl, rightsCode, cachedAt }
   */
  hathiTrustCacheJson: text("hathiTrustCacheJson"),
  /** When hathiTrustCachedAt was last fetched */
  hathiTrustCachedAt: timestamp("hathiTrustCachedAt"),
  /**
   * Cached WorldCat library availability data.
   * Shape: { totalHoldings, oclcNumber, libraries: [{name, location}], cachedAt }
   */
  worldcatCacheJson: text("worldcatCacheJson"),
  /** When worldcatCacheJson was last fetched */
  worldcatCachedAt: timestamp("worldcatCachedAt"),

  // ── Duplicate Detection ────────────────────────────────────────────────────
  /** ID of the canonical book this is a duplicate of (null = not a duplicate) */
  duplicateOfId: int("duplicateOfId"),
  /** How the duplicate was detected: isbn | fuzzy_title */
  duplicateDetectionMethod: varchar("duplicateDetectionMethod", { length: 32 }),
  /** Review status: pending | keep | discard | replace */
  duplicateStatus: varchar("duplicateStatus", { length: 16 }),
  /** When the duplicate flag was set */
  duplicateFlaggedAt: timestamp("duplicateFlaggedAt"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  /** Index for fast lookups by author name (used in book enrichment joins) */
  authorNameIdx: index("book_profiles_authorName_idx").on(table.authorName),
  /** Index for finding un-enriched books quickly */
  enrichedAtIdx: index("book_profiles_enrichedAt_idx").on(table.enrichedAt),
  /** T1-B: Index for ISBN-based duplicate detection and library cache lookups */
  isbnIdx: index("book_profiles_isbn_idx").on(table.isbn),
  /** T1-B: Index for filtering books by possession status (owned, wishlist, etc.) */
  possessionStatusIdx: index("book_profiles_possessionStatus_idx").on(table.possessionStatus),
  /** T1-B: Index for filtering books by format (PDF, Audio, Physical, etc.) */
  formatIdx: index("book_profiles_format_idx").on(table.format),
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


// ─────────────────────────────────────────────────────────────────────────────
// DIGITAL AUTHOR RAG PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * author_rag_profiles — tracks the Digital Me RAG file for each author.
 * The RAG file is a structured Markdown document stored in S3 that encapsulates
 * everything the system knows about an author in a form suitable for LLM system
 * prompt injection (author impersonation chatbot).
 */
export const authorRagProfiles = mysqlTable("author_rag_profiles", {
  id: int("id").autoincrement().primaryKey(),
  /** Foreign key → author_profiles.authorName */
  authorName: varchar("authorName", { length: 256 }).notNull().unique(),
  /** S3 URL of the RAG Markdown file */
  ragFileUrl: varchar("ragFileUrl", { length: 1024 }),
  /** S3 key for the RAG file (used for versioning and cleanup) */
  ragFileKey: varchar("ragFileKey", { length: 512 }),
  /** Monotonically increasing version number (starts at 1) */
  ragVersion: int("ragVersion").notNull().default(1),
  /** When this version of the RAG file was generated */
  ragGeneratedAt: timestamp("ragGeneratedAt"),
  /** Word count of the RAG file */
  ragWordCount: int("ragWordCount"),
  /** LLM model used for the final synthesis call */
  ragModel: varchar("ragModel", { length: 128 }),
  /** LLM vendor used for the final synthesis call */
  ragVendor: varchar("ragVendor", { length: 64 }),
  /** Number of content items included in this RAG generation */
  contentItemCount: int("contentItemCount").notNull().default(0),
  /** Bio completeness score at the time of RAG generation (0–100) */
  bioCompletenessAtGeneration: int("bioCompletenessAtGeneration"),
  /** Pipeline status */
  ragStatus: mysqlEnum("ragStatus", ["pending", "generating", "ready", "stale"]).notNull().default("pending"),
  /** Error message if the last generation failed */
  ragError: text("ragError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  authorNameIdx: index("author_rag_profiles_authorName_idx").on(table.authorName),
  ragStatusIdx: index("author_rag_profiles_ragStatus_idx").on(table.ragStatus),
}));

export type AuthorRagProfile = typeof authorRagProfiles.$inferSelect;
export type InsertAuthorRagProfile = typeof authorRagProfiles.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// UNIVERSAL CONTENT MODEL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * content_items — universal content model for all content types.
 * Replaces the book-only model; books are migrated here as contentType='book'.
 * Every intellectual or creative output by any author is a row in this table.
 */
export const contentItems = mysqlTable("content_items", {
  id: int("id").autoincrement().primaryKey(),
  /** Content type discriminator */
  contentType: mysqlEnum("contentType", [
    "book", "paper", "article", "substack", "newsletter",
    "podcast", "podcast_episode", "youtube_video", "youtube_channel",
    "ted_talk", "masterclass", "online_course", "tv_show", "tv_episode",
    "film", "radio", "photography", "social_post", "speech", "interview",
    "blog_post", "website", "tool", "other"
  ]).notNull(),
  /** Display title */
  title: varchar("title", { length: 512 }).notNull(),
  /** Optional subtitle or episode title */
  subtitle: varchar("subtitle", { length: 512 }),
  /** 2–3 sentence summary */
  description: text("description"),
  /**
   * Full LLM-enriched description.
   * Shape: { fullSummary, keyInsights: string[], notableQuotes: string[], themes: string[], enrichedAt, model }
   */
  richDescriptionJson: text("richDescriptionJson"),
  /** Primary URL (Amazon page, podcast feed, YouTube link, etc.) */
  url: varchar("url", { length: 1024 }),
  /** Thumbnail or cover image URL */
  coverImageUrl: varchar("coverImageUrl", { length: 1024 }),
  /** S3-mirrored cover URL */
  s3CoverUrl: varchar("s3CoverUrl", { length: 1024 }),
  /** S3 key for the mirrored cover */
  s3CoverKey: varchar("s3CoverKey", { length: 512 }),
  /** Publication / release date */
  publishedDate: varchar("publishedDate", { length: 64 }),
  /** JSON string array of tags */
  tagsJson: text("tagsJson"),
  /** Average rating (0.0–5.0) */
  rating: decimal("rating", { precision: 3, scale: 1 }),
  /** Number of ratings */
  ratingCount: int("ratingCount"),
  /** ISO 639-1 language code */
  language: varchar("language", { length: 8 }),
  /**
   * Type-specific metadata stored as JSON.
   * book: { isbn, publisher, amazonUrl, goodreadsUrl, keyThemes }
   * paper: { doi, journal, institution, pdfUrl, citationCount }
   * podcast: { feedUrl, spotifyUrl, appleUrl, episodeCount }
   * youtube_video: { channelId, videoId, viewCount, likeCount }
   * etc.
   */
  metadataJson: text("metadataJson"),
  /** Whether this item is included in the library (shown in UI, synced to Dropbox) */
  includedInLibrary: int("includedInLibrary").notNull().default(1),
  /** Google Drive folder ID (if backed by Drive) */
  driveFolderId: varchar("driveFolderId", { length: 128 }),
  /** Personal reading/consumption notes from Notion */
  readingNotesJson: text("readingNotesJson"),
  /** When the record was last enriched */
  enrichedAt: timestamp("enrichedAt"),
  // ── AI Quality Scoring columns (populated by contentIntelligence.service) ──
  /** Composite quality score 0-100 */
  qualityScore: int("qualityScore"),
  /** Relevance score 0-100 */
  relevanceScore: int("relevanceScore"),
  /** Authority score 0-100 */
  authorityScore: int("authorityScore"),
  /** Freshness score 0-100 */
  freshnessScore: int("freshnessScore"),
  /** Depth score 0-100 */
  depthScore: int("depthScore"),
  /** 1 = URL is alive, 0 = dead link */
  isAlive: int("isAlive"),
  /** AI-detected content type (may differ from contentType enum) */
  contentTypeDetected: varchar("contentTypeDetected", { length: 64 }),
  /** When quality scoring was last run */
  qualityScoredAt: timestamp("qualityScoredAt"),
  /** AI-extracted title */
  aiExtractedTitle: varchar("aiExtractedTitle", { length: 512 }),
  /** AI-extracted summary */
  aiExtractedSummary: text("aiExtractedSummary"),
  /** JSON array of key topics */
  aiKeyTopics: text("aiKeyTopics"),
  /** LLM scoring rationale */
  aiScoringRationale: text("aiScoringRationale"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  contentTypeIdx: index("content_items_contentType_idx").on(table.contentType),
  titleIdx: index("content_items_title_idx").on(table.title),
  includedIdx: index("content_items_included_idx").on(table.includedInLibrary),
  qualityScoreIdx: index("content_items_qualityScore_idx").on(table.qualityScore),
  isAliveIdx: index("content_items_isAlive_idx").on(table.isAlive),
}));

export type ContentItem = typeof contentItems.$inferSelect;
export type InsertContentItem = typeof contentItems.$inferInsert;

/**
 * author_content_links — M:M join table between authors and content items.
 * An author can have multiple content items; a content item can have multiple authors.
 */
export const authorContentLinks = mysqlTable("author_content_links", {
  id: int("id").autoincrement().primaryKey(),
  /** Foreign key → author_profiles.authorName */
  authorName: varchar("authorName", { length: 256 }).notNull(),
  /** Foreign key → content_items.id */
  contentItemId: int("contentItemId").notNull(),
  /** Author's role on this content item */
  role: mysqlEnum("role", ["primary", "co-author", "editor", "contributor", "foreword", "narrator"]).notNull().default("primary"),
  /** Display order when listing authors for a content item */
  displayOrder: int("displayOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  authorIdx: index("author_content_links_authorName_idx").on(table.authorName),
  contentIdx: index("author_content_links_contentItemId_idx").on(table.contentItemId),
  uniqueLink: index("author_content_links_unique_idx").on(table.authorName, table.contentItemId),
}));

export type AuthorContentLink = typeof authorContentLinks.$inferSelect;
export type InsertAuthorContentLink = typeof authorContentLinks.$inferInsert;

/**
 * content_files — tracks S3-stored files for each content item.
 * One content item can have multiple files (e.g., PDF + MP3 audio).
 */
export const contentFiles = mysqlTable("content_files", {
  id: int("id").autoincrement().primaryKey(),
  /** Foreign key → content_items.id */
  contentItemId: int("contentItemId").notNull(),
  /** S3 object key */
  s3Key: varchar("s3Key", { length: 512 }).notNull().unique(),
  /** CloudFront CDN URL */
  s3Url: varchar("s3Url", { length: 1024 }).notNull(),
  /** Original filename before slug normalization */
  originalFilename: varchar("originalFilename", { length: 512 }),
  /** Clean slug filename used in Dropbox/Drive mirror */
  cleanFilename: varchar("cleanFilename", { length: 512 }),
  /** MIME type */
  mimeType: varchar("mimeType", { length: 128 }),
  /** File size in bytes */
  fileSizeBytes: int("fileSizeBytes"),
  /** MD5 checksum for deduplication */
  md5Checksum: varchar("md5Checksum", { length: 32 }),
  /** File type category */
  fileType: mysqlEnum("fileType", ["pdf", "mp3", "mp4", "epub", "doc", "transcript", "image", "json", "other"]).notNull().default("pdf"),
  /** Dropbox path where this file was last mirrored */
  dropboxPath: varchar("dropboxPath", { length: 1024 }),
  /** When this file was last mirrored to Dropbox */
  dropboxSyncedAt: timestamp("dropboxSyncedAt"),
  /** Google Drive file ID where this file was last mirrored */
  driveFileId: varchar("driveFileId", { length: 128 }),
  /** When this file was last mirrored to Google Drive */
  driveSyncedAt: timestamp("driveSyncedAt"),
  // ── Duplicate Detection ────────────────────────────────────────────────────
  /** SHA-256 hash of the file content (for exact duplicate detection) */
  contentHash: varchar("contentHash", { length: 64 }),
  /** ID of the canonical file this is a duplicate of (null = not a duplicate) */
  duplicateOfId: int("duplicateOfId"),
  /** How the duplicate was detected: hash | filename */
  duplicateDetectionMethod: varchar("duplicateDetectionMethod", { length: 32 }),
  /** Review status: pending | keep | discard | replace */
  duplicateStatus: varchar("duplicateStatus", { length: 16 }),
  /** When the duplicate flag was set */
  duplicateFlaggedAt: timestamp("duplicateFlaggedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  contentItemIdx: index("content_files_contentItemId_idx").on(table.contentItemId),
  fileTypeIdx: index("content_files_fileType_idx").on(table.fileType),
}));

export type ContentFile = typeof contentFiles.$inferSelect;
export type InsertContentFile = typeof contentFiles.$inferInsert;

/**
 * ingest_sources — tracks where each content item originated.
 * Enables traceability from S3 file back to its original source.
 */
export const ingestSources = mysqlTable("ingest_sources", {
  id: int("id").autoincrement().primaryKey(),
  /** Foreign key → content_items.id */
  contentItemId: int("contentItemId").notNull(),
  /** Source type */
  sourceType: mysqlEnum("sourceType", [
    "dropbox", "google_drive", "manual_upload", "scrape",
    "api", "dropbox_mirror", "drive_mirror"
  ]).notNull(),
  /** Source path or URL (e.g., Dropbox path, Drive folder ID, scrape URL) */
  sourcePath: varchar("sourcePath", { length: 1024 }),
  /** When this source was last synced */
  lastSyncedAt: timestamp("lastSyncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  contentItemIdx: index("ingest_sources_contentItemId_idx").on(table.contentItemId),
}));

export type IngestSource = typeof ingestSources.$inferSelect;
export type InsertIngestSource = typeof ingestSources.$inferInsert;

/**
 * author_subscriptions — periodic refresh subscriptions per author per platform.
 * Enables the system to monitor for new content (new YouTube videos, Substack posts, etc.)
 */
export const authorSubscriptions = mysqlTable("author_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  /** Foreign key → author_profiles.authorName */
  authorName: varchar("authorName", { length: 256 }).notNull(),
  /** Platform being monitored */
  platform: mysqlEnum("platform", [
    "youtube", "substack", "podcast", "medium", "newsletter",
    "google_books", "amazon", "twitter", "linkedin"
  ]).notNull(),
  /** Platform-specific identifier (channel ID, feed URL, etc.) */
  platformId: varchar("platformId", { length: 512 }),
  /** Feed URL for polling */
  feedUrl: varchar("feedUrl", { length: 1024 }),
  /** Whether this subscription is active */
  enabled: int("enabled").notNull().default(1),
  /** Polling interval in hours */
  intervalHours: int("intervalHours").notNull().default(24),
  /** When this subscription was last polled */
  lastPolledAt: timestamp("lastPolledAt"),
  /** When new content was last found */
  lastNewContentAt: timestamp("lastNewContentAt"),
  /** Number of new items found in the last poll */
  lastPollNewCount: int("lastPollNewCount").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  authorPlatformIdx: index("author_subscriptions_author_platform_idx").on(table.authorName, table.platform),
}));

export type AuthorSubscription = typeof authorSubscriptions.$inferSelect;
export type InsertAuthorSubscription = typeof authorSubscriptions.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// S3-TO-DROPBOX/DRIVE SYNC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * sync_jobs — tracks each S3-to-Dropbox/Drive sync run.
 */
export const syncJobs = mysqlTable("sync_jobs", {
  id: int("id").autoincrement().primaryKey(),
  /** Target platform */
  target: mysqlEnum("target", ["dropbox", "google_drive", "both"]).notNull(),
  /** Job status */
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "cancelled"]).notNull().default("pending"),
  /** How the job was triggered */
  triggeredBy: mysqlEnum("triggeredBy", ["manual", "schedule", "api"]).notNull().default("manual"),
  /** Scope: 'all' or comma-separated author names */
  scope: varchar("scope", { length: 1024 }).notNull().default("all"),
  /** Total files to sync */
  totalFiles: int("totalFiles").notNull().default(0),
  /** Files successfully synced */
  syncedFiles: int("syncedFiles").notNull().default(0),
  /** Files skipped (already current) */
  skippedFiles: int("skippedFiles").notNull().default(0),
  /** Files that failed */
  failedFiles: int("failedFiles").notNull().default(0),
  /** Total bytes transferred */
  bytesTransferred: int("bytesTransferred").notNull().default(0),
  /** Human-readable status message */
  message: text("message"),
  /** Error details */
  error: text("error"),
  /** JSON array of per-file results: [{s3Key, targetPath, status, error?, bytes}] */
  fileResultsJson: text("fileResultsJson"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  statusIdx: index("sync_jobs_status_idx").on(table.status),
  targetIdx: index("sync_jobs_target_idx").on(table.target),
}));

export type SyncJob = typeof syncJobs.$inferSelect;
export type InsertSyncJob = typeof syncJobs.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// USER INTEREST GRAPH & RAG CONTRAST ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * user_interests — the user's personal interest/topic graph.
 * Each row is a subject, theme, or topic the user is currently focused on.
 * These are cross-referenced against author RAG files to produce alignment scores.
 */
export const userInterests = mysqlTable("user_interests", {
  id: int("id").autoincrement().primaryKey(),
  /** Owner's Manus openId */
  userId: varchar("userId", { length: 64 }).notNull(),
  /** The interest topic name, e.g. "Behavioral Change", "Leadership", "Neuroscience" */
  topic: varchar("topic", { length: 256 }).notNull(),
  /** Optional longer description of what this interest means to the user */
  description: text("description"),
  /** Grouping cluster, e.g. "Leadership", "Science", "Business Strategy" */
  category: varchar("category", { length: 128 }),
  /** Priority weight: low | medium | high | critical */
  weight: mysqlEnum("weight", ["low", "medium", "high", "critical"]).notNull().default("medium"),
  /** Hex color for UI display, e.g. "#3B82F6" */
  color: varchar("color", { length: 7 }).default("#6366F1"),
  /** Display order within category (for drag-to-reorder) */
  displayOrder: int("displayOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("user_interests_userId_idx").on(table.userId),
  userCategoryIdx: index("user_interests_userId_category_idx").on(table.userId, table.category),
}));

export type UserInterest = typeof userInterests.$inferSelect;
export type InsertUserInterest = typeof userInterests.$inferInsert;

/**
 * author_interest_scores — alignment scores between authors and user interests.
 * Computed by the RAG Contrast Engine: LLM scores each author's RAG file
 * against each user interest on a 0–10 scale with a one-sentence rationale.
 */
export const authorInterestScores = mysqlTable("author_interest_scores", {
  id: int("id").autoincrement().primaryKey(),
  /** Foreign key → author_profiles.authorName */
  authorName: varchar("authorName", { length: 256 }).notNull(),
  /** Foreign key → user_interests.id */
  interestId: int("interestId").notNull(),
  /** Owner's Manus openId (denormalized for fast per-user queries) */
  userId: varchar("userId", { length: 64 }).notNull(),
  /** Alignment score 0–10 */
  score: int("score").notNull(),
  /** One-sentence rationale explaining the score */
  rationale: text("rationale"),
  /** LLM model used to compute the score */
  modelUsed: varchar("modelUsed", { length: 128 }),
  /** When the score was computed */
  computedAt: timestamp("computedAt").defaultNow().notNull(),
  /** RAG file version used for scoring */
  ragVersion: int("ragVersion"),
}, (table) => ({
  authorInterestIdx: index("author_interest_scores_author_interest_idx").on(table.authorName, table.interestId),
  userIdx: index("author_interest_scores_userId_idx").on(table.userId),
  scoreIdx: index("author_interest_scores_score_idx").on(table.score),
}));

export type AuthorInterestScore = typeof authorInterestScores.$inferSelect;
export type InsertAuthorInterestScore = typeof authorInterestScores.$inferInsert;

// ── Tags ─────────────────────────────────────────────────────────────────────
/**
 * tags — user-defined labels for organizing authors and books.
 * Tags are displayed as colored pills on cards and can be used for filtering.
 * The tagsJson column on author_profiles and book_profiles caches the applied slugs.
 */
export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  /** URL-safe slug, e.g. "must-read", "leadership", "ai-related" */
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  /** Display name, e.g. "Must Read", "Leadership", "AI Related" */
  name: varchar("name", { length: 128 }).notNull(),
  /** Hex color for the tag pill, e.g. "#3B82F6" */
  color: varchar("color", { length: 7 }).notNull().default("#6366F1"),
  /** How many authors + books currently have this tag (denormalized counter) */
  usageCount: int("usageCount").notNull().default(0),
  /** Optional description of what this tag means */
  description: text("description"),
  /** Display order (for drag-to-reorder in tag manager) */
  displayOrder: int("displayOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  slugIdx: index("tags_slug_idx").on(table.slug),
}));

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

// ── App Settings ─────────────────────────────────────────────────────────────
/**
 * Generic key-value store for application settings.
 * Used for: Dropbox refresh token, Google Drive folder ID, AI model preferences, etc.
 */
export const appSettings = mysqlTable("app_settings", {
  key: varchar("key", { length: 128 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;

// ── API Registry ─────────────────────────────────────────────────────────────
/**
 * api_registry — catalog of all external APIs used in the application.
 * Tracks name, source, status, and whether each API is enabled.
 * Admins can toggle APIs on/off and check their live status.
 */
export const apiRegistry = mysqlTable("api_registry", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique machine key, e.g. 'rapidapi-twitter', 'open-library' */
  apiKey: varchar("apiKey", { length: 128 }).notNull().unique(),
  /** Human-readable name, e.g. 'Twitter / X API' */
  name: varchar("name", { length: 256 }).notNull(),
  /** Short description of what this API provides */
  description: text("description"),
  /** Category grouping: 'books' | 'news' | 'social' | 'finance' | 'travel' | 'utilities' | 'ai' | 'other' */
  category: mysqlEnum("category", ["books", "news", "social", "finance", "travel", "utilities", "ai", "other"]).notNull().default("other"),
  /** Where this API was sourced from, e.g. 'RapidAPI', 'Open Library', 'iTunes', 'Internal' */
  source: varchar("source", { length: 128 }).notNull(),
  /** URL to the API listing or documentation page */
  sourceUrl: varchar("sourceUrl", { length: 512 }),
  /** RapidAPI host header value, e.g. 'twitter-api45.p.rapidapi.com' (null for non-RapidAPI) */
  rapidApiHost: varchar("rapidApiHost", { length: 256 }),
  /** A sample endpoint URL used for health checks */
  healthCheckUrl: varchar("healthCheckUrl", { length: 512 }),
  /** Whether this API is enabled for use in the app */
  enabled: int("enabled").notNull().default(1),
  /** Last known status: 'green' = working, 'yellow' = subscribed but issues, 'red' = down/not subscribed */
  statusColor: mysqlEnum("statusColor", ["green", "yellow", "red"]).notNull().default("yellow"),
  /** HTTP status code from last health check */
  lastStatusCode: int("lastStatusCode"),
  /** Human-readable result of last health check */
  lastStatusMessage: varchar("lastStatusMessage", { length: 512 }),
  /** When the last health check was run */
  lastCheckedAt: timestamp("lastCheckedAt"),
  /** Optional admin notes */
  notes: text("notes"),
  /** Display order within category */
  displayOrder: int("displayOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  categoryIdx: index("api_registry_category_idx").on(table.category),
  enabledIdx: index("api_registry_enabled_idx").on(table.enabled),
}));

export type ApiRegistry = typeof apiRegistry.$inferSelect;
export type InsertApiRegistry = typeof apiRegistry.$inferInsert;

// ── Magazine Articles ────────────────────────────────────────────────────────
// Unified cache for articles from 5 publications:
//   the-atlantic | the-new-yorker | wired | nyt | washington-post
// Articles are matched to library authors by normalised author name.
export const magazineArticles = mysqlTable("magazine_articles", {
  id: int("id").autoincrement().primaryKey(),
  /** Stable ID: "{source}-{url-slug}" */
  articleId: varchar("articleId", { length: 192 }).notNull().unique(),
  /** Publication source key */
  source: mysqlEnum("source", ["the-atlantic", "the-new-yorker", "wired", "nyt", "washington-post"]).notNull(),
  /** Human-readable publication name */
  publicationName: varchar("publicationName", { length: 128 }).notNull(),
  /** Article headline */
  title: text("title").notNull(),
  /** Canonical article URL */
  url: varchar("url", { length: 1024 }).notNull(),
  /** Author name as returned by the RSS feed */
  authorName: varchar("authorName", { length: 256 }),
  /** Normalised author name for matching against library author profiles */
  authorNameNormalized: varchar("authorNameNormalized", { length: 256 }),
  /** ISO-8601 publish date */
  publishedAt: timestamp("publishedAt"),
  /** Short teaser text from RSS (up to 600 chars) */
  summaryText: text("summaryText"),
  /** Full article body text scraped via Apify (null until scraped) */
  fullText: text("fullText"),
  /** JSON array of category/tag strings */
  categoriesJson: text("categoriesJson"),
  /** Which RSS feed URL this article came from */
  feedUrl: varchar("feedUrl", { length: 512 }),
  /** When the full text was last scraped via Apify */
  scrapedAt: timestamp("scrapedAt"),
  /** Whether full-text scraping has been attempted */
  scrapeAttempted: boolean("scrapeAttempted").notNull().default(false),
  /** Whether this article has been indexed in Neon pgvector for RAG */
  ragIndexed: boolean("ragIndexed").notNull().default(false),
  /** When this article was indexed in Neon pgvector */
  ragIndexedAt: timestamp("ragIndexedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  authorIdx: index("mag_author_idx").on(table.authorNameNormalized),
  sourceIdx: index("mag_source_idx").on(table.source),
  publishedIdx: index("mag_published_idx").on(table.publishedAt),
  articleIdIdx: index("mag_article_id_idx").on(table.articleId),
  ragIdx: index("mag_rag_idx").on(table.ragIndexed),
}));
export type MagazineArticleRow = typeof magazineArticles.$inferSelect;
export type InsertMagazineArticle = typeof magazineArticles.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// HUMAN REVIEW QUEUE
// ─────────────────────────────────────────────────────────────────────────────
/**
 * human_review_queue — items that AI has flagged for human review.
 *
 * The AI pipeline automatically populates this table when it detects:
 *   - Chatbot candidates (authors with sufficient RAG readiness)
 *   - Near-duplicate books/authors (semantic similarity > 0.92)
 *   - Low-confidence author-to-book matches
 *   - Broken or low-quality URLs
 *   - Content items needing classification
 *
 * Admins review items here and take action (approve / reject / merge / skip).
 */
export const humanReviewQueue = mysqlTable("human_review_queue", {
  id: int("id").autoincrement().primaryKey(),
  /**
   * Category of review item:
   *   chatbot_candidate   — author has enough RAG content to enable chatbot
   *   near_duplicate      — two entities are semantically similar (> 0.92)
   *   author_match        — unlinked book/content needs author assignment
   *   url_quality         — URL is broken, redirects, or low-quality
   *   content_classify    — content item needs manual type classification
   *   link_merit          — AI scored a link as low-value; human should verify
   */
  reviewType: mysqlEnum("reviewType", [
    "chatbot_candidate",
    "near_duplicate",
    "author_match",
    "url_quality",
    "content_classify",
    "link_merit",
  ]).notNull(),
  /** Current status of this review item */
  status: mysqlEnum("status", [
    "pending",
    "approved",
    "rejected",
    "merged",
    "skipped",
    "auto_resolved",
  ]).notNull().default("pending"),
  /** Primary entity name (author name, book title, content item title, URL) */
  entityName: varchar("entityName", { length: 512 }).notNull(),
  /** Entity type: 'author' | 'book' | 'content_item' | 'url' */
  entityType: mysqlEnum("entityType", ["author", "book", "content_item", "url"]).notNull(),
  /** Optional secondary entity (for near-duplicate pairs or author-match candidates) */
  secondaryEntityName: varchar("secondaryEntityName", { length: 512 }),
  /** Secondary entity type */
  secondaryEntityType: mysqlEnum("secondaryEntityType", ["author", "book", "content_item", "url"]),
  /**
   * AI confidence score for the flagged issue (0.0–1.0).
   * For near-duplicates: cosine similarity from Neon pgvector.
   * For chatbot candidates: ragReadinessScore / 100.
   * For URL quality: 0 = broken, 0.5 = redirect, 1 = healthy.
   */
  aiConfidence: decimal("aiConfidence", { precision: 4, scale: 3 }),
  /**
   * AI-generated explanation of why this item was flagged.
   * Plain English, 1–3 sentences.
   */
  aiReason: text("aiReason"),
  /**
   * AI-suggested action for the human reviewer.
   */
  aiSuggestedAction: text("aiSuggestedAction"),
  /**
   * Structured metadata specific to the review type.
   * chatbot_candidate: { ragReadinessScore, ragStatus, bioCompleteness, bookCount, contentItemCount }
   * near_duplicate: { similarityScore, namespace, primaryId, secondaryId }
   * author_match: { bookTitle, candidateAuthors: [{ name, confidence }] }
   * url_quality: { url, statusCode, redirectUrl, lastChecked }
   * link_merit: { url, aiScore, aiReason, contentType }
   */
  metadataJson: text("metadataJson"),
  /** Admin notes or comments on this review item */
  adminNotes: text("adminNotes"),
  /** When the admin took action on this item */
  reviewedAt: timestamp("reviewedAt"),
  /** Which pipeline run or trigger created this item */
  sourceJob: varchar("sourceJob", { length: 128 }),
  /** Priority: 1 = highest, 5 = lowest */
  priority: int("priority").notNull().default(3),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  reviewTypeIdx: index("hrq_reviewType_idx").on(table.reviewType),
  statusIdx: index("hrq_status_idx").on(table.status),
  entityNameIdx: index("hrq_entityName_idx").on(table.entityName),
  priorityIdx: index("hrq_priority_idx").on(table.priority),
}));
export type HumanReviewQueueItem = typeof humanReviewQueue.$inferSelect;
export type InsertHumanReviewQueueItem = typeof humanReviewQueue.$inferInsert;

// ── Dropbox Folder Configuration ─────────────────────────────────────────────
/**
 * dropbox_folder_configs — stores all Dropbox folder connections used by the app.
 * Admins can view, edit, enable/disable each folder from the admin UI.
 */
export const dropboxFolderConfigs = mysqlTable("dropbox_folder_configs", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique machine key, e.g. 'backup_root', 'books_inbox', 'authors_inbox' */
  folderKey: varchar("folderKey", { length: 64 }).notNull().unique(),
  /** Human-readable label shown in the admin UI */
  label: varchar("label", { length: 128 }).notNull(),
  /** Short description of what this folder is used for */
  description: text("description"),
  /** Absolute Dropbox API path, e.g. /Apps NAI/RC Library App Data/Authors and Books Backup */
  dropboxPath: varchar("dropboxPath", { length: 1024 }).notNull(),
  /** Dropbox web URL for direct browser access */
  dropboxWebUrl: varchar("dropboxWebUrl", { length: 2048 }),
  /** Category: backup | inbox | source | design | other */
  category: mysqlEnum("category_dfc", ["backup", "inbox", "source", "design", "other"]).notNull().default("other"),
  /** Whether this folder connection is active and used by the app */
  enabled: boolean("enabled").notNull().default(true),
  /** Last time the path was validated against the Dropbox API */
  lastValidatedAt: timestamp("lastValidatedAt"),
  /** Result of last validation: valid | invalid | unchecked */
  validationStatus: mysqlEnum("validationStatus_dfc", ["valid", "invalid", "unchecked"]).notNull().default("unchecked"),
  /** Error message from last validation if invalid */
  validationError: text("validationError"),
  /** Sort order for display */
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt_dfc").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt_dfc").defaultNow().onUpdateNow().notNull(),
});
export type DropboxFolderConfig = typeof dropboxFolderConfigs.$inferSelect;
export type InsertDropboxFolderConfig = typeof dropboxFolderConfigs.$inferInsert;

// ── Smart Upload Jobs ─────────────────────────────────────────────────────────
/**
 * smart_uploads — tracks every file uploaded through the Smart Upload system.
 * The AI classifier analyses each file and populates the classification fields.
 * Admin can review, override, and commit the classification to the DB.
 */
export const smartUploads = mysqlTable("smart_uploads", {
  id: int("id").autoincrement().primaryKey(),
  /** Original filename from the user's file picker */
  originalFilename: varchar("originalFilename", { length: 512 }).notNull(),
  /** MIME type */
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  /** File size in bytes */
  fileSizeBytes: int("fileSizeBytes").notNull(),
  /** S3 staging key (before final placement) */
  stagingS3Key: varchar("stagingS3Key", { length: 512 }),
  /** S3 staging URL */
  stagingS3Url: varchar("stagingS3Url", { length: 1024 }),
  /** Final S3 key after commit */
  finalS3Key: varchar("finalS3Key", { length: 512 }),
  /** Final S3 URL after commit */
  finalS3Url: varchar("finalS3Url", { length: 1024 }),
  // ── AI Classification ──────────────────────────────────────────────────────
  /** Overall upload status */
  status: mysqlEnum("status_su", ["pending", "classifying", "review", "committed", "rejected", "error"]).notNull().default("pending"),
  /** AI-detected content type */
  aiContentType: mysqlEnum("aiContentType", ["book_pdf", "book_audio", "book_cover", "author_avatar", "author_bio", "article_pdf", "podcast_audio", "video", "research_paper", "newsletter", "transcript", "design_asset", "unknown"]),
  /** AI confidence score 0-100 */
  aiConfidence: int("aiConfidence"),
  /** AI reasoning text */
  aiReasoning: text("aiReasoning"),
  /** Full AI classification JSON */
  aiClassificationJson: text("aiClassificationJson"),
  /** AI-suggested author name */
  aiSuggestedAuthorName: varchar("aiSuggestedAuthorName", { length: 256 }),
  /** Matched author ID (after fuzzy match) */
  matchedAuthorId: int("matchedAuthorId"),
  /** AI-suggested book title */
  aiSuggestedBookTitle: varchar("aiSuggestedBookTitle", { length: 512 }),
  /** Matched book ID (after fuzzy match) */
  matchedBookId: int("matchedBookId"),
  /** Target DB table for this file */
  targetTable: varchar("targetTable", { length: 64 }),
  /** Whether to index in Neon pgvector */
  shouldIndexPinecone: boolean("shouldIndexPinecone").default(false),
  /** Neon namespace to use */
  neonNamespace: varchar("neonNamespace", { length: 64 }),
  /** Whether to mirror to Dropbox */
  shouldMirrorDropbox: boolean("shouldMirrorDropbox").default(true),
  /** Suggested Dropbox destination path */
  suggestedDropboxPath: varchar("suggestedDropboxPath", { length: 1024 }),
  // ── Admin Override ─────────────────────────────────────────────────────────
  /** Admin-overridden content type (if different from AI) */
  overrideContentType: varchar("overrideContentType", { length: 64 }),
  /** Admin-confirmed author ID */
  confirmedAuthorId: int("confirmedAuthorId"),
  /** Admin-confirmed book ID */
  confirmedBookId: int("confirmedBookId"),
  /** Admin notes */
  adminNotes: text("adminNotes"),
  // ── Commit Result ──────────────────────────────────────────────────────────
  /** ID of the created/updated record in the target table */
  committedRecordId: int("committedRecordId"),
  /** Error message if status=error */
  errorMessage: text("errorMessage"),
  /** When AI classification completed */
  classifiedAt: timestamp("classifiedAt"),
  /** When admin committed or rejected */
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt_su").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt_su").defaultNow().onUpdateNow().notNull(),
});
export type SmartUpload = typeof smartUploads.$inferSelect;
export type InsertSmartUpload = typeof smartUploads.$inferInsert;


// ── Author Aliases ─────────────────────────────────────────────────────────────
/**
 * Maps raw author name variants (e.g. from Dropbox folder names) to their
 * canonical display names. Replaces the hardcoded client/src/lib/authorAliases.ts.
 *
 * rawName  = the variant string (e.g. "Matthew Dixon - Sales strategy and customer psychology experts")
 * canonical = the clean display name (e.g. "Matthew Dixon")
 */
export const authorAliases = mysqlTable("author_aliases", {
  id: int("id").autoincrement().primaryKey(),
  /** The raw/variant name to normalize */
  rawName: varchar("rawName", { length: 512 }).notNull().unique(),
  /** The canonical display name to resolve to */
  canonical: varchar("canonical", { length: 256 }).notNull(),
  /** Optional note explaining why this alias exists */
  note: varchar("note", { length: 512 }),
  createdAt: timestamp("createdAt_aa").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt_aa").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  rawNameIdx: index("rawName_idx").on(t.rawName),
  canonicalIdx: index("canonical_idx").on(t.canonical),
}));
export type AuthorAlias = typeof authorAliases.$inferSelect;
export type InsertAuthorAlias = typeof authorAliases.$inferInsert;
