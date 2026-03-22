ALTER TABLE `author_profiles` RENAME COLUMN `photoUrl` TO `avatarUrl`;--> statement-breakpoint
ALTER TABLE `author_profiles` RENAME COLUMN `photoSourceUrl` TO `avatarSourceUrl`;--> statement-breakpoint
ALTER TABLE `author_profiles` RENAME COLUMN `s3PhotoUrl` TO `s3AvatarUrl`;--> statement-breakpoint
ALTER TABLE `author_profiles` RENAME COLUMN `s3PhotoKey` TO `s3AvatarKey`;--> statement-breakpoint
ALTER TABLE `author_profiles` RENAME COLUMN `photoSource` TO `avatarSource`;