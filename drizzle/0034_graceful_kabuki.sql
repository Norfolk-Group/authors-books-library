ALTER TABLE `book_profiles` ADD `readingProgressPercent` int;--> statement-breakpoint
ALTER TABLE `book_profiles` ADD `readingStartedAt` timestamp;--> statement-breakpoint
ALTER TABLE `book_profiles` ADD `readingFinishedAt` timestamp;--> statement-breakpoint
ALTER TABLE `book_profiles` ADD `personalNotesJson` text;