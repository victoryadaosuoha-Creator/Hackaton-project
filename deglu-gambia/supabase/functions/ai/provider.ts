// Provider abstraction. The API key is read from Edge Function secrets only, never from the browser.

export interface Msg { role: 'user' | 'assistant'; content: string }
export interface ProviderConfig { provider: 'gemini' | 'anthropic'; apiKey: string; model: string; timeoutMs: number }

/** Deliberately carries no provider response body, so report text cannot leak into logs or errors. */
export class ProviderError extends Error {
  constructor(public code: string) { super(code); }
}

// Defaults are suggestions. Set AI_MODEL explicitly and check the provider's current model list.
const DEFAULT_MODEL = { gemini: 'gemini-2.5-flash', anthropic: 'claude-haiku-5-5' } as const;

/** Returns null when AI is not configured. The app must then keep working without AI. */
export function getConfig(env: (k: string) => string | undefined): ProviderConfig | null {
  const apiKey = env('AI_API_KEY')?.trim();
  if (!apiKey) return null;
  const provider = (env('AI_PROVIDER') ?? 'gemini').toLowerCase();
  if (provider !== 'gemini' && provider !== 'anthropic') return null;
  const timeoutMs = Math.min(Math.max(Number(env('AI_TIMEOUT_MS')) || 15000, 3000), 30000);
  return { provider, apiKey, model: env('AI_MODEL')?.trim() || DEFAULT_MODEL[provider], timeoutMs };
}

export async function complete(
  cfg: ProviderConfig, system: string, messages: Msg[],
  opts: { json?: boolean; maxTokens?: number } = {},
): Promise<string> {
  const maxTokens = opts.maxTokens ?? 600;
  try {
    const res = cfg.provider === 'gemini'
      ? await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.apiKey },
        signal: AbortSignal.timeout(cfg.timeoutMs),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
          generationConfig: {
            temperature: 0.2, maxOutputTokens: maxTokens,
            ...(opts.json ? { responseMimeType: 'application/json' } : {}),
          },
        }),
      })
      : await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
        signal: AbortSignal.timeout(cfg.timeoutMs),
        body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens, temperature: 0.2, system, messages }),
      });
    if (!res.ok) { await res.body?.cancel(); throw new ProviderError(`http_${res.status}`); }
    const data = await res.json();
    const text: unknown = cfg.provider === 'gemini'
      ? data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('')
      : data?.content?.filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('');
    if (typeof text !== 'string' || !text.trim()) throw new ProviderError('empty_response');
    return text;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError(e instanceof DOMException && e.name === 'TimeoutError' ? 'timeout' : 'network');
  }
}
