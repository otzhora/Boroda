PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_tickets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`priority` text NOT NULL,
	`due_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
INSERT INTO `__new_tickets` (`id`, `key`, `title`, `description`, `status`, `priority`, `due_at`, `created_at`, `updated_at`, `archived_at`)
SELECT `id`, `key`, `title`, `description`, `status`, `priority`, `due_at`, `created_at`, `updated_at`, `archived_at`
FROM `tickets`;
--> statement-breakpoint
DROP TABLE `tickets`;
--> statement-breakpoint
ALTER TABLE `__new_tickets` RENAME TO `tickets`;
--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_key_unique` ON `tickets` (`key`);
--> statement-breakpoint
CREATE INDEX `idx_tickets_status_priority_updated` ON `tickets` (`status`,`priority`,`updated_at`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
