CREATE TABLE `ticket_jira_issue_links` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `ticket_id` integer NOT NULL,
  `issue_key` text NOT NULL,
  `issue_summary` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ticket_jira_issue_links_ticket_id` ON `ticket_jira_issue_links` (`ticket_id`);
--> statement-breakpoint
CREATE INDEX `idx_ticket_jira_issue_links_issue_key` ON `ticket_jira_issue_links` (`issue_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `ticket_jira_issue_unique` ON `ticket_jira_issue_links` (`ticket_id`,`issue_key`);
--> statement-breakpoint
INSERT INTO `ticket_jira_issue_links` (`ticket_id`, `issue_key`, `issue_summary`, `created_at`)
SELECT `id`, trim(`jira_ticket`), '', `updated_at`
FROM `tickets`
WHERE `jira_ticket` IS NOT NULL AND trim(`jira_ticket`) <> '';
