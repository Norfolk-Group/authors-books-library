CREATE TABLE `enrichment_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pipelineKey` varchar(128) NOT NULL,
	`status` enum('queued','running','completed','failed','cancelled') NOT NULL DEFAULT 'queued',
	`triggeredBy` enum('schedule','manual','api') NOT NULL DEFAULT 'manual',
	`totalItems` int NOT NULL DEFAULT 0,
	`processedItems` int NOT NULL DEFAULT 0,
	`succeededItems` int NOT NULL DEFAULT 0,
	`failedItems` int NOT NULL DEFAULT 0,
	`skippedItems` int NOT NULL DEFAULT 0,
	`progress` int NOT NULL DEFAULT 0,
	`message` text,
	`error` text,
	`itemResultsJson` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `enrichment_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `enrichment_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pipelineKey` varchar(128) NOT NULL,
	`label` varchar(256) NOT NULL,
	`entityType` enum('author','book','both') NOT NULL,
	`enabled` int NOT NULL DEFAULT 0,
	`intervalHours` int NOT NULL DEFAULT 168,
	`batchSize` int NOT NULL DEFAULT 10,
	`concurrency` int NOT NULL DEFAULT 2,
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`lastRunStatus` enum('success','partial','failed'),
	`lastRunItemCount` int,
	`lastRunDurationMs` int,
	`lastRunError` text,
	`priority` int NOT NULL DEFAULT 5,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `enrichment_schedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `enrichment_schedules_pipelineKey_unique` UNIQUE(`pipelineKey`)
);
--> statement-breakpoint
CREATE INDEX `enrichment_jobs_pipelineKey_idx` ON `enrichment_jobs` (`pipelineKey`);--> statement-breakpoint
CREATE INDEX `enrichment_jobs_status_idx` ON `enrichment_jobs` (`status`);