import { test } from "node:test";
import assert from "node:assert/strict";
import { readConfig } from "../src/config.js";
const env = {
  VITE_SUPABASE_URL: "https://demo.supabase.co",
  VITE_SUPABASE_ANON_KEY: "sb_publishable_test",
};
test("missing config enables demo; partial config is an error", () => {
  assert.equal(readConfig({}).live, false);
  assert.equal(readConfig({}).error, "");
  assert.ok(readConfig({ VITE_SUPABASE_URL: env.VITE_SUPABASE_URL }).error);
});
test("base URL accepted; REST URL, credentials and query rejected", () => {
  assert.equal(readConfig(env).live, true);
  for (const url of [
    "https://demo.supabase.co/rest/v1/",
    "not a URL",
    "https://user:pass@demo.supabase.co",
    "https://demo.supabase.co?key=x",
  ])
    assert.ok(readConfig({ ...env, VITE_SUPABASE_URL: url }).error);
});
test("secret keys and service-role JWTs rejected", () => {
  const jwt = (role) => "eyJ." + btoa(JSON.stringify({ role })) + ".sig";
  assert.ok(
    readConfig({ ...env, VITE_SUPABASE_ANON_KEY: "sb_secret_test" }).error,
  );
  assert.ok(
    readConfig({ ...env, VITE_SUPABASE_ANON_KEY: jwt("service_role") }).error,
  );
  assert.equal(
    readConfig({ ...env, VITE_SUPABASE_ANON_KEY: jwt("anon") }).live,
    true,
  );
});

test("network wrapper times out stalled requests and preserves caller cancellation", async () => {
  const { fetchWithTimeout } = await import("../src/network.js");
  const original = globalThis.fetch;
  globalThis.fetch = (_input, options) =>
    new Promise((_resolve, reject) => {
      if (options.signal.aborted) reject(options.signal.reason);
      else
        options.signal.addEventListener(
          "abort",
          () => reject(options.signal.reason),
          { once: true },
        );
    });
  try {
    await assert.rejects(fetchWithTimeout("https://example.test", {}, 10), {
      name: "TimeoutError",
    });
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      fetchWithTimeout("https://example.test", { signal: controller.signal }),
      { name: "AbortError" },
    );
  } finally {
    globalThis.fetch = original;
  }
});
