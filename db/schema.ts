import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const betaAccessRequests = sqliteTable(
  "beta_access_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    androidDevice: text("android_device").notNull(),
    testingFocus: text("testing_focus").notNull(),
    status: text("status").notNull().default("requested"),
    emailStatus: text("email_status").notNull().default("pending"),
    resendEmailId: text("resend_email_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex("beta_access_requests_email_unique").on(table.email)],
);
