CREATE TABLE `ticket_workspaces` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `ticket_id` integer NOT NULL,
  `project_folder_id` integer NOT NULL,
  `branch_name` text NOT NULL,
  `base_branch` text,
  `role` text NOT NULL DEFAULT 'primary',
  `worktree_path` text,
  `created_by_boroda` integer NOT NULL DEFAULT true,
  `last_opened_at` text,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`project_folder_id`) REFERENCES `project_folders`(`id`) ON UPDATE no action ON DELETE cascade
);
