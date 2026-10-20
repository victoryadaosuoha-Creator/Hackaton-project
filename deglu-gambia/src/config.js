// Only browser-safe credentials are accepted. Never log the configured values.
export function readConfig(env) {
  const rawUrl = env.VITE_SUPABASE_URL?.trim() || "";
  const key = env.VITE_SUPABASE_ANON_KEY?.trim() || "";
  if (!rawUrl && !key) return { live: false, error: "" };
  const invalid = (error) => ({ live: false, error });
  if (!rawUrl || !key)
    return invalid(
      "Set both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart Vite.",
    );
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return invalid("VITE_SUPABASE_URL must be your Supabase project base URL.");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["", "/"].includes(url.pathname)
  )
    return invalid(
      "Use the Supabase project base URL without /rest/v1/, query parameters, or credentials.",
    );
  if (key.startsWith("sb_secret_"))
    return invalid(
      "A secret key cannot be used in the frontend. Use the publishable or legacy anon key.",
    );
  if (!key.startsWith("sb_publishable_")) {
    try {
      const payload = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (payload.role !== "anon")
        return invalid(
          "Only a publishable or legacy anon key can be used in the frontend.",
        );
    } catch {
      return invalid(
        "VITE_SUPABASE_ANON_KEY must be a publishable or legacy anon key.",
      );
    }
  }
  return { live: true, error: "", url: url.origin, key };
}
