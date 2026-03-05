CREATE TABLE `jira_settings` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `base_url` text NOT NULL,
  `email` text NOT NULL,
  `api_token` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
