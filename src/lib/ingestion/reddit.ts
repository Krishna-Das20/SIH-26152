import { SocialPost } from '@/types/intelligence';
import { analyzeSentimentAndEmotion } from '@/lib/nlp/emotionEngine';
import { inferDemographics } from '@/lib/nlp/demographicProfiler';
import {
  Connector,
  ConnectorResult,
  hasEnv,
  statusFromHttp,
  truncate,
  extractHashtags,
  extractMentions,
} from './types';

/**
 * Reddit ingestion — Component A, "Appreciable Addition" tier.
 *
 * The old public JSON gateway (www.reddit.com/r/<sub>/hot.json with any
 * User-Agent) NO LONGER WORKS: it returns 403, and old.reddit.com redirects to
 * a login page. Verified 2026-08-25. Reddit closed unauthenticated access.
 *
 * The working route is OAuth2. Registering a "script" app is free and takes
 * about two minutes, and the client-credentials flow needs no user account to
 * be linked. The connector tries OAuth first and falls back to the public
 * gateway only in case it works from some networks.
 */

const OAUTH_BASE = 'https://oauth.reddit.com';
const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const USER_AGENT = process.env.REDDIT_USER_AGENT || 'SIH26152-AudienceIntelligence/1.0';

interface RedditChild {
  kind: string;
  data: {
    id: string;
    title?: string;
    selftext?: string;
    body?: string;
    author: string;
    subreddit: string;
    score: number;
    num_comments?: number;
    created_utc: number;
    permalink?: string;
    link_flair_text?: string;
    parent_id?: string;
    distinguished?: string;
    over_18?: boolean;
  };
}

// Access tokens last ~24h; cache on globalThis so warm serverless invocations
// reuse one instead of minting a token per request (which quickly rate-limits).
declare global {
  // eslint-disable-next-line no-var
  var _redditToken: { token: string; expiresAt: number } | undefined;
}

async function getAccessToken(): Promise<string | null> {
  if (!hasEnv(['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET'])) return null;

  const cached = global._redditToken;
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;

  const basic = Buffer.from(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
  ).toString('base64');

  // client_credentials suits a read-only monitoring app: no user context, no
  // refresh dance, and it works for any public subreddit.
  const body = new URLSearchParams({ grant_type: 'client_credentials' });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body,
    cache: 'no-store',
  });

  if (!res.ok) {
    console.warn(`Reddit token request failed: ${res.status} ${await res.text().catch(() => '')}`);
    return null;
  }

  const json = await res.json();
  if (!json.access_token) return null;

  global._redditToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

function toPost(child: RedditChild, subreddit: string, prefix: string): SocialPost | null {
  const d = child.data;
  const text = `${d.title || ''} ${d.selftext || d.body || ''}`.trim();
  if (!text) return null;

  const sentiment = analyzeSentimentAndEmotion(text);
  const demo = inferDemographics('', text);

  // Reddit t1_ ids are comments; their parent_id gives a real reply edge.
  const isComment = child.kind === 't1';
  const parent = d.parent_id && d.parent_id.startsWith('t1_') ? d.parent_id.slice(3) : undefined;

  return {
    id: `reddit_${prefix}_${d.id}`,
    platform: 'reddit',
    author: {
      id: `usr_rd_${d.author}`,
      username: d.author,
      displayName: `u/${d.author}`,
      platform: 'reddit',
      // Reddit exposes no follower count. Never synthesise one — it feeds the
      // KOL influence ranking.
      followerCount: null,
      verified: d.distinguished === 'moderator',
      estimatedAgeBracket: demo.estimatedAgeBracket,
      inferredLocation: demo.inferredLocation,
      detectedLanguage: demo.detectedLanguage,
      interests: demo.interests,
    },
    content: truncate(text),
    timestamp: new Date(d.created_utc * 1000).toISOString(),
    url: d.permalink ? `https://reddit.com${d.permalink}` : undefined,
    likes: d.score,
    // Reddit has no share metric. Zero is truthful; `score * 0.15` was not.
    shares: 0,
    replies: d.num_comments ?? 0,
    inReplyToPostId: parent ? `reddit_${prefix}_${parent}` : undefined,
    hashtags: extractHashtags(text).length
      ? extractHashtags(text)
      : [`#r_${d.subreddit || subreddit}`],
    mentionedUsernames: extractMentions(text),
    sentiment,
  };
}

async function fetchViaOAuth(
  token: string,
  target: string,
  limit: number
): Promise<{ code: number; children: RedditChild[] }> {
  const isQuery = target.includes(' ') || target.startsWith('?');
  const url = isQuery
    ? `${OAUTH_BASE}/search?q=${encodeURIComponent(target)}&limit=${limit}&sort=new&type=link`
    : `${OAUTH_BASE}/r/${encodeURIComponent(target)}/hot?limit=${limit}&raw_json=1`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': USER_AGENT },
    cache: 'no-store',
  });
  if (!res.ok) return { code: res.status, children: [] };

  const json = await res.json();
  return { code: 200, children: json?.data?.children ?? [] };
}

/** Legacy public gateway. Kept because it still works from some networks. */
async function fetchViaPublicJson(
  target: string,
  limit: number
): Promise<{ code: number; children: RedditChild[] }> {
  const res = await fetch(`https://www.reddit.com/r/${encodeURIComponent(target)}/hot.json?limit=${limit}&raw_json=1`, {
    headers: { 'User-Agent': USER_AGENT },
    next: { revalidate: 60 },
  });
  if (!res.ok) return { code: res.status, children: [] };
  const json = await res.json();
  return { code: 200, children: json?.data?.children ?? [] };
}

function normaliseTarget(input: string | undefined): string {
  if (!input) return 'india';
  const m = input.match(/r\/([A-Za-z0-9_]+)/);
  if (m) return m[1];
  return input.replace(/^https?:\/\/(www\.)?reddit\.com\//i, '').replace(/^r\//, '').split('/')[0] || 'india';
}

export const redditConnector: Connector = {
  platform: 'reddit',
  displayName: 'Reddit',
  tier: 'appreciable',
  requiredEnv: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET'],
  worksWithoutCredentials: false,
  cost: 'free',
  targetHint: 'r/subreddit, a reddit.com URL, or a search phrase',
  setupDoc: 'docs/platform-setup.md#reddit',
  notes:
    'The unauthenticated JSON gateway now returns 403 (verified 2026-08-25). ' +
    'A free "script" app provides OAuth credentials in about two minutes.',

  async fetch(target, limit = 25): Promise<ConnectorResult> {
    const subreddit = normaliseTarget(target);
    const capped = Math.min(Math.max(limit, 1), 100);

    try {
      const credentialsPresent = hasEnv(['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET']);
      const token = await getAccessToken();

      // Credentials were supplied but Reddit refused them: that is an auth
      // failure to fix, not a missing-configuration message to ignore.
      if (credentialsPresent && !token) {
        return {
          platform: 'reddit',
          posts: [],
          status: 'unauthorized',
          note:
            'Reddit rejected REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET. Check the app is ' +
            'type "script" and that the id is the string under the app name (not the name).',
        };
      }

      if (token) {
        const { code, children } = await fetchViaOAuth(token, subreddit, capped);
        if (code === 200) {
          const posts = children
            .map((c) => toPost(c, subreddit, 'oauth'))
            .filter((p): p is SocialPost => p !== null);
          return { platform: 'reddit', posts, status: 'ok', source: 'oauth-api' };
        }
        return {
          platform: 'reddit',
          posts: [],
          status: statusFromHttp(code),
          note: `Reddit OAuth API returned ${code} for r/${subreddit}.`,
        };
      }

      // No credentials — try the legacy gateway before giving up. Its failure
      // must not surface as a generic 'error': with no credentials configured,
      // "missing-credentials" is the correct and actionable answer whether the
      // gateway 403s, times out, or the network drops.
      const { code, children } = await fetchViaPublicJson(subreddit, capped).catch(() => ({
        code: 0,
        children: [] as RedditChild[],
      }));
      if (code === 200 && children.length > 0) {
        const posts = children
          .map((c) => toPost(c, subreddit, 'public'))
          .filter((p): p is SocialPost => p !== null);
        return { platform: 'reddit', posts, status: 'ok', source: 'public-json-legacy' };
      }

      return {
        platform: 'reddit',
        posts: [],
        status: 'missing-credentials',
        note:
          `Reddit's public JSON gateway is unavailable${code ? ` (HTTP ${code})` : ''} — it now requires ` +
          'authentication. Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET (free, ' +
          '~2 minutes) — see docs/platform-setup.md#reddit',
      };
    } catch (err) {
      return { platform: 'reddit', posts: [], status: 'error', note: String(err) };
    }
  },
};

/** Backwards-compatible helper used by the ingest route. */
export async function fetchLiveRedditPosts(
  subreddit: string = 'india',
  limit: number = 15
): Promise<SocialPost[]> {
  const result = await redditConnector.fetch(subreddit, limit);
  if (result.status !== 'ok') console.warn(`Reddit: ${result.status} — ${result.note}`);
  return result.posts;
}
