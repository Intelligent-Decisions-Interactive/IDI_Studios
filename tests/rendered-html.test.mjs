import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("keeps the IDI Studios voice and Conquest focus in the homepage source", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(page, /Worlds worth/);
  assert.match(page, /Conquest:/);
  assert.match(page, /No pay-to-win/);
  assert.match(page, /Small studio/);
  assert.match(page, /development@idistudios\.io/);
  assert.doesNotMatch(page, /hello@idistudios\.io/);
  assert.match(page, /Request beta access/);
  assert.match(page, /beta-access/);
  assert.match(page, /BetaAccessModal/);
  assert.match(page, /BetaAccessTrigger/);
  assert.match(page, /world-starved-wyrm/);
  assert.match(page, /battle-skirmish/);
  assert.match(page, /city-university/);
  assert.match(page, /world-blackstone-warehouse/);
  assert.match(page, /barracks-roster/);
  assert.match(page, /barracks-training/);
  assert.match(page, /item-catalogue/);
  assert.match(page, /Overworld/);
  assert.match(page, /Character UI/);
  assert.match(page, /Menus & progression/);
  assert.match(styles, /hero-worlds-worth-mastering/);
  assert.match(styles, /\.capture-group--overworld \.capture-grid,\s*\.capture-group--city \.capture-grid,\s*\.capture-group--characters \.capture-grid,\s*\.capture-group--menus \.capture-grid \{\s*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);\s*\}/);
  assert.doesNotMatch(styles, /\.capture-group--(?:city|characters|menus) \.capture-grid[\s\S]{0,120}width: min\(1080px, 100%\)/);
  assert.match(page, /realm-development/);
  assert.match(page, /formation-command/);
  assert.match(page, /ascension-event/);
  assert.match(page, /Visual direction, not in-game footage/);
  const overworldGroup = page.match(/id: "overworld"[\s\S]*?(?=id: "city")/)?.[0] ?? "";
  const cityGroup = page.match(/id: "city"[\s\S]*?(?=id: "characters")/)?.[0] ?? "";
  const characterGroup = page.match(/id: "characters"[\s\S]*?(?=id: "menus")/)?.[0] ?? "";
  const menusGroup = page.match(/id: "menus"[\s\S]*?(?=\];)/)?.[0] ?? "";
  assert.doesNotMatch(overworldGroup, /world-blackstone-warehouse/);
  assert.match(cityGroup, /world-blackstone-warehouse/);
  assert.doesNotMatch(characterGroup, /army-setup|barracks-roster/);
  assert.match(characterGroup, /barracks-training/);
  assert.match(characterGroup, /item-catalogue/);
  assert.match(menusGroup, /army-setup/);
  assert.match(menusGroup, /barracks-roster/);
  assert.match(page, /conquest-wordmark/);
  assert.doesNotMatch(page, /account-realm-overview/);
  assert.doesNotMatch(page, /Respect is a design system|Campaign landmarks|Enemy factions/);
  assert.doesNotMatch(page, /conquest-(?:world-map|hero|city|leaders)/i);
});

test("stores beta applications and sends Resend notifications", async () => {
  const [form, route, emailHelper, schema, hosting] = await Promise.all([
    readFile(new URL("../app/beta-access-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/beta-access/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/beta-email.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  assert.match(form, /\/api\/beta-access/);
  assert.match(form, /Android device/);
  assert.match(form, /role="dialog"/);
  assert.match(form, /aria-modal="true"/);
  assert.match(form, /event\.key === "Escape"/);
  assert.match(form, /previousFocusRef/);
  assert.match(form, /You&apos;re on/);
  assert.match(form, /cloudflare\.com\/turnstile/);
  assert.match(form, /turnstileRequired/);
  assert.match(emailHelper, /api\.resend\.com\/emails/);
  assert.match(emailHelper, /RESEND_API_KEY/);
  assert.match(route, /siteverify/);
  assert.match(route, /TURNSTILE_SECRET_KEY/);
  assert.match(route, /0x4AAAAAAEFhAAW5N5kUh-aO/);
  assert.match(schema, /beta_access_requests/);
  assert.match(schema, /beta_access_request_events/);
  assert.equal(JSON.parse(hosting).d1, "DB");
});

test("protects and operates the beta administration console", async () => {
  const [page, consoleSource, auth, listRoute, detailRoute, migration] =
    await Promise.all([
      readFile(new URL("../app/admin/beta/page.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../app/admin/beta/beta-admin-console.tsx", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../app/beta-admin.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../app/admin/api/requests/route.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/admin/api/requests/[id]/route.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../drizzle/0001_puzzling_lockjaw.sql", import.meta.url),
        "utf8",
      ),
    ]);

  assert.match(page, /getAdminActorFromHeaders/);
  assert.match(page, /Verified access required/);
  assert.match(consoleSource, /Applicant management/);
  assert.match(consoleSource, /Private admin notes/);
  assert.match(consoleSource, /Send invitation/);
  assert.match(consoleSource, /Activity history/);
  assert.match(auth, /cf-access-authenticated-user-email/);
  assert.match(auth, /cf-access-jwt-assertion/);
  assert.match(auth, /oai-authenticated-user-email/);
  assert.match(auth, /BETA_ADMIN_EMAILS/);
  assert.match(listRoute, /\.limit\(250\)/);
  assert.match(detailRoute, /status_changed/);
  assert.match(detailRoute, /5,000 characters/);
  assert.match(migration, /PRAGMA optimize/);
  assert.match(migration, /CASE WHEN "status" = 'requested' THEN 'pending'/);
});

test("uses Wrangler as the Cloudflare configuration source of truth", async () => {
  const [wranglerSource, packageSource, viteSource] = await Promise.all([
    readFile(new URL("wrangler.jsonc", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("vite.config.ts", root), "utf8"),
  ]);
  const wrangler = JSON.parse(wranglerSource);
  const packageJson = JSON.parse(packageSource);

  assert.equal(wrangler.name, "idi-studios");
  assert.equal(wrangler.main, "./worker/index.ts");
  assert.equal(wrangler.assets.binding, "ASSETS");
  assert.equal(wrangler.assets.run_worker_first, true);
  assert.equal(packageJson.scripts.deploy, "npm run build && wrangler deploy");
  assert.match(viteSource, /cloudflare\(\{/);
  assert.doesNotMatch(viteSource, /hostingConfig|localBindingConfig|config:\s*localBindingConfig/);
});
