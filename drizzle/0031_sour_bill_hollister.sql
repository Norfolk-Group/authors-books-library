CREATE TABLE `author_content_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`authorName` varchar(256) NOT NULL,
	`contentItemId` int NOT NULL,
	`role` enum('primary','co-author','editor','contributor','foreword','narrator') NOT NULL DEFAULT 'primary',
	`displayOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `author_content_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `author_interest_scores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`authorName` varchar(256) NOT NULL,
	`interestId` int NOT NULL,
	`userId` varchar(64) NOT NULL,
	`score` int NOT NULL,
	`rationale` text,
	`modelUsed` varchar(128),
	`computedAt` timestamp NOT NULL DEFAULT (now()),
	`ragVersion` int,
	CONSTRAINT `author_interest_scores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `author_rag_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`authorName` varchar(256) NOT NULL,
	`ragFileUrl` varchar(1024),
	`ragFileKey` varchar(512),
	`ragVersion` int NOT NULL DEFAULT 1,
	`ragGeneratedAt` timestamp,
	`ragWordCount` int,
	`ragModel` varchar(128),
	`ragVendor` varchar(64),
	`contentItemCount` int NOT NULL DEFAULT 0,
	`bioCompletenessAtGeneration` int,
	`ragStatus` enum('pending','generating','ready','stale') NOT NULL DEFAULT 'pending',
	`ragError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `author_rag_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `author_rag_profiles_authorName_unique` UNIQUE(`authorName`)
);
--> statement-breakpoint
CREATE TABLE `author_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`authorName` varchar(256) NOT NULL,
	`platform` enum('youtube','substack','podcast','medium','newsletter','google_books','amazon','twitter','linkedin') NOT NULL,
	`platformId` varchar(512),
	`feedUrl` varchar(1024),
	`enabled` int NOT NULL DEFAULT 1,
	`intervalHours` int NOT NULL DEFAULT 24,
	`lastPolledAt` timestamp,
	`lastNewContentAt` timestamp,
	`lastPollNewCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `author_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contentItemId` int NOT NULL,
	`s3Key` varchar(512) NOT NULL,
	`s3Url` varchar(1024) NOT NULL,
	`originalFilename` varchar(512),
	`cleanFilename` varchar(512),
	`mimeType` varchar(128),
	`fileSizeBytes` int,
	`md5Checksum` varchar(32),
	`fileType` enum('pdf','mp3','mp4','epub','doc','transcript','image','json','other') NOT NULL DEFAULT 'pdf',
	`dropboxPath` varchar(1024),
	`dropboxSyncedAt` timestamp,
	`driveFileId` varchar(128),
	`driveSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_files_id` PRIMARY KEY(`id`),
	CONSTRAINT `content_files_s3Key_unique` UNIQUE(`s3Key`)
);
--> statement-breakpoint
CREATE TABLE `content_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contentType` enum('book','paper','article','substack','newsletter','podcast','podcast_episode','youtube_video','youtube_channel','ted_talk','masterclass','online_course','tv_show','tv_episode','film','radio','photography','social_post','speech','interview','blog_post','website','tool','other') NOT NULL,
	`title` varchar(512) NOT NULL,
	`subtitle` varchar(512),
	`description` text,
	`richDescriptionJson` text,
	`url` varchar(1024),
	`coverImageUrl` varchar(1024),
	`s3CoverUrl` varchar(1024),
	`s3CoverKey` varchar(512),
	`publishedDate` varchar(64),
	`tagsJson` text,
	`rating` decimal(3,1),
	`ratingCount` int,
	`language` varchar(8),
	`metadataJson` text,
	`includedInLibrary` int NOT NULL DEFAULT 1,
	`driveFolderId` varchar(128),
	`readingNotesJson` text,
	`enrichedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ingest_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contentItemId` int NOT NULL,
	`sourceType` enum('dropbox','google_drive','manual_upload','scrape','api','dropbox_mirror','drive_mirror') NOT NULL,
	`sourcePath` varchar(1024),
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ingest_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`target` enum('dropbox','google_drive','both') NOT NULL,
	`status` enum('pending','running','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`triggeredBy` enum('manual','schedule','api') NOT NULL DEFAULT 'manual',
	`scope` varchar(1024) NOT NULL DEFAULT 'all',
	`totalFiles` int NOT NULL DEFAULT 0,
	`syncedFiles` int NOT NULL DEFAULT 0,
	`skippedFiles` int NOT NULL DEFAULT 0,
	`failedFiles` int NOT NULL DEFAULT 0,
	`bytesTransferred` int NOT NULL DEFAULT 0,
	`message` text,
	`error` text,
	`fileResultsJson` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sync_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_interests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` varchar(64) NOT NULL,
	`topic` varchar(256) NOT NULL,
	`description` text,
	`category` varchar(128),
	`weight` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`color` varchar(7) DEFAULT '#6366F1',
	`displayOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_interests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `geographyJson` text;--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `historicalContextJson` text;--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `familyJson` text;--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `associationsJson` text;--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `formativeExperiencesJson` text;--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `authorBioSourcesJson` text;--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `bioCompleteness` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `author_profiles` ADD `contextualIntelligenceEnrichedAt` timestamp;--> statement-breakpoint
CREATE INDEX `author_content_links_authorName_idx` ON `author_content_links` (`authorName`);--> statement-breakpoint
CREATE INDEX `author_content_links_contentItemId_idx` ON `author_content_links` (`contentItemId`);--> statement-breakpoint
CREATE INDEX `author_content_links_unique_idx` ON `author_content_links` (`authorName`,`contentItemId`);--> statement-breakpoint
CREATE INDEX `author_interest_scores_author_interest_idx` ON `author_interest_scores` (`authorName`,`interestId`);--> statement-breakpoint
CREATE INDEX `author_interest_scores_userId_idx` ON `author_interest_scores` (`userId`);--> statement-breakpoint
CREATE INDEX `author_interest_scores_score_idx` ON `author_interest_scores` (`score`);--> statement-breakpoint
CREATE INDEX `author_rag_profiles_authorName_idx` ON `author_rag_profiles` (`authorName`);--> statement-breakpoint
CREATE INDEX `author_rag_profiles_ragStatus_idx` ON `author_rag_profiles` (`ragStatus`);--> statement-breakpoint
CREATE INDEX `author_subscriptions_author_platform_idx` ON `author_subscriptions` (`authorName`,`platform`);--> statement-breakpoint
CREATE INDEX `content_files_contentItemId_idx` ON `content_files` (`contentItemId`);--> statement-breakpoint
CREATE INDEX `content_files_fileType_idx` ON `content_files` (`fileType`);--> statement-breakpoint
CREATE INDEX `content_items_contentType_idx` ON `content_items` (`contentType`);--> statement-breakpoint
CREATE INDEX `content_items_title_idx` ON `content_items` (`title`);--> statement-breakpoint
CREATE INDEX `content_items_included_idx` ON `content_items` (`includedInLibrary`);--> statement-breakpoint
CREATE INDEX `ingest_sources_contentItemId_idx` ON `ingest_sources` (`contentItemId`);--> statement-breakpoint
CREATE INDEX `sync_jobs_status_idx` ON `sync_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `sync_jobs_target_idx` ON `sync_jobs` (`target`);--> statement-breakpoint
CREATE INDEX `user_interests_userId_idx` ON `user_interests` (`userId`);--> statement-breakpoint
CREATE INDEX `user_interests_userId_category_idx` ON `user_interests` (`userId`,`category`);