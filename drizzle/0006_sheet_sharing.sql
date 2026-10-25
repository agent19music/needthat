ALTER TABLE `categories` ADD `share_prices` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `categories` ADD `share_claims` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `categories` ADD `share_on` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `lists` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `lists` ADD `for_line` text;--> statement-breakpoint
UPDATE `categories` SET `share_prices` = (SELECT `share_prices` FROM `lists` WHERE `lists`.`id` = `categories`.`list_id`), `share_claims` = (SELECT `share_claims` FROM `lists` WHERE `lists`.`id` = `categories`.`list_id`), `share_on` = (SELECT `share_on` FROM `lists` WHERE `lists`.`id` = `categories`.`list_id`) WHERE EXISTS (SELECT 1 FROM `lists` WHERE `lists`.`id` = `categories`.`list_id`);
