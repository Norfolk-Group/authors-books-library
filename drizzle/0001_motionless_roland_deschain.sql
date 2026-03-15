CREATE TABLE `author_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`authorName` varchar(256) NOT NULL,
	`bio` text,
	`websiteUrl` varchar(512),
	`twitterUrl` varchar(512),
	`linkedinUrl` varchar(512),
	`enrichedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `author_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `author_profiles_authorName_unique` UNIQUE(`authorName`)
);
