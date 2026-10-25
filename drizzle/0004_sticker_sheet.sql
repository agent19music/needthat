CREATE TABLE `claims` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`claimer_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `list_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`claimer_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `claims_item_id_idx` ON `claims` (`item_id`);--> statement-breakpoint
ALTER TABLE `categories` ADD `color` text;--> statement-breakpoint
ALTER TABLE `lists` ADD `share_prices` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `lists` ADD `share_claims` integer DEFAULT true NOT NULL;--> statement-breakpoint
-- Backfill: existing tags take the blue → green → red cycle in creation order, per list (ties by id).
UPDATE `categories` SET `color` = (
	SELECT CASE (COUNT(*) % 3) WHEN 0 THEN 'blue' WHEN 1 THEN 'green' ELSE 'red' END
	FROM `categories` AS `o`
	WHERE `o`.`list_id` = `categories`.`list_id`
	AND (`o`.`created_at` < `categories`.`created_at`
		OR (`o`.`created_at` = `categories`.`created_at` AND `o`.`id` < `categories`.`id`))
) WHERE `color` IS NULL;
