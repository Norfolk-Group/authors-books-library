ALTER TABLE `book_profiles` ADD `duplicateOfId` int;--> statement-breakpoint
ALTER TABLE `book_profiles` ADD `duplicateDetectionMethod` varchar(32);--> statement-breakpoint
ALTER TABLE `book_profiles` ADD `duplicateStatus` varchar(16);--> statement-breakpoint
ALTER TABLE `book_profiles` ADD `duplicateFlaggedAt` timestamp;--> statement-breakpoint
ALTER TABLE `content_files` ADD `contentHash` varchar(64);--> statement-breakpoint
ALTER TABLE `content_files` ADD `duplicateOfId` int;--> statement-breakpoint
ALTER TABLE `content_files` ADD `duplicateDetectionMethod` varchar(32);--> statement-breakpoint
ALTER TABLE `content_files` ADD `duplicateStatus` varchar(16);--> statement-breakpoint
ALTER TABLE `content_files` ADD `duplicateFlaggedAt` timestamp;