import { test, expect } from "@playwright/test";
test("demo report validates, saves and tracks; mobile map filters and account fallback work", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#banner")).toContainText("Demo mode");
  await page.getByRole("link", { name: "Report", exact: true }).click();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByRole("alert")).toContainText("Enter a title");
  await page.getByLabel("Issue title").fill("Blocked drain by market");
  await page
    .getByLabel("Description")
    .fill("The drainage beside the market has been blocked for weeks.");
  await page
    .getByLabel("Category", { exact: false })
    .selectOption({ label: "Water & Drainage" });
  await page.getByRole("button", { name: "Next step" }).click();
  await page.getByLabel("Locality").selectOption({ label: "Brikama" });
  await page.getByRole("button", { name: "Next step" }).click();
  await page.getByRole("button", { name: "Next step" }).click();
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(
    page.getByRole("heading", { name: "Report saved in demo mode" }),
  ).toBeVisible();
  const reference = await page
    .locator("#app p")
    .filter({ hasText: /^DG-/ })
    .innerText();
  expect(reference).toMatch(/^DG-\d{4}-[A-HJ-KM-NP-Z2-9]{6}$/);
  await page.getByRole("link", { name: "Track this report" }).click();
  await expect(
    page.getByRole("heading", { name: "Blocked drain by market" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Community Map", exact: true }).click();
  await page
    .getByLabel("Category", { exact: true })
    .selectOption({ label: "Water & Drainage" });
  await expect(
    page.getByText("Blocked drain by market", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Accounts need Supabase" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("navigation while data is loading does not overwrite the next screen", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Report", exact: true }).click();
  await page.getByRole("link", { name: "Track", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Track your complaint" }),
  ).toBeVisible();
});

test('oversized photos are rejected without uploading',async({page})=>{
  await page.goto('/#/report');await page.getByLabel('Issue title').fill('Blocked drain');await page.getByLabel('Description').fill('The drainage is blocked near the market.');await page.getByLabel('Category',{exact:false}).selectOption({label:'Water & Drainage'});await page.getByRole('button',{name:'Next step'}).click();await page.getByLabel('Locality').selectOption('Brikama');await page.getByRole('button',{name:'Next step'}).click();await page.getByLabel('Photo (optional').setInputFiles({name:'too-large.png',mimeType:'image/png',buffer:Buffer.alloc(5*1048576+1)});await expect(page.getByRole('alert')).toContainText('larger than 5 MB');
});

test('voice transcript remains editable and unsupported languages are disclosed',async({page})=>{
 await page.addInitScript(()=>{globalThis.SpeechRecognition=class {start(){const result=[{transcript:'The drain near the market is blocked.'}];result.isFinal=true;this.onresult?.({resultIndex:0,results:[result]});this.onend?.();}stop(){this.onend?.();}};});
 await page.goto('/#/report');await page.getByRole('button',{name:'Speak (English)',exact:true}).click();await expect(page.getByLabel('Description')).toHaveValue('The drain near the market is blocked.');await page.getByLabel('Description').fill('My corrected description of the blocked drain.');await expect(page.getByLabel('Description')).toHaveValue('My corrected description of the blocked drain.');await expect(page.locator('.voice-note')).toContainText('Wolof and Mandinka recognition is unverified');
});
test('unsupported browsers receive a clear typing fallback',async({page})=>{
 await page.addInitScript(()=>{globalThis.SpeechRecognition=undefined;globalThis.webkitSpeechRecognition=undefined;});await page.goto('/#/report');await expect(page.locator('.voice-note')).toContainText('Speech recognition is unavailable in this browser');await expect(page.getByRole('button',{name:'Speak (English)',exact:true})).toHaveCount(0);await expect(page.getByLabel('Description')).toBeEditable();
});
