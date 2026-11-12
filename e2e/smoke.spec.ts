import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

test.skip(!process.env.SMOKE_BASE_URL, "SMOKE_BASE_URL not set");

// Read-only, so it runs in every environment. A smoke test that creates or changes data also carries
// @writes in its title (or { tag: "@writes" }) and then runs only in dev (#474).

test("AC-001.1 the root page loads with the Tasks heading and the form @smoke", async ({ page }) => {
  await page.goto("/");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 1, name: "Tasks" })).toBeVisible();
  await expect(main.getByRole("form", { name: "Create task" })).toBeVisible();
});

test("AC-001.3 a created task appears in the list @smoke @writes", async ({ page }) => {
  const title = `smoke-${randomUUID()}`;
  await page.goto("/");
  const main = page.getByRole("main");
  const form = main.getByRole("form", { name: "Create task" });
  await form.getByLabel("Title").fill(title);
  await form.getByRole("button", { name: "Add task" }).click();
  await expect(main.getByRole("list", { name: "Tasks" }).getByText(title)).toBeVisible();
});
