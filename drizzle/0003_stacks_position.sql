ALTER TABLE `list_items` ADD `position` integer;--> statement-breakpoint
ALTER TABLE `list_items` ADD `purchased_at` integer;--> statement-breakpoint
CREATE INDEX `list_items_list_position_idx` ON `list_items` (`list_id`,`position`);--> statement-breakpoint
-- Backfill: keep today's order (newest first) as the starting manual order, 0-based per list.
UPDATE `list_items` SET `position` = (
	SELECT COUNT(*) FROM `list_items` AS `o`
	WHERE `o`.`list_id` = `list_items`.`list_id`
	AND (`o`.`created_at` > `list_items`.`created_at`
		OR (`o`.`created_at` = `list_items`.`created_at` AND `o`.`id` < `list_items`.`id`))
) WHERE `position` IS NULL;--> statement-breakpoint
-- Backfill: items already marked got use their last update as the best known purchase date.
UPDATE `list_items` SET `purchased_at` = `updated_at` WHERE `status` = 'purchased' AND `purchased_at` IS NULL;
