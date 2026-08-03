CREATE TABLE `beta_access_request_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`actor_email` text NOT NULL,
	`previous_status` text,
	`new_status` text,
	`details` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `beta_access_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_beta_access_request_events_request_created` ON `beta_access_request_events` (`request_id`,`created_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_beta_access_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`android_device` text NOT NULL,
	`testing_focus` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`email_status` text DEFAULT 'pending' NOT NULL,
	`resend_email_id` text,
	`admin_email_status` text DEFAULT 'pending' NOT NULL,
	`admin_resend_id` text,
	`invite_email_status` text DEFAULT 'not_sent' NOT NULL,
	`invite_resend_id` text,
	`last_email_error` text,
	`admin_notes` text DEFAULT '' NOT NULL,
	`reviewed_at` integer,
	`reviewed_by` text,
	`invited_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_beta_access_requests`("id", "name", "email", "android_device", "testing_focus", "status", "email_status", "resend_email_id", "admin_email_status", "admin_resend_id", "invite_email_status", "invite_resend_id", "last_email_error", "admin_notes", "reviewed_at", "reviewed_by", "invited_at", "created_at", "updated_at") SELECT "id", "name", "email", "android_device", "testing_focus", CASE WHEN "status" = 'requested' THEN 'pending' ELSE "status" END, "email_status", "resend_email_id", 'pending', NULL, 'not_sent', NULL, NULL, '', NULL, NULL, NULL, "created_at", "updated_at" FROM `beta_access_requests`;--> statement-breakpoint
DROP TABLE `beta_access_requests`;--> statement-breakpoint
ALTER TABLE `__new_beta_access_requests` RENAME TO `beta_access_requests`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `beta_access_requests_email_unique` ON `beta_access_requests` (`email`);--> statement-breakpoint
CREATE INDEX `idx_beta_access_requests_status_created` ON `beta_access_requests` (`status`,`created_at`);--> statement-breakpoint
PRAGMA optimize;
