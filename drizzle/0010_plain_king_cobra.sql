ALTER TABLE `author_profiles` MODIFY COLUMN `avatarSource` enum('wikipedia','tavily','apify','ai','google-imagen');--> statement-breakpoint
CREATE INDEX `author_profiles_authorName_idx` ON `author_profiles` (`authorName`);--> statement-breakpoint
CREATE INDEX `author_profiles_enrichedAt_idx` ON `author_profiles` (`enrichedAt`);--> statement-breakpoint
CREATE INDEX `book_profiles_authorName_idx` ON `book_profiles` (`authorName`);--> statement-breakpoint
CREATE INDEX `book_profiles_enrichedAt_idx` ON `book_profiles` (`enrichedAt`);