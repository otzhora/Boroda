INSERT INTO `__new_jira_settings` (`id`, `base_url`, `email`, `api_token`, `created_at`, `updated_at`)
SELECT 1, `base_url`, `email`, `api_token`, `created_at`, `updated_at`
FROM `jira_settings`
ORDER BY `updated_at` DESC, `id` DESC
LIMIT 1;
