import { SocialPost, PlatformType } from '@/types/intelligence';

/**
 * Shared contract for every platform connector (Component A).
 *
 * Every connector reports honestly why it produced no data. An empty result
 * with `status: 'ok'` means the target genuinely had no posts; a missing
 * credential, an expired token, and a rate limit are all distinguishable, so
 * the dashboard never shows "no activity" when it actually means "not
 * configured".
 */

export type ConnectorStatus =
  | 'ok'
  | 'missing-credentials'
  | 'unauthorized'
  | 'rate-limited'
  | 'not-found'
  | 'blocked'
  | 'error';

/** Platform tiers exactly as ranked in the SIH26152 problem statement. */
export type PlatformTier = 'essential' | 'desirable' | 'appreciable';

export interface ConnectorResult {
  platform: PlatformType;
  posts: SocialPost[];
  status: ConnectorStatus;
  /** Which API path served the data, e.g. 'oauth-api' or 'web-preview'. */
  source?: string;
  /** Human-readable explanation, shown in the UI when status is not 'ok'. */
  note?: string;
}

export interface PlatformCapability {
  platform: PlatformType;
  displayName: string;
  tier: PlatformTier;
  /** Environment variables this connector needs to operate. */
  requiredEnv: string[];
  /** Which required vars are actually present. */
  configured: boolean;
  /** True when the connector needs no credentials at all. */
  worksWithoutCredentials: boolean;
  /** Whether obtaining credentials costs money. */
  cost: 'free' | 'paid' | 'none';
  /** What a target string means for this platform. */
  targetHint: string;
  setupDoc: string;
  notes?: string;
}

export interface Connector {
  platform: PlatformType;
  displayName: string;
  tier: PlatformTier;
  requiredEnv: string[];
  worksWithoutCredentials: boolean;
  cost: 'free' | 'paid' | 'none';
  targetHint: string;
  setupDoc: string;
  notes?: string;
  /** Fetch recent posts for `target` (a handle, channel, subreddit, or query). */
  fetch(target: string | undefined, limit: number): Promise<ConnectorResult>;
}

/** True when every named env var is present and non-empty. */
export function hasEnv(names: string[]): boolean {
  return names.every((n) => {
    const v = process.env[n];
    return typeof v === 'string' && v.trim().length > 0;
  });
}

/** Which of the named env vars are missing, for precise error messages. */
export function missingEnv(names: string[]): string[] {
  return names.filter((n) => {
    const v = process.env[n];
    return !v || v.trim().length === 0;
  });
}

/** Standard "not configured" result so every connector reports it the same way. */
export function missingCredentials(
  platform: PlatformType,
  names: string[],
  setupDoc: string
): ConnectorResult {
  const missing = missingEnv(names);
  return {
    platform,
    posts: [],
    status: 'missing-credentials',
    note: `Not configured. Set ${missing.join(', ')} in .env — see ${setupDoc}`,
  };
}

/** Maps an HTTP status onto a connector status, for consistent reporting. */
export function statusFromHttp(code: number): ConnectorStatus {
  if (code === 401 || code === 403) return 'unauthorized';
  if (code === 429) return 'rate-limited';
  if (code === 404) return 'not-found';
  return 'error';
}

/** Clamp post text to a sane length for storage and model input. */
export function truncate(text: string, max = 400): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

/**
 * Returns `u` only if it parses as an http(s) URL, otherwise null.
 *
 * Use this on ANY url a connector lifts out of fetched content (an og:url meta
 * tag, an embedded link, a redirect target) before putting it on a SocialPost.
 * Those values reach `href` attributes in the dashboard, and React renders a
 * `javascript:` href as-is -- so an unchecked one is stored XSS against every
 * viewer, not just the person who ingested it.
 *
 * A `startsWith('http')` test is not sufficient: `httpfoo:` passes it.
 */
export function safeHttpUrl(u?: string | null): string | null {
  if (!u) return null;
  try {
    const { protocol } = new URL(u);
    return protocol === 'https:' || protocol === 'http:' ? u : null;
  } catch {
    return null;
  }
}

export function extractHashtags(text: string): string[] {
  return Array.from(new Set(text.match(/#[\p{L}0-9_]+/gu) || []));
}

export function extractMentions(text: string): string[] {
  return Array.from(new Set((text.match(/@[a-zA-Z0-9_.]{2,}/g) || []).map((m) => m.slice(1))));
}
