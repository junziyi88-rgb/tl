CREATE TABLE `ai_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`question` text NOT NULL,
	`spread` text NOT NULL,
	`cards` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ai_drafts_member_id` ON `ai_drafts` (`member_id`);--> statement-breakpoint
CREATE TABLE `ai_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`member_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `ai_drafts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ai_versions_draft_id` ON `ai_versions` (`draft_id`);--> statement-breakpoint
CREATE TABLE `draw_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`question` text NOT NULL,
	`spread` text NOT NULL,
	`deck` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_draw_sessions_member_id` ON `draw_sessions` (`member_id`);