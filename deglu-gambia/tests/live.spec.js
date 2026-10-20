import { test, expect } from "@playwright/test";
const citizen = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002",
  inst = "00000000-0000-4000-8000-000000000010",
  reportId = "00000000-0000-4000-8000-000000000020";
function session() {
  const now = Math.floor(Date.now() / 1000);
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return {
    access_token:
      enc({ alg: "HS256", typ: "JWT" }) +
      "." +
      enc({ sub: citizen, role: "authenticated", iat: now, exp: now + 3600 }) +
      ".test",
    refresh_token: "test",
    expires_at: now + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: citizen,
      email: "demo@example.test",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}
async function setup(page, role = "citizen", signedIn = true) {
  const state = {
    status: "submitted",
    public: false,
    notes: [],
    submits: [],
    passwordUpdates: 0,
    roleChanges: [],
    routes: [],
    failSubmit: false,
    aiEnabled:false,aiLimited:false,assessments:[],candidates:[],aiCalls:[],reviews:[],
  };
  if (signedIn)
    await page.addInitScript(
      (s) => localStorage.setItem("sb-mvp-test-auth-token", JSON.stringify(s)),
      session(),
    );
  await page.route("https://mvp-test.supabase.co/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    let body = req.postDataJSON();
    let data = {};
    if (req.method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
        },
      });
    if (path.endsWith("/auth/v1/token")) data = session();
    else if (path.endsWith("/auth/v1/logout")) data = {};
    else if (path.endsWith("/auth/v1/recover")) data = {};
    else if (path.endsWith("/auth/v1/user")) {
      if (req.method() === "PUT") state.passwordUpdates++;
      data = { user: session().user, ...session().user };
    } else if (path.endsWith("/auth/v1/signup"))
      data = { user: session().user, session: null };
    else if (path.endsWith("/profiles"))
      data = url.searchParams.has("id")
        ? [
            {
              id: citizen,
              display_name: "Demo User",
              role,
              is_active: true,
              institution_id: role === "staff" ? inst : null,
            },
          ]
        : [
            {
              id: citizen,
              display_name: "Demo User",
              role: "admin",
              is_active: true,
            },
            {
              id: other,
              display_name: "New Staff",
              role: "citizen",
              is_active: true,
            },
          ];
    else if (path.endsWith("/report_categories")) {
      if (req.method() === "PATCH") state.routes.push(body);
      data = [
        {
          slug: "water_drainage",
          label: "Water & Drainage",
          institution_id: inst,
          is_active: true,
        },
      ];
    } else if (path.endsWith("/service_areas"))
      data = [{ id: inst, name: "Brikama" }];
    else if (path.endsWith("/institutions"))
      data = [{ id: inst, name: "Demo Council", is_active: true }];
    else if(path.endsWith('/ai_assessments')) data=state.assessments;
    else if(path.endsWith('/staff_duplicate_candidates')) data=state.candidates;
    else if(path.endsWith('/review_ai_assessment')) {state.reviews.push(body);const row=state.assessments.find(x=>x.id===body.p_id);if(row){row.status=body.p_outcome;if(body.p_corrected)row.suggestion=body.p_corrected;}data=null;}
    else if (path.endsWith("/reports"))
      data = [
        {
          id: reportId,
          reference: "DG-2026-ABCDEF",
          title: "Blocked drain",
          description: "The drain has been blocked for weeks.",
          status: state.status,
          is_public: state.public,
          institution_id: inst,
          category_slug: "water_drainage",
          area_id: inst,
          created_at: new Date().toISOString(),
        },
      ];
    else if (path.endsWith("/report_updates"))
      data = [
        {
          id: 1,
          new_status: state.status,
          note: "Report received",
          is_public: true,
          created_at: new Date().toISOString(),
        },
      ];
    else if (path.endsWith("/report_internal_notes")) {
      if (req.method() === "POST")
        state.notes.push({ ...body, created_at: new Date().toISOString() });
      data = state.notes;
    } else if (path.endsWith("/audit_logs")) data = [];
    else if (path.endsWith("/public_stats"))
      data = { total: 1, by_status: { submitted: 1 } };
    else if (path.endsWith("/public_reports"))
      data = state.public
        ? [
            {
              title: "Blocked drain",
              category: "Water & Drainage",
              area: "Brikama",
              status: state.status,
            },
          ]
        : [];
    else if (path.endsWith("/submit_report")) {
      state.submits.push(body);
      if (state.failSubmit) {
        state.failSubmit = false;
        return route.abort("failed");
      }
      data = "DG-2026-ABCDEF";
    } else if (path.endsWith("/track_report"))
      data = {
        found: true,
        status: state.status,
        area: "Brikama",
        category: "Water & Drainage",
        timeline: [
          {
            status: state.status,
            at: new Date().toISOString(),
            note: "Report received",
          },
        ],
      };
    else if (path.endsWith("/update_report_status"))
      state.status = body.p_new_status;
    else if (path.endsWith("/set_report_visibility"))
      state.public = body.p_public;
    else if (path.endsWith("/admin_set_role")) state.roleChanges.push(body);
    else if(path.includes('/functions/v1/ai')) {
      state.aiCalls.push(body);
      if(state.aiLimited)return route.fulfill({status:429,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({error:'rate_limited'})});
      if(!state.aiEnabled)data={ai_available:false};
      else if(body.action==='analyze_draft')data={ai_available:true,source:'ai',suggestion:{category:'water_drainage',summary:'The market drain is blocked.',missing_details:['How long has it been blocked?']}};
      else if(body.action==='organise')data={ai_available:true,source:'ai',draft:{title:'Blocked market drain',description:'The drain beside the market is blocked.',missing_details:[]}};
      else if(body.action==='assistant')data={ai_available:true,source:'ai',reply:'Use Track with your reference code. This assistant cannot confirm an individual report status.'};
      else if(body.action==='assess_report'){
        state.assessments=[
          {id:1,kind:'category',status:'pending',model:'gemini:test-model',suggestion:{category:'water_drainage',source:'ai'}},
          {id:2,kind:'summary',status:'pending',model:'gemini:test-model',suggestion:{summary:'The market drain is blocked.',missing_details:['How long?'],source:'ai'}},
          {id:3,kind:'priority',status:'pending',model:'gemini:test-model',suggestion:{priority:'high',reasons:['Open drain'],source:'ai'}},
          {id:4,kind:'duplicate',status:'pending',model:'sql-trigram-v1',suggestion:{candidates:[],source:'database'}},
        ];data={ai_available:true,source:'ai',assessments:state.assessments,candidates:state.candidates};
      } else if(body.action==='institution_insights')data={ai_available:true,source:'ai',summary:'3 reports were submitted; 2 are currently unresolved.',data:{window_start:'2026-10-01T00:00:00Z',window_end:'2026-10-20T00:00:00Z',total:3,unresolved:2,by_status:{submitted:2,resolved:1},categories:[{key:'water_drainage',label:'Water & Drainage',count:3,unresolved:2}],areas:[{id:inst,label:'Brikama',count:3,unresolved:2}]}};
      else throw Error('Unexpected AI action');
    }
    else throw Error("Unexpected request: " + req.method() + " " + path);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(data),
    });
  });
  return state;
}
test("signed-in report retries with the same idempotency key and tracks safely", async ({
  page,
}) => {
  const state = await setup(page);
  state.failSubmit = true;
  await page.goto("/#/report");
  await page.getByLabel("Issue title").fill("Blocked drain");
  await page
    .getByLabel("Description")
    .fill("The drain has been blocked for weeks.");
  await page
    .getByLabel("Category", { exact: false })
    .selectOption("Water & Drainage");
  await page.getByRole("button", { name: "Next step" }).click();
  await page.getByLabel("Locality").selectOption("Brikama");
  await page.getByRole("button", { name: "Next step" }).click();
  await page.getByRole("button", { name: "Next step" }).click();
  await page.getByLabel("Link this report").check();
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByRole("alert")).toContainText("Network");
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(
    page.getByRole("heading", { name: "Report submitted" }),
  ).toBeVisible();
  expect(state.submits).toHaveLength(2);
  expect(state.submits[0].p_idempotency_key).toBe(
    state.submits[1].p_idempotency_key,
  );
  expect(state.submits[1].p_link_account).toBe(true);
  await page.getByRole("link", { name: "Track this report" }).click();
  await expect(
    page.getByRole("heading", { name: "Status: Submitted" }),
  ).toBeVisible();
  await expect(
    page.getByText("The drain has been blocked for weeks."),
  ).toHaveCount(0);
});
test("staff updates status, publishes reports and adds private notes", async ({
  page,
}) => {
  const state = await setup(page, "staff");
  await page.goto("/#/account");
  await page.getByRole("link", { name: "Review reports" }).click();
  await page.getByRole("button", { name: /DG-2026-ABCDEF/ }).click();
  await page.getByLabel("Progress note").fill("Checking with the team");
  await page.getByRole("button", { name: "Save status", exact: true }).click();
  await expect(
    page.getByText("DG-2026-ABCDEF ? Under Review", { exact: true }),
  ).toBeVisible();
  expect(state.status).toBe("under_review");
  await page.getByRole("button", { name: "Approve for community map" }).click();
  await expect(
    page.getByRole("button", { name: "Remove from community map" }),
  ).toBeVisible();
  expect(state.public).toBe(true);
  await page.getByLabel("New internal note").fill("Staff-only coordination");
  await page.getByRole("button", { name: "Add internal note" }).click();
  await expect(
    page.getByText("Staff-only coordination", { exact: true }),
  ).toBeVisible();
  expect(state.notes).toHaveLength(1);
});
test("admin profile lookup works; roles and routing call protected endpoints", async ({
  page,
}) => {
  const state = await setup(page, "admin");
  await page.goto("/#/account");
  await page.getByRole("link", { name: "Administration", exact: true }).click();
  const person = page.locator(".admin-row").filter({ hasText: "New Staff" });
  await person.getByLabel("Role", { exact: true }).selectOption("staff");
  await person.getByLabel("Staff institution").selectOption(inst);
  await person.getByRole("button", { name: "Save role" }).click();
  await expect.poll(() => state.roleChanges.length).toBe(1);
  expect(state.roleChanges[0]).toEqual({
    p_user: other,
    p_role: "staff",
    p_institution: inst,
  });
  await page.getByRole("button", { name: "Save routing" }).click();
  await expect.poll(() => state.routes.length).toBe(1);
});
test("citizen cannot open staff or admin screens", async ({ page }) => {
  await setup(page);
  await page.goto("/#/staff");
  await expect(
    page.getByRole("heading", { name: "Access restricted" }),
  ).toBeVisible();
  await page.goto("/#/admin");
  await expect(
    page.getByRole("heading", { name: "Access restricted" }),
  ).toBeVisible();
});
test("password reset validates confirmation and updates the password", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/#/reset-password");
  await page
    .getByLabel("New password (8+ characters)", { exact: true })
    .fill("NewPassword123!");
  await page.getByLabel("Confirm new password").fill("DifferentPassword123!");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("status")).toContainText("do not match");
  await page.getByLabel("Confirm new password").fill("NewPassword123!");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(
    page.getByRole("heading", { name: "Password updated" }),
  ).toBeVisible();
  expect(state.passwordUpdates).toBe(1);
});
test("sign in, sign out and recovery requests work in the UI", async ({
  page,
}) => {
  await setup(page, "citizen", false);
  await page.goto("/#/account");
  await page.getByRole("button", { name: "Forgot password" }).click();
  await page.getByLabel("Email", { exact: true }).fill("demo@example.test");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("a reset link");
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
  await page.getByLabel("Email", { exact: true }).fill("demo@example.test");
  await page
    .getByLabel("Password (8+ characters)", { exact: true })
    .fill("Password123!");
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome, Demo User" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }).first(),
  ).toBeVisible();
});

test("a recovery email fragment opens the password update screen", async ({
  page,
}) => {
  await setup(page, "citizen", false);
  const s = session();
  const fragment = new URLSearchParams({
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_in: "3600",
    token_type: "bearer",
    type: "recovery",
  });
  await page.goto("/#" + fragment);
  await expect(
    page.getByRole("heading", { name: "Set a new password" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#\/reset-password$/);
});
test("signup requests confirmation without pretending a session exists", async ({
  page,
}) => {
  await setup(page, "citizen", false);
  await page.goto("/#/account");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .first()
    .click();
  await page.getByLabel("Display name").fill("Demo Citizen");
  await page.getByLabel("Email", { exact: true }).fill("demo@example.test");
  await page
    .getByLabel("Password (8+ characters)", { exact: true })
    .fill("Password123!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .last()
    .click();
  await expect(page.getByRole("status")).toContainText("check your inbox");
});
test("late home requests do not break navigation", async ({ page }) => {
  await setup(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/rest/v1/rpc/public_stats", async (route) => {
    await gate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ total: 1, by_status: {} }),
    });
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Report", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tell us what needs attention" }),
  ).toBeVisible();
  const response = page.waitForResponse("**/rest/v1/rpc/public_stats");
  release();
  await response;
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        globalThis.requestAnimationFrame(() =>
          globalThis.requestAnimationFrame(resolve),
        ),
      ),
  );
  await expect(
    page.getByRole("heading", { name: "Tell us what needs attention" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("server validation errors let the citizen go back and correct the report", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/rest/v1/rpc/submit_report", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ code: "22023", message: "unknown category" }),
    }),
  );
  await page.goto("/#/report");
  await page.getByLabel("Issue title").fill("Blocked drain");
  await page
    .getByLabel("Description")
    .fill("The drain is blocked beside the market.");
  await page
    .getByLabel("Category", { exact: false })
    .selectOption("Water & Drainage");
  await page.getByRole("button", { name: "Next step" }).click();
  await page.getByLabel("Locality").selectOption("Brikama");
  await page.getByRole("button", { name: "Next step" }).click();
  await page.getByRole("button", { name: "Next step" }).click();
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByRole("alert")).toContainText("unknown category");
  await expect(
    page.getByRole("button", { name: "Back", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Photo (optional")).toBeVisible();
});

test('draft analysis displays summary and missing details without replacing citizen meaning',async({page})=>{
 const state=await setup(page);state.aiEnabled=true;await page.goto('/#/report');await page.getByLabel('Issue title').fill('Market drain');const original='The market drain has been blocked for several weeks.';await page.getByLabel('Description').fill(original);await page.getByRole('button',{name:'Analyse draft',exact:true}).click();await expect(page.getByText('The market drain is blocked.',{exact:true})).toBeVisible();await expect(page.getByText('How long has it been blocked?',{exact:true})).toBeVisible();await expect(page.getByLabel('Description')).toHaveValue(original);await expect(page.getByLabel('Category',{exact:false})).toHaveValue('Water & Drainage');
 await page.getByLabel('Description').fill('Citizen correction: the drain is partly blocked.');await expect(page.locator('.draft-analysis')).toHaveCount(0);
});
test('staff can review AI priority and duplicate suggestions without changing reports',async({page})=>{
 const state=await setup(page,'staff');state.aiEnabled=true;state.candidates=[{report_id:other,reference:'DG-2026-GHJKLM',title:'Similar drain report',similarity:0.81,distance_km:1.1,same_area:false}];
 await page.goto('/#/staff');await page.getByRole('button',{name:/DG-2026-ABCDEF/}).click();await expect(page.getByText('Similar drain report',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Analyse report',exact:true}).click();await expect(page.getByText('Recommended priority: high',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Confirm priority',exact:true}).click();await expect.poll(()=>state.reviews.length).toBe(1);expect(state.reviews[0].p_outcome).toBe('accepted');expect(state.status).toBe('submitted');await page.getByLabel('Corrected priority suggestion').selectOption('urgent');await page.getByRole('button',{name:'Save priority correction',exact:true}).click();await expect.poll(()=>state.reviews.length).toBe(2);expect(state.reviews[1].p_corrected.priority).toBe('urgent');expect(state.submits).toHaveLength(0);
});
test('institutional insights render actual aggregate fields and use staff scope',async({page})=>{
 const state=await setup(page,'staff');state.aiEnabled=true;await page.goto('/#/staff');await page.getByRole('button',{name:'Load institutional insights'}).click();await expect(page.getByText('3 reports were submitted; 2 are currently unresolved.',{exact:true})).toBeVisible();await expect(page.getByRole('table')).toHaveCount(2);expect(state.aiCalls.find(x=>x.action==='institution_insights').institution_id).toBe(inst);
});
test('AI rate limits are clear and leave ordinary reporting available',async({page})=>{
 const state=await setup(page);state.aiLimited=true;await page.goto('/#/help');await page.getByPlaceholder('e.g. How do I track my report?').fill('How do I track?');await page.getByRole('button',{name:'Ask',exact:true}).click();await expect(page.locator('.msg.a')).toContainText('Too many');await page.getByRole('link',{name:'Report',exact:true}).click();await expect(page.getByRole('heading',{name:'Tell us what needs attention'})).toBeVisible();
});
