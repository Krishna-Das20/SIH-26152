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
 * Facebook ingestion — Component A, "Desirable" tier.
 *
 * Facebook's Graph API returns `(#200) Provide valid app ID` to anonymous
 * callers (verified 2026-08-25); there is no public route at all.
 *
 * What is actually reachable depends on the token:
 *
 *   - A PAGE ACCESS TOKEN reads posts, comments and reactions on Pages the
 *     token's user administers. Free, no app review. This is the route the
 *     connector targets.
 *
 *   - Reading arbitrary third-party Pages requires the "Page Public Content
 *     Access" permission, which needs Meta App Review and a business
 *     verification. That is a weeks-long process, not a code change.
 *
 * So this connector reads Pages you control. That still satisfies the problem
 * statement's intent — understanding *your* audience — and it is the honest
 * limit of what Meta grants without review.
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

interface FbComment {
  id: string;
  message?: string;
  created_time?: string;
  like_count?: number;
  comment_count?: number;
  from?: { id: string; name: string };
  parent?: { id: string };
}

interface FbPost {
  id: string;
  message?: string;
  story?: string;
  created_time?: string;
  permalink_url?: string;
  shares?: { count: number };
  reactions?: { summary?: { total_count: number } };
  comments?: { data: FbComment[]; summary?: { total_count: number } };
  from?: { id: string; name: string };
}

async function graphGet(path: string, token: string): Promise<{ ok: boolean; code: number; json?: any; error?: string }> {
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

function postToSocialPost(p: FbPost, pageName: string, pageFans: number | null): SocialPost | null {
  const text = p.message || p.story || '';
  if (!text) return null;

  const sentiment = analyzeSentimentAndEmotion(text);
  const demo = inferDemographics('', text);
  const authorName = p.from?.name || pageName;

  return {
    id: `fb_${p.id}`,
    platform: 'facebook',
    author: {
      id: `usr_fb_${p.from?.id || pageName}`,
      username: authorName.replace(/\s+/g, '_').toLowerCase(),
      displayName: authorName,
      platform: 'facebook',
      followerCount: pageFans,
      verified: false,
      estimatedAgeBracket: demo.estimatedAgeBracket,
      inferredLocation: demo.inferredLocation,
      detectedLanguage: demo.detectedLanguage,
      interests: demo.interests,
    },
    content: truncate(text),
    timestamp: p.created_time ? new Date(p.created_time).toISOString() : new Date().toISOString(),
    url: p.permalink_url,
    likes: p.reactions?.summary?.total_count ?? 0,
    // Facebook does report real share counts.
    shares: p.shares?.count ?? 0,
    replies: p.comments?.summary?.total_count ?? p.comments?.data?.length ?? 0,
    hashtags: extractHashtags(text).length ? extractHashtags(text) : ['#facebook'],
    mentionedUsernames: extractMentions(text),
    sentiment,
  };
}

function commentToSocialPost(c: FbComment, parentPost: FbPost, pageName: string): SocialPost | null {
  const text = c.message || '';
  if (!text) return null;

  const sentiment = analyzeSentimentAndEmotion(text);
  const demo = inferDemographics('', text);
  const authorName = c.from?.name || 'Facebook user';

  return {
    id: `fb_c_${c.id}`,
    platform: 'facebook',
    author: {
      id: `usr_fb_${c.from?.id || authorName}`,
      username: authorName.replace(/\s+/g, '_').toLowerCase(),
      displayName: authorName,
      platform: 'facebook',
      followerCount: null, // not exposed for commenters
      verified: false,
      estimatedAgeBracket: demo.estimatedAgeBracket,
      inferredLocation: demo.inferredLocation,
      detectedLanguage: demo.detectedLanguage,
      interests: demo.interests,
    },
    content: truncate(text),
    timestamp: c.created_time ? new Date(c.created_time).toISOString() : new Date().toISOString(),
    url: parentPost.permalink_url,
    likes: c.like_count ?? 0,
    shares: 0,
    replies: c.comment_count ?? 0,
    // Real reply edges: comment -> post author, or comment -> parent comment.
    inReplyToPostId: c.parent?.id ? `fb_c_${c.parent.id}` : `fb_${parentPost.id}`,
    inReplyToAuthorId: `usr_fb_${parentPost.from?.id || pageName}`,
    hashtags: extractHashtags(text).length ? extractHashtags(text) : ['#facebook_comment'],
    mentionedUsernames: extractMentions(text),
    sentiment,
  };
}

export const facebookConnector: Connector = {
  platform: 'facebook',
  displayName: 'Facebook (Meta)',
  tier: 'desirable',
  requiredEnv: ['FACEBOOK_PAGE_ACCESS_TOKEN', 'FACEBOOK_PAGE_ID'],
  worksWithoutCredentials: false,
  cost: 'free',
  targetHint: 'a Page id you administer, or leave blank for FACEBOOK_PAGE_ID',
  setupDoc: 'docs/platform-setup.md#facebook',
  notes:
    'Reads Pages the token administers. Reading arbitrary third-party Pages needs ' +
    'Page Public Content Access, which requires Meta App Review and business verification.',

  async fetch(target, limit = 25): Promise<ConnectorResult> {
    const required = ['FACEBOOK_PAGE_ACCESS_TOKEN', 'FACEBOOK_PAGE_ID'];
    if (!hasEnv(required)) {
      return missingCredentials('facebook', required, 'docs/platform-setup.md#facebook');
    }

    const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN!;
    const pageId = (target || '').trim() || process.env.FACEBOOK_PAGE_ID!;
    const capped = Math.min(Math.max(limit, 1), 50);

    try {
      const page = await graphGet(`/${encodeURIComponent(pageId)}?fields=name,fan_count`, token);
      if (!page.ok) {
        return {
          platform: 'facebook',
          posts: [],
          status: metaStatus(page.code, page.json),
          note:
            page.code === 400
              ? `Facebook rejected the request: ${page.error}. If this Page is not one you ` +
                'administer, reading it requires Page Public Content Access (App Review).'
              : `Facebook page lookup failed: ${page.error}`,
        };
      }

      const pageName: string = page.json?.name || pageId;
      const pageFans: number | null =
        typeof page.json?.fan_count === 'number' ? page.json.fan_count : null;

      const feed = await graphGet(
        `/${encodeURIComponent(pageId)}/posts?fields=id,message,story,created_time,permalink_url,` +
          `shares,from,reactions.summary(true).limit(0),` +
          `comments.summary(true).limit(25){id,message,created_time,like_count,comment_count,from,parent}` +
          `&limit=${capped}`,
        token
      );
      if (!feed.ok) {
        return {
          platform: 'facebook',
          posts: [],
          status: metaStatus(feed.code, feed.json),
          note: `Facebook feed fetch failed: ${feed.error}`,
        };
      }

      const items: FbPost[] = feed.json?.data ?? [];
      const posts: SocialPost[] = [];

      for (const p of items) {
        const sp = postToSocialPost(p, pageName, pageFans);
        if (sp) posts.push(sp);
        for (const c of p.comments?.data ?? []) {
          const cp = commentToSocialPost(c, p, pageName);
          if (cp) posts.push(cp);
        }
      }

      return { platform: 'facebook', posts, status: 'ok', source: 'graph-page-feed' };
    } catch (err) {
      return { platform: 'facebook', posts: [], status: 'error', note: String(err) };
    }
  },
};
