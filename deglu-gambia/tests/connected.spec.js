import { test, expect } from "@playwright/test";
// Uses the configured project for READ-ONLY browser checks. No accounts or reports are created.
test("real Supabase serves home data, report reference data and community listing", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const responses = [];
  page.on("response", (r) => {
    if (r.url().includes("/rest/v1/")) responses.push(r.status());
  });
  await page.goto("/");
  await expect(page.locator("#banner")).toBeHidden();
  await expect(page.locator("#st .card")).toHaveCount(4, { timeout: 20000 });
  await expect(page.locator("#rec")).not.toContainText("Loading");
  await expect(page.locator("#rec")).not.toContainText("Could not load");
  await page.screenshot({
    path: ".temp/connected-home-mobile.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Report", exact: true }).click();
  await expect(
    page.getByLabel("Category", { exact: false }).locator("option"),
  ).not.toHaveCount(1);
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByRole("alert")).toContainText("Enter a title");
  await page.getByRole("link", { name: "Community Map", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Community map", exact: true }),
  ).toBeVisible();
  await expect(page.locator("svg.map")).toBeVisible();
  expect(responses.length).toBeGreaterThanOrEqual(4);
  expect(responses.every((s) => s === 200)).toBe(true);
  expect(errors).toEqual([]);
});
