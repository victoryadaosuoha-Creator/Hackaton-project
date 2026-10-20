// Read-only API smoke checks. Credentials are loaded locally and never printed.
import assert from "node:assert/strict";
import { loadEnv } from "vite";
import { createClient } from "@supabase/supabase-js";
import { readConfig } from "../src/config.js";
const config = readConfig(loadEnv("development", process.cwd(), "VITE_"));
assert.ok(config.live, config.error || "Supabase is not configured");
const db = createClient(config.url, config.key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
for (const table of ["report_categories", "service_areas"]) {
  const { data, error } = await db
    .from(table)
    .select("*")
    .eq("is_active", true)
    .limit(1);
  assert.equal(error, null, table + " must be readable");
  assert.ok(data.length, table + " needs active reference data");
  console.log("PASS active " + table);
}
for (const name of ["public_stats", "public_reports"]) {
  const { error } = await db.rpc(name);
  assert.equal(error, null);
  console.log("PASS " + name);
}
const tracked = await db.rpc("track_report", { p_reference: "INVALID" });
assert.equal(tracked.error, null);
assert.equal(tracked.data.found, false);
console.log("PASS invalid tracking input rejected");
for (const table of [
  "reports",
  "profiles",
  "report_internal_notes",
  "audit_logs",
  "ai_rate_limits",
]) {
  const { error } = await db.from(table).select("*").limit(1);
  assert.equal(error?.code, "42501", table + " must reject anonymous access");
  console.log("PASS anonymous access denied: " + table);
}
const ai = await db.functions.invoke("ai", { body: { action: "status" } });
console.log(
  ai.error
    ? "AI status: unavailable (optional; deployment/configuration still required)"
    : "AI status: " +
        (ai.data?.ai_available ? "configured" : "provider not configured"),
);
