CREATE TABLE `board_columns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text NOT NULL,
	`label` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `board_columns_status_unique` ON `board_columns` (`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `board_columns_position_unique` ON `board_columns` (`position`);
--> statement-breakpoint
INSERT INTO `board_columns` (`status`, `label`, `position`)
VALUES
	('INBOX', 'Inbox', 0),
	('READY', 'Ready', 1),
	('IN_PROGRESS', 'In Progress', 2),
	('BLOCKED', 'Blocked', 3),
	('IN_REVIEW', 'In Review', 4),
	('MANUAL_UI', 'Manual UI', 5),
	('DONE', 'Done', 6);
