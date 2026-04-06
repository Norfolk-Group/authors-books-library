ALTER TABLE `author_profiles` ADD `newsCacheJson` text;--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `newsCachedAt` timestamp;--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `cnbcMentionsCacheJson` text;--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `cnbcMentionsCachedAt` timestamp;--> statement-breakpoint
ALTER TABLE `book_profiles` ADD `openLibraryCacheJson` text;--> statement-breakpoint
ALTER TABLE `book_profiles` ADD `openLibraryCachedAt` timestamp;--> statement-breakpoint
ALTER TABLE `book_profiles` ADD `hathiTrustCacheJson` text;--> statement-breakpoint
ALTER TABLE `book_profiles` ADD `hathiTrustCachedAt` timestamp;--> statement-breakpoint
ALTER TABLE `book_profiles` ADD `worldcatCacheJson` text;--> statement-breakpoint
ALTER TABLE `book_profiles` ADD `worldcatCachedAt` timestamp;