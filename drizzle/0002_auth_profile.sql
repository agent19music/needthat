CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `categories_list_id_idx` ON `categories` (`list_id`);--> statement-breakpoint
ALTER TABLE `list_items` ADD `category_id` text;--> statement-breakpoint
ALTER TABLE `list_items` ADD `image_url` text;--> statement-breakpoint
ALTER TABLE `session` ADD `city` text;--> statement-breakpoint
ALTER TABLE `session` ADD `country` text;--> statement-breakpoint
ALTER TABLE `user` ADD `username` text;--> statement-breakpoint
ALTER TABLE `user` ADD `display_username` text;--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE INDEX `lists_user_id_idx` ON `lists` (`user_id`);