CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `readings` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`author_name` text NOT NULL,
	`question` text NOT NULL,
	`mode` text NOT NULL,
	`spread` text NOT NULL,
	`cards` text NOT NULL,
	`interpretation` text NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`feedback` text DEFAULT '' NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_readings_created_at` ON `readings` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_readings_member_id` ON `readings` (`member_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_readings_idempotency_key` ON `readings` (`idempotency_key`);