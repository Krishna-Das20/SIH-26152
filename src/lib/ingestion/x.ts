import { SocialPost } from '@/types/intelligence';
import { analyzeSentimentAndEmotion } from '@/lib/nlp/emotionEngine';
import { inferDemographics } from '@/lib/nlp/demographicProfiler';
import {
  Connector,
  ConnectorResult,
  hasEnv,
  missingCredentials,
  statusFromHttp,
  truncate,
  extractHashtags,
} from './types';

/**
 * X (Twitter) ingestion — Component A, ESSENTIAL platform.
 *
 * X API v2 is the only working route. Every unauthenticated path is closed:
 * `cdn.syndication.twimg.com/timeline/profile` now answers 200 with an empty
 * body, `syndication.twitter.com/srv/timeline-profile` answers 429, and the
 * v2 endpoints answer 401 without a bearer token. Verified 2026-08-25.
 *
 * This means X ingestion REQUIRES a paid API tier (Basic, ~$100/month at the
 * time of writing — the Free tier permits posting but not reading). That is a
 * procurement decision, not an engineering one. The connector below is
 * complete and correct; it starts returning data the moment
 * X_BEARER_TOKEN is set, and reports `missing-credentials` until then.
 *
 * Deliberately NOT done: fabricating X posts so the platform "looks"
 * implemented. A mocked Essential platform is worse than an honest gap.
 */

const API = 'https://api.twitter.com/2';

const TWEET_FIELDS = [
  'created_at',
  'public_metrics',
  'lang',
  'conversation_id',
  'in_reply_to_user_id',
  'referenced_tweets',
  'entities',
  'author_id',
].join(',');

const USER_FIELDS = ['username', 'name', 'public_metrics', 'verified', 'description', 'location'].join(',');

interface XUser {
  id: string;
  username: string;
  name: string;
  description?: string;
  location?: string;
  verified?: boolean;
  public_metrics?: { followers_count: number; following_count: number; tweet_count: number };
}

interface XTweet {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  lang?: string;
  conversation_id?: string;
  in_reply_to_user_id?: string;
  referenced_tweets?: { type: string; id: string }[];
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    impression_count?: number;
  };
  entities?: {
    hashtags?: { tag: string }[];
    mentions?: { username: string; id: string }[];
  };
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.X_BEARER_TOKEN}`,
    'User-Agent': 'SIH26152-AudienceIntelligence/1.0',
  };
}

function toPost(tweet: XTweet, users: Map<string, XUser>): SocialPost {
  const user = tweet.author_id ? users.get(tweet.author_id) : undefined;
  const text = tweet.text || '';
  const sentiment = analyzeSentimentAndEmotion(text);
  const demo = inferDemographics(user?.description || '', text, user?.location);

  const metrics = tweet.public_metrics;
  const repliedTo = tweet.referenced_tweets?.find((r) => r.type === 'replied_to');
  const quoted = tweet.referenced_tweets?.find((r) => r.type === 'quoted');

  return {
    id: `x_${tweet.id}`,
    platform: 'x',
    author: {
      id: `usr_x_${tweet.author_id || 'unknown'}`,
      username: user?.username || 'unknown',
      displayName: user?.name || user?.username || 'Unknown',
      bio: user?.description,
      platform: 'x',
      // X does report follower counts, so this is a real measurement.
      followerCount: user?.public_metrics?.followers_count ?? null,
      followingCount: user?.public_metrics?.following_count,
      verified: Boolean(user?.verified),
      estimatedAgeBracket: demo.estimatedAgeBracket,
      inferredLocation: demo.inferredLocation,
      detectedLanguage: demo.detectedLanguage,
      interests: demo.interests,
    },
    content: truncate(text),
    timestamp: tweet.created_at ? new Date(tweet.created_at).toISOString() : new Date().toISOString(),
    url: user ? `https://x.com/${user.username}/status/${tweet.id}` : `https://x.com/i/status/${tweet.id}`,
    likes: metrics?.like_count ?? 0,
    shares: (metrics?.retweet_count ?? 0) + (metrics?.quote_count ?? 0),
    replies: metrics?.reply_count ?? 0,
    views: metrics?.impression_count,
    inReplyToPostId: repliedTo ? `x_${repliedTo.id}` : quoted ? `x_${quoted.id}` : undefined,
    // Real reply edges — these become genuine graph links, not synthesised ones.
    inReplyToAuthorId: tweet.in_reply_to_user_id ? `usr_x_${tweet.in_reply_to_user_id}` : undefined,
    mentionedUsernames: tweet.entities?.mentions?.map((m) => m.username) ?? [],
    hashtags: tweet.entities?.hashtags?.length
      ? tweet.entities.hashtags.map((h) => `#${h.tag}`)
      : extractHashtags(text),
    sentiment,
  };
}

async function call(url: string): Promise<{ ok: boolean; code: number; json?: any; body?: string }> {
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
  if (!res.ok) {
    return { ok: false, code: res.status, body: await res.text().catch(() => '') };
  }
  return { ok: true, code: res.status, json: await res.json() };
}

/**
 * Resolves a @handle to a numeric user id.
 * Returns the HTTP code too, so a rejected token is reported as `unauthorized`
 * rather than being flattened into "no such account".
 */
async function lookupUser(handle: string): Promise<{ user: XUser | null; code: number }> {
  const clean = handle.replace(/^@/, '').split(/[/?]/)[0];
  const r = await call(`${API}/users/by/username/${encodeURIComponent(clean)}?user.fields=${USER_FIELDS}`);
  return { user: r.ok ? (r.json?.data ?? null) : null, code: r.code };
}

export const xConnector: Connector = {
  platform: 'x',
  displayName: 'X (Twitter)',
  tier: 'essential',
  requiredEnv: ['X_BEARER_TOKEN'],
  worksWithoutCredentials: false,
  cost: 'paid',
  targetHint: '@handle, a x.com/<handle> URL, or a search query',
  setupDoc: 'docs/platform-setup.md#x-twitter',
  notes:
    'Requires a paid X API tier (Basic ~$100/mo). All unauthenticated routes were ' +
    'verified closed on 2026-08-25: syndication returns an empty body, and v2 returns 401.',

  async fetch(target, limit = 25): Promise<ConnectorResult> {
    if (!hasEnv(['X_BEARER_TOKEN'])) {
      return missingCredentials('x', ['X_BEARER_TOKEN'], 'docs/platform-setup.md#x-twitter');
    }

    const max = Math.min(Math.max(limit, 10), 100); // v2 requires 10..100
    const input = (target || '').trim();

    try {
      const looksLikeHandle = /^@?[A-Za-z0-9_]{1,15}$/.test(input) || input.includes('x.com/') || input.includes('twitter.com/');

      let result: { ok: boolean; code: number; json?: any; body?: string };
      let source: string;

      if (input && looksLikeHandle) {
        // Timeline of a specific account.
        const handle = input.replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, '');
        const { user, code } = await lookupUser(handle);
        if (!user) {
          if (code === 401 || code === 403) {
            return {
              platform: 'x',
              posts: [],
              status: 'unauthorized',
              note:
                'X rejected the bearer token (HTTP ' + code + '). Confirm the token is valid ' +
                'and the project has Read access — the Free tier cannot read tweets.',
            };
          }
          return { platform: 'x', posts: [], status: 'not-found', note: `No X account found for "${input}".` };
        }
        result = await call(
          `${API}/users/${user.id}/tweets?max_results=${max}` +
            `&tweet.fields=${TWEET_FIELDS}&expansions=author_id&user.fields=${USER_FIELDS}`
        );
        source = 'api-v2-user-timeline';
      } else {
        // Recent-search over the last 7 days (Basic tier).
        const query = input || 'india';
        result = await call(
          `${API}/tweets/search/recent?query=${encodeURIComponent(`${query} -is:retweet`)}` +
            `&max_results=${max}&tweet.fields=${TWEET_FIELDS}&expansions=author_id&user.fields=${USER_FIELDS}`
        );
        source = 'api-v2-recent-search';
      }

      if (!result.ok) {
        const status = statusFromHttp(result.code);
        return {
          platform: 'x',
          posts: [],
          status,
          note:
            status === 'unauthorized'
              ? 'X rejected the bearer token (401/403). Confirm the token is valid and the ' +
                'project has Read access — the Free tier cannot read tweets.'
              : status === 'rate-limited'
              ? 'X rate limit reached. Basic tier allows 60 requests / 15 min.'
              : `X API error ${result.code}: ${(result.body || '').slice(0, 200)}`,
        };
      }

      const tweets: XTweet[] = result.json?.data ?? [];
      const users = new Map<string, XUser>(
        (result.json?.includes?.users ?? []).map((u: XUser) => [u.id, u])
      );

      return {
        platform: 'x',
        posts: tweets.map((t) => toPost(t, users)),
        status: 'ok',
        source,
      };
    } catch (err) {
      return { platform: 'x', posts: [], status: 'error', note: String(err) };
    }
  },
};
