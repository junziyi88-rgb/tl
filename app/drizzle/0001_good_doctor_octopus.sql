CREATE TABLE `ai_generations` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`member_id` text NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ai_generations_draft_member` ON `ai_generations` (`draft_id`,`member_id`);--> statement-breakpoint
CREATE TABLE `custom_spreads` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`name` text NOT NULL,
	`positions` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_custom_spreads_member_id` ON `custom_spreads` (`member_id`);--> statement-breakpoint
ALTER TABLE `readings` ADD `spread_data` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `readings` ADD `ai_interpretation` text DEFAULT '' NOT NULL;