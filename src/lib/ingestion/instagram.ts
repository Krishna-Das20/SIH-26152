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

function findCommentEdges(obj: any): any[] {
  if (!obj || typeof obj !== 'object') return [];
  const found: any[] = [];

  if (obj.comments_connection?.edges && Array.isArray(obj.comments_connection.edges)) {
    found.push(...obj.comments_connection.edges);
  }
  if (obj.edge_media_to_parent_comment?.edges && Array.isArray(obj.edge_media_to_parent_comment.edges)) {
    found.push(...obj.edge_media_to_parent_comment.edges);
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      found.push(...findCommentEdges(item));
    }
  } else {
    for (const k of Object.keys(obj)) {
      if (typeof obj[k] === 'object' && obj[k] !== null) {
        found.push(...findCommentEdges(obj[k]));
      }
    }
  }
  return found;
}

export async function fetchInstagramRichData(url: string): Promise<SocialPost[]> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      cache: 'no-store',
    });

    if (!res.ok) return [];

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

    const mainPost: SocialPost = {
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
      url: urlMatch ? urlMatch[1] : url,
      likes,
      shares: 0,
      replies: commentsCount,
      hashtags: extractHashtags(caption).length ? extractHashtags(caption) : ['#instagram'],
      mentionedUsernames: extractMentions(caption),
      sentiment,
    };

    // Extract real embedded comments from JSON scripts
    const jsonScripts = [...html.matchAll(/<script type="application\/json"[^>]*>(.*?)<\/script>/gs)];
    let allEdges: any[] = [];
    for (const s of jsonScripts) {
      try {
        const data = JSON.parse(s[1]);
        const edges = findCommentEdges(data);
        if (edges.length > 0) {
          allEdges.push(...edges);
        }
      } catch {}
    }

    // Deduplicate comments by node id/pk
    const seenIds = new Set<string>();
    const commentPosts: SocialPost[] = [];

    for (const edge of allEdges) {
      const node = edge?.node;
      const commentId = node?.id || node?.pk;
      const text = (node?.text || '').trim();

      if (!commentId || !text || seenIds.has(commentId)) continue;
      seenIds.add(commentId);

      const commenterUsername = node.user?.username || `ig_user_${commentId.slice(-6)}`;
      const commenterDisplay = node.user?.full_name || commenterUsername;
      const commentSentiment = analyzeSentimentAndEmotion(text);
      const commentDemo = inferDemographics('', text);
      const createdAt = node.created_at
        ? new Date(node.created_at * 1000).toISOString()
        : new Date().toISOString();

      commentPosts.push({
        id: `ig_c_${commentId}`,
        platform: 'instagram',
        author: {
          id: `usr_ig_${commenterUsername}`,
          username: commenterUsername,
          displayName: commenterDisplay,
          platform: 'instagram',
          followerCount: null,
          verified: Boolean(node.user?.is_verified),
          estimatedAgeBracket: commentDemo.estimatedAgeBracket,
          inferredLocation: commentDemo.inferredLocation,
          detectedLanguage: commentDemo.detectedLanguage,
          interests: commentDemo.interests,
        },
        content: truncate(text),
        timestamp: createdAt,
        url: urlMatch ? urlMatch[1] : url,
        likes: node.comment_like_count || 0,
        shares: 0,
        replies: node.child_comment_count || 0,
        inReplyToPostId: mainPost.id,
        inReplyToAuthorId: mainPost.author.id,
        hashtags: extractHashtags(text).length ? extractHashtags(text) : ['#comment'],
        mentionedUsernames: extractMentions(text),
        sentiment: commentSentiment,
      });
    }

    // Return the main post followed by all extracted comments
    return [mainPost, ...commentPosts];
  } catch (err) {
    console.error('Failed to extract Instagram rich data:', err);
    return [];
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
    'Supports direct public Reel/Post web preview URLs with rich comment extraction without credentials. ' +
    'Hashtag search and own-account media require an Instagram Business/Creator account.',

  async fetch(target, limit = 25): Promise<ConnectorResult> {
    const input = (target || '').trim();

    // 1. If target is a direct Instagram Reel or Post URL, use rich web extractor
    if (input.startsWith('http') || input.includes('instagram.com/')) {
      const posts = await fetchInstagramRichData(input);
      if (posts.length > 0) {
        return {
          platform: 'instagram',
          posts,
          status: 'ok',
          source: 'web-rich-preview',
        };
      }
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
