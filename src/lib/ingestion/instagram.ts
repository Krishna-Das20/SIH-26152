import { SocialPost } from '@/types/intelligence';
import { analyzeSentimentAndEmotion } from '@/lib/nlp/emotionEngine';
import { inferDemographics } from '@/lib/nlp/demographicProfiler';
import {
  Connector,
  ConnectorResult,
  hasEnv,
  missingCredentials,
  statusFromHttp,
  ConnectorStatus,
  truncate,
  extractHashtags,
  extractMentions,
} from './types';

/**
 * Instagram ingestion — Component A, "Desirable" tier.
 *
 * Instagram has no open route. Verified 2026-08-25:
 *   - `instagram.com/<user>/?__a=1&__d=dis` no longer returns profile JSON
 *   - `api/v1/users/web_profile_info` answers 429 to unauthenticated callers
 *   - the Basic Display API was retired in December 2024
 *
 * The supported route is the **Instagram Graph API**, which requires an
 * Instagram *Business or Creator* account linked to a Facebook Page, plus a
 * long-lived access token. That is free but involves account setup.
 *
 * Two capabilities are implemented:
 *
 *   1. OWN-ACCOUNT INSIGHTS — media and comments on the connected account.
 *      This is first-party audience data, which is exactly what "understand
 *      how your followers feel" in the problem statement describes.
 *
 *   2. HASHTAG SEARCH — public media carrying a given hashtag, via the
 *      /ig_hashtag_search endpoint. This is the only sanctioned way to observe
 *      public Instagram content you do not own. Note Meta's limit of 30 unique
 *      hashtags per 7-day rolling window per account.
 */

/**
 * Meta's Graph API returns HTTP 400 (not 401) for an invalid or expired token,
 * so the HTTP status alone misreports auth failures as generic errors. The
 * OAuthException type and error code 190 are the reliable signal.
 */
function metaStatus(code: number, json: any): ConnectorStatus {
  const err = json?.error;
  if (err?.type === 'OAuthException' || err?.code === 190 || err?.code === 102 || err?.code === 200) {
    return 'unauthorized';
  }
  if (err?.code === 4 || err?.code === 17 || err?.code === 32 || err?.code === 613) {
    return 'rate-limited';
  }
  return statusFromHttp(code);
}

const GRAPH = 'https://graph.facebook.com/v21.0';

interface IgComment {
  id: string;
  text?: string;
  timestamp?: string;
  like_count?: number;
  username?: string;
  replies?: { data: IgComment[] };
}

interface IgMedia {
  id: string;
  caption?: string;
  media_type?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  username?: string;
  comments?: { data: IgComment[] };
}

function mediaToPost(m: IgMedia, ownerHandle: string, followers: number | null): SocialPost {
  const text = m.caption || '';
  const sentiment = analyzeSentimentAndEmotion(text);
  const demo = inferDemographics('', text);

  return {
    id: `ig_${m.id}`,
    platform: 'instagram',
    author: {
      id: `usr_ig_${m.username || ownerHandle}`,
      username: m.username || ownerHandle,
      displayName: m.username || ownerHandle,
      platform: 'instagram',
      followerCount: followers,
      verified: false,
      estimatedAgeBracket: demo.estimatedAgeBracket,
      inferredLocation: demo.inferredLocation,
      detectedLanguage: demo.detectedLanguage,
      interests: demo.interests,
    },
    content: truncate(text),
    timestamp: m.timestamp ? new Date(m.timestamp).toISOString() : new Date().toISOString(),
    url: m.permalink,
    likes: m.like_count ?? 0,
    // Instagram exposes no share count on media; zero is truthful.
    shares: 0,
    replies: m.comments_count ?? 0,
    hashtags: extractHashtags(text).length ? extractHashtags(text) : ['#instagram'],
    mentionedUsernames: extractMentions(text),
    sentiment,
  };
}

function commentToPost(c: IgComment, media: IgMedia, ownerHandle: string): SocialPost | null {
  const text = c.text || '';
  if (!text) return null;

  const sentiment = analyzeSentimentAndEmotion(text);
  const demo = inferDemographics('', text);

  // Instagram does NOT return `username` on comments without additional
  // permissions -- verified 2026-08-26, the API returns only
  // [id, text, timestamp, like_count]. Falling back to one shared placeholder
  // collapsed every commenter into a SINGLE graph node, which silently
  // understated the audience as one person.
  //
  // Each anonymous commenter therefore gets an id derived from the comment id.
  // That cannot merge two comments by the same person -- so distinct-author
  // counts are an UPPER bound -- but it preserves the genuine reply edge to the
  // media owner, which is real interaction data. Overstating distinctness is
  // the safer error here than fabricating a single shared identity.
  const anonymous = !c.username;
  const username = c.username || `ig_anon_${c.id.slice(-8)}`;

  return {
    id: `ig_c_${c.id}`,
    platform: 'instagram',
    author: {
      id: `usr_ig_${username}`,
      username,
      displayName: anonymous ? 'Instagram commenter (identity withheld)' : username,
      platform: 'instagram',
      // A commenter's follower count is not returned by the API.
      followerCount: null,
      verified: false,
      estimatedAgeBracket: demo.estimatedAgeBracket,
      inferredLocation: demo.inferredLocation,
      detectedLanguage: demo.detectedLanguage,
      interests: demo.interests,
    },
    content: truncate(text),
    timestamp: c.timestamp ? new Date(c.timestamp).toISOString() : new Date().toISOString(),
    url: media.permalink,
    likes: c.like_count ?? 0,
    shares: 0,
    replies: c.replies?.data?.length ?? 0,
    // A comment is a genuine reply edge to the media owner.
    inReplyToPostId: `ig_${media.id}`,
    inReplyToAuthorId: `usr_ig_${media.username || ownerHandle}`,
    hashtags: extractHashtags(text).length ? extractHashtags(text) : ['#instagram_comment'],
    mentionedUsernames: extractMentions(text),
    sentiment,
  };
}

async function graphGet(path: string): Promise<{ ok: boolean; code: number; json?: any; error?: string }> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN!;
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${GRAPH}${path}${sep}access_token=${encodeURIComponent(token)}`, {
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, code: res.status, json, error: json?.error?.message || `HTTP ${res.status}` };
  }
  return { ok: true, code: res.status, json };
}

export const instagramConnector: Connector = {
  platform: 'instagram',
  displayName: 'Instagram',
  tier: 'desirable',
  requiredEnv: ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_BUSINESS_ID'],
  worksWithoutCredentials: false,
  cost: 'free',
  targetHint: 'a #hashtag to search, or leave blank for the connected account',
  setupDoc: 'docs/platform-setup.md#instagram',
  notes:
    'Needs an Instagram Business/Creator account linked to a Facebook Page. ' +
    'Free, but account setup is required. Hashtag search is capped at 30 unique ' +
    'hashtags per rolling 7 days.',

  async fetch(target, limit = 25): Promise<ConnectorResult> {
    const required = ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_BUSINESS_ID'];
    if (!hasEnv(required)) {
      return missingCredentials('instagram', required, 'docs/platform-setup.md#instagram');
    }

    const igId = process.env.INSTAGRAM_BUSINESS_ID!;
    const capped = Math.min(Math.max(limit, 1), 50);
    const input = (target || '').trim();

    try {
      // ── Hashtag search over public media ──────────────────────────────
      if (input.startsWith('#')) {
        const tag = input.slice(1);
        const search = await graphGet(`/ig_hashtag_search?user_id=${igId}&q=${encodeURIComponent(tag)}`);
        if (!search.ok) {
          return {
            platform: 'instagram',
            posts: [],
            status: metaStatus(search.code, search.json),
            note: `Instagram hashtag search failed: ${search.error}`,
          };
        }

        const hashtagId = search.json?.data?.[0]?.id;
        if (!hashtagId) {
          return { platform: 'instagram', posts: [], status: 'not-found', note: `No Instagram hashtag "${input}".` };
        }

        const media = await graphGet(
          `/${hashtagId}/recent_media?user_id=${igId}` +
            `&fields=id,caption,media_type,permalink,timestamp,like_count,comments_count,username&limit=${capped}`
        );
        if (!media.ok) {
          return {
            platform: 'instagram',
            posts: [],
            status: metaStatus(media.code, media.json),
            note: `Instagram recent_media failed: ${media.error}`,
          };
        }

        const items: IgMedia[] = media.json?.data ?? [];
        return {
          platform: 'instagram',
          posts: items.map((m) => mediaToPost(m, tag, null)),
          status: 'ok',
          source: 'graph-hashtag-search',
        };
      }

      // ── Own-account media plus its comments ───────────────────────────
      const profile = await graphGet(`/${igId}?fields=username,followers_count`);
      const ownerHandle = profile.json?.username || 'account';
      const followers = typeof profile.json?.followers_count === 'number' ? profile.json.followers_count : null;

      const media = await graphGet(
        `/${igId}/media?fields=id,caption,media_type,permalink,timestamp,like_count,` +
          `comments_count,username,comments{id,text,timestamp,like_count,username}&limit=${capped}`
      );
      if (!media.ok) {
        return {
          platform: 'instagram',
          posts: [],
          status: metaStatus(media.code, media.json),
          note:
            media.code === 400 || media.code === 401
              ? `Instagram rejected the token: ${media.error}. Long-lived tokens expire after 60 days.`
              : `Instagram media fetch failed: ${media.error}`,
        };
      }

      const items: IgMedia[] = media.json?.data ?? [];
      const posts: SocialPost[] = [];

      for (const m of items) {
        posts.push(mediaToPost(m, ownerHandle, followers));
        // Comments are the audience voice — the actual subject of Component B.
        for (const c of m.comments?.data ?? []) {
          const cp = commentToPost(c, m, ownerHandle);
          if (cp) posts.push(cp);
        }
      }

      return { platform: 'instagram', posts, status: 'ok', source: 'graph-own-account' };
    } catch (err) {
      return { platform: 'instagram', posts: [], status: 'error', note: String(err) };
    }
  },
};
