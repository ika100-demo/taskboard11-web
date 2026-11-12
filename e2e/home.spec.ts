import { expect, test } from "@playwright/test";

// The local e2e run has no Task API, so "/" shows the load error: still a valid page with its heading and form.
test("AC-001.5 home page renders its landmarks, the load error and the create form", async ({ page }) => {
  await page.goto("/");
  const main = page.getByRole("main");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(main).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(main.getByRole("heading", { level: 1, name: "Tasks" })).toBeVisible();
  await expect(main.getByText("Tasks could not be loaded. Try again later.")).toBeVisible();
  const form = main.getByRole("form", { name: "Create task" });
  await expect(form.getByLabel("Title")).toBeVisible();
  await expect(form.getByLabel("Due date")).toBeVisible();
  await expect(form.getByRole("button", { name: "Add task" })).toBeVisible();
});

test("AC-001.4 an empty title shows the validation message in the browser", async ({ page }) => {
  await page.goto("/");
  const form = page.getByRole("main").getByRole("form", { name: "Create task" });
  await form.getByRole("button", { name: "Add task" }).click();
  await expect(form.getByText("Title must be 1 to 200 characters")).toBeVisible();
});

test("the health endpoint answers", async ({ request }) => {
  expect((await request.get("/api/health")).ok()).toBeTruthy();
});

test("unknown routes show the friendly 404", async ({ page }) => {
  const response = await page.goto("/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "This page could not be found" })).toBeVisible();
});

test("the layout works on a phone without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
