CREATE TABLE `magazine_articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`articleId` varchar(192) NOT NULL,
	`source` enum('the-atlantic','the-new-yorker','wired','nyt','washington-post') NOT NULL,
	`publicationName` varchar(128) NOT NULL,
	`title` text NOT NULL,
	`url` varchar(1024) NOT NULL,
	`authorName` varchar(256),
	`authorNameNormalized` varchar(256),
	`publishedAt` timestamp,
	`summaryText` text,
	`fullText` text,
	`categoriesJson` text,
	`feedUrl` varchar(512),
	`scrapedAt` timestamp,
	`scrapeAttempted` boolean NOT NULL DEFAULT false,
	`ragIndexed` boolean NOT NULL DEFAULT false,
	`ragIndexedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `magazine_articles_id` PRIMARY KEY(`id`),
	CONSTRAINT `magazine_articles_articleId_unique` UNIQUE(`articleId`)
);
--> statement-breakpoint
CREATE INDEX `mag_author_idx` ON `magazine_articles` (`authorNameNormalized`);--> statement-breakpoint
CREATE INDEX `mag_source_idx` ON `magazine_articles` (`source`);--> statement-breakpoint
CREATE INDEX `mag_published_idx` ON `magazine_articles` (`publishedAt`);--> statement-breakpoint
CREATE INDEX `mag_article_id_idx` ON `magazine_articles` (`articleId`);--> statement-breakpoint
CREATE INDEX `mag_rag_idx` ON `magazine_articles` (`ragIndexed`);