CREATE INDEX `author_profiles_bioCompleteness_idx` ON `author_profiles` (`bioCompleteness`);--> statement-breakpoint
CREATE INDEX `book_profiles_isbn_idx` ON `book_profiles` (`isbn`);--> statement-breakpoint
CREATE INDEX `book_profiles_possessionStatus_idx` ON `book_profiles` (`possessionStatus`);--> statement-breakpoint
CREATE INDEX `book_profiles_format_idx` ON `book_profiles` (`format`);