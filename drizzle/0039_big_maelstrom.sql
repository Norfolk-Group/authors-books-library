CREATE TABLE `human_review_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reviewType` enum('chatbot_candidate','near_duplicate','author_match','url_quality','content_classify','link_merit') NOT NULL,
	`status` enum('pending','approved','rejected','merged','skipped','auto_resolved') NOT NULL DEFAULT 'pending',
	`entityName` varchar(512) NOT NULL,
	`entityType` enum('author','book','content_item','url') NOT NULL,
	`secondaryEntityName` varchar(512),
	`secondaryEntityType` enum('author','book','content_item','url'),
	`aiConfidence` decimal(4,3),
	`aiReason` text,
	`aiSuggestedAction` text,
	`metadataJson` text,
	`adminNotes` text,
	`reviewedAt` timestamp,
	`sourceJob` varchar(128),
	`priority` int NOT NULL DEFAULT 3,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `human_review_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `hrq_reviewType_idx` ON `human_review_queue` (`reviewType`);--> statement-breakpoint
CREATE INDEX `hrq_status_idx` ON `human_review_queue` (`status`);--> statement-breakpoint
CREATE INDEX `hrq_entityName_idx` ON `human_review_queue` (`entityName`);--> statement-breakpoint
CREATE INDEX `hrq_priority_idx` ON `human_review_queue` (`priority`);