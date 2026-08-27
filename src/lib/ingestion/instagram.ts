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
  safeHttpUrl,
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

/**
 * Accepts a target ONLY if it is an https URL on instagram.com.
 *
 * The web-preview path issues a server-side fetch, so whoever controls this
 * string controls the host, port and path of a request originating from
 * INSIDE our network. A prefix test like `startsWith('http')` is not a host
 * check: `http://169.254.169.254/latest/meta-data/` passes it, and the reply
 * comes back through the og:/description scrapers below. That is server-side
 * request forgery -- a scanner for internal services plus a read primitive
 * against any of them that serves HTML meta tags.
 *
 * The connector is called Instagram, so an allowlist costs nothing. Returning
 * null here makes fetch() fall through to the Graph API branch, which reports
 * an honest status rather than silently succeeding.
 */
function instagramPreviewUrl(input: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.toLowerCase();
  if (host !== 'instagram.com' && !host.endsWith('.instagram.com')) return null;
  return parsed.toString();
}

async function fetchInstagramWebPreview(rawUrl: string): Promise<SocialPost | null> {
  const url = instagramPreviewUrl(rawUrl);
  if (!url) return null;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      cache: 'no-store',
      // Without this an allowlisted instagram.com URL that 302s to an internal
      // host walks straight back into the hole the allowlist just closed.
      redirect: 'manual',
    });

    if (!res.ok) return null;

    const html = await res.text();

    const descMatch =
      html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) ||
      html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i);
    const titleMatch =
      html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i) ||
      html.match(/<meta\s+name="twitter:title"\s+content="([^"]*)"/i);
    const urlMatch = html.match(/<meta\s+property="og:url"\s+content="([^"]*)"/i);

    const rawDesc = descMatch ? descMatch[1] : '';
    const rawTitle = titleMatch ? titleMatch[1] : '';

    let likes = 0;
    let commentsCount = 0;
    let author = 'instagram_creator';
    let caption = '';

    const statsMatch = rawDesc.match(/([\d,]+)\s+likes?,\s+([\d,]+)\s+comments?\s+-\s+([^\s]+)\s+on\s+([^:]+):\s*(.*)/is);
    if (statsMatch) {
      likes = parseInt(statsMatch[1].replace(/,/g, ''), 10) || 0;
      commentsCount = parseInt(statsMatch[2].replace(/,/g, ''), 10) || 0;
      author = statsMatch[3] || author;
      caption = statsMatch[5]?.trim() || '';
    } else {
      caption = rawDesc || rawTitle;
    }

    caption = caption
      .replace(/&quot;/g, '"')
      .replace(/&#064;/g, '@')
      .replace(/&#x2022;/g, '•')
      .replace(/&#x2728;/g, '✨')
      .replace(/&#x1f525;/g, '🔥')
      .replace(/&#x1f4aa;/g, '💪')
      .replace(/&#x1f440;/g, '👀')
      .replace(/&amp;/g, '&')
      .replace(/^"|"$/g, '')
      .trim();

    const shortcodeMatch = url.match(/\/(?:reel|p|reels)\/([^\/?#]+)/i);
    const shortcode = shortcodeMatch ? shortcodeMatch[1] : `post_${Date.now()}`;

    const sentiment = analyzeSentimentAndEmotion(caption);
    const demo = inferDemographics('', caption);

    return {
      id: `ig_${shortcode}`,
      platform: 'instagram',
      author: {
        id: `usr_ig_${author}`,
        username: author,
        displayName: author,
        platform: 'instagram',
        followerCount: null,
        verified: false,
        estimatedAgeBracket: demo.estimatedAgeBracket,
        inferredLocation: demo.inferredLocation,
        detectedLanguage: demo.detectedLanguage,
        interests: demo.interests,
      },
      content: truncate(caption),
      timestamp: new Date().toISOString(),
      // og:url comes out of the FETCHED page, so it is only as trustworthy as
      // that page. It ends up in an href, and a `javascript:` value there is
      // executable script for every viewer. src/lib/urls.ts filters on read;
      // this keeps the bad value out of the store in the first place.
      url: safeHttpUrl(urlMatch?.[1]) || url,
      likes,
      shares: 0,
      replies: commentsCount,
      hashtags: extractHashtags(caption).length ? extractHashtags(caption) : ['#instagram'],
      mentionedUsernames: extractMentions(caption),
      sentiment,
    };
  } catch {
    return null;
  }
}

export const instagramConnector: Connector = {
  platform: 'instagram',
  displayName: 'Instagram',
  tier: 'desirable',
  requiredEnv: ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_BUSINESS_ID'],
  worksWithoutCredentials: true,
  cost: 'free',
  targetHint: 'an Instagram Reel/Post URL, #hashtag, or connected account',
  setupDoc: 'docs/platform-setup.md#instagram',
  notes:
    'Supports direct public Reel/Post web preview URLs without credentials. ' +
    'Hashtag search and own-account media require an Instagram Business/Creator account.',

  async fetch(target, limit = 25): Promise<ConnectorResult> {
    const input = (target || '').trim();

    // 1. A URL target is answered by the web preview or not at all.
    //
    // Falling through to the own-account branch below would answer "fetch me
    // THIS reel" with the connected account's OWN media and report status 'ok'
    // -- the exact substitution this connector's route docstring forbids, and
    // worse now that unusable URLs (including SSRF probes) are rejected up
    // front rather than attempted. An analyst pasting a link must never be
    // handed somebody else's posts labelled as the answer.
    if (/^https?:\/\//i.test(input)) {
      if (!instagramPreviewUrl(input)) {
        return {
          platform: 'instagram',
          posts: [],
          status: 'not-found',
          note:
            'Only https://instagram.com URLs can be read this way. ' +
            'Pass a Reel/Post URL, a #hashtag, or leave the target blank for the connected account.',
        };
      }

      const post = await fetchInstagramWebPreview(input);
      if (post) {
        return {
          platform: 'instagram',
          posts: [post],
          status: 'ok',
          source: 'web-preview',
        };
      }

      return {
        platform: 'instagram',
        posts: [],
        status: 'not-found',
        note: 'Instagram returned no readable preview for that URL.',
      };
    }

    // 2. Otherwise require Graph API credentials
    const required = ['INSTAGRAM_ACCESS_TOKEN', 'INSTAGRAM_BUSINESS_ID'];
    if (!hasEnv(required)) {
      return missingCredentials('instagram', required, 'docs/platform-setup.md#instagram');
    }

    const igId = process.env.INSTAGRAM_BUSINESS_ID!;
    const capped = Math.min(Math.max(limit, 1), 50);

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
