CREATE TABLE `beta_access_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`android_device` text NOT NULL,
	`testing_focus` text NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`email_status` text DEFAULT 'pending' NOT NULL,
	`resend_email_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `beta_access_requests_email_unique` ON `beta_access_requests` (`email`);