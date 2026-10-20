// Bound API waits so a disconnected network produces a retryable error, not a stuck screen.
export async function fetchWithTimeout(input, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException("Network request timed out", "TimeoutError"),
      ),
    timeoutMs,
  );
  try {
    return await fetch(input, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
