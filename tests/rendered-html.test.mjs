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
  assert.match(page, /hello@idistudios\.io/);
  assert.match(page, /world-starved-wyrm/);
  assert.match(page, /battle-skirmish/);
  assert.match(page, /city-university/);
  assert.match(page, /world-blackstone-warehouse/);
  assert.match(page, /barracks-roster/);
  assert.match(page, /Overworld/);
  assert.match(page, /Character UI/);
  assert.match(page, /Menus & progression/);
  assert.match(styles, /hero-worlds-worth-mastering/);
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
  assert.match(menusGroup, /army-setup/);
  assert.match(menusGroup, /barracks-roster/);
  assert.doesNotMatch(page, /Respect is a design system|Campaign landmarks|Enemy factions/);
  assert.doesNotMatch(page, /conquest-(?:world-map|hero|city|leaders)/i);
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
