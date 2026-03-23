CREATE TABLE IF NOT EXISTS `favorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` varchar(64) NOT NULL,
	`entityType` enum('author','book') NOT NULL,
	`entityKey` varchar(512) NOT NULL,
	`displayName` varchar(512),
	`imageUrl` varchar(1024),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `favorites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `book_profiles` MODIFY COLUMN `rating` decimal(3,1);--> statement-breakpoint
ALTER TABLE `author_profiles` ADD COLUMN IF NOT EXISTS `platformEnrichmentStatus` text;--> statement-breakpoint
ALTER TABLE `author_profiles` ADD COLUMN IF NOT EXISTS `researchQuality` enum('high','medium','low');--> statement-breakpoint
ALTER TABLE `sync_status` ADD COLUMN IF NOT EXISTS `enrichmentType` varchar(64);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `favorites_userId_entityType_entityKey_idx` ON `favorites` (`userId`,`entityType`,`entityKey`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `favorites_userId_idx` ON `favorites` (`userId`);
