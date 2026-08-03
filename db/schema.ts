import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const betaAccessRequests = sqliteTable(
  "beta_access_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    androidDevice: text("android_device").notNull(),
    testingFocus: text("testing_focus").notNull(),
    status: text("status").notNull().default("pending"),
    emailStatus: text("email_status").notNull().default("pending"),
    resendEmailId: text("resend_email_id"),
    adminEmailStatus: text("admin_email_status").notNull().default("pending"),
    adminResendId: text("admin_resend_id"),
    inviteEmailStatus: text("invite_email_status")
      .notNull()
      .default("not_sent"),
    inviteResendId: text("invite_resend_id"),
    lastEmailError: text("last_email_error"),
    adminNotes: text("admin_notes").notNull().default(""),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    reviewedBy: text("reviewed_by"),
    invitedAt: integer("invited_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("beta_access_requests_email_unique").on(table.email),
    index("idx_beta_access_requests_status_created").on(
      table.status,
      table.createdAt,
    ),
  ],
);

export const betaAccessRequestEvents = sqliteTable(
  "beta_access_request_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    requestId: integer("request_id")
      .notNull()
      .references(() => betaAccessRequests.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    actorEmail: text("actor_email").notNull(),
    previousStatus: text("previous_status"),
    newStatus: text("new_status"),
    details: text("details"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("idx_beta_access_request_events_request_created").on(
      table.requestId,
      table.createdAt,
    ),
  ],
);
