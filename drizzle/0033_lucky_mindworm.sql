CREATE TABLE `tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(128) NOT NULL,
	`name` varchar(128) NOT NULL,
	`color` varchar(7) NOT NULL DEFAULT '#6366F1',
	`usageCount` int NOT NULL DEFAULT 0,
	`description` text,
	`displayOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tags_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `tagsJson` text;--> statement-breakpoint
ALTER TABLE `book_profiles` ADD `tagsJson` text;--> statement-breakpoint
CREATE INDEX `tags_slug_idx` ON `tags` (`slug`);