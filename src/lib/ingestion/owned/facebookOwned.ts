import { SocialPost } from '@/types/intelligence';
import { analyzeSentimentAndEmotion } from '@/lib/nlp/emotionEngine';
import { inferDemographics } from '@/lib/nlp/demographicProfiler';
import { truncate, extractHashtags, extractMentions } from '../types';

/**
 * Reads the Pages a connected user administers: recent posts plus comments.
 *
 * A user token cannot read Page content directly — each Page carries its own
 * token, returned by /me/accounts. That indirection is why this fetcher makes
 * two rounds of calls rather than one, and it is the most common thing people
 * get wrong when integrating Facebook.
 */
const GRAPH = 'https://graph.facebook.com/v21.0';

async function get(path: string, token: string): Promise<any> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${GRAPH}${path}${sep}access_token=${encodeURIComponent(token)}`, {
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Facebook API ${res.status}: ${json?.error?.message || ''}`.slice(0, 180));
  }
  return json;
}

export async function facebookOwnPages(userToken: string, limit: number): Promise<SocialPost[]> {
  const capped = Math.min(Math.max(limit, 1), 50);

  const accounts = await get('/me/accounts?fields=id,name,access_token,fan_count', userToken);
  const pages = accounts?.data ?? [];
  if (pages.length === 0) return [];

  const posts: SocialPost[] = [];

  for (const page of pages) {
    // Each Page carries its own token; the user token will not work here.
    const pageToken: string = page.access_token;
    if (!pageToken) continue;

    const pageId: string = page.id;
    const pageName: string = page.name || pageId;
    const fans = typeof page.fan_count === 'number' ? page.fan_count : null;

    let feed: any;
    try {
      feed = await get(
        `/${pageId}/posts?fields=id,message,story,created_time,permalink_url,shares,from,` +
          'reactions.summary(true).limit(0),' +
          'comments.summary(true).limit(25){id,message,created_time,like_count,comment_count,from,parent}' +
          `&limit=${capped}`,
        pageToken
      );
    } catch (e) {
      // One inaccessible Page must not fail the others.
      console.warn(`Facebook page ${pageId} unreadable:`, e);
      continue;
    }

    for (const p of feed?.data ?? []) {
      const text: string = p.message || p.story || '';
      if (!text) continue;

      const demo = inferDemographics('', text);
      posts.push({
        id: `fb_${p.id}`,
        platform: 'facebook',
        author: {
          id: `usr_fb_${pageId}`,
          username: pageName.replace(/\s+/g, '_').toLowerCase(),
          displayName: pageName,
          platform: 'facebook',
          followerCount: fans,
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
        replies: p.comments?.summary?.total_count ?? 0,
        hashtags: extractHashtags(text).length ? extractHashtags(text) : ['#facebook'],
        mentionedUsernames: extractMentions(text),
        sentiment: analyzeSentimentAndEmotion(text),
      });

      for (const c of p.comments?.data ?? []) {
        const ctext: string = c.message || '';
        if (!ctext) continue;

        const cdemo = inferDemographics('', ctext);
        const author = c.from?.name || 'Facebook user';

        posts.push({
          id: `fb_c_${c.id}`,
          platform: 'facebook',
          author: {
            id: `usr_fb_${c.from?.id || author}`,
            username: author.replace(/\s+/g, '_').toLowerCase(),
            displayName: author,
            platform: 'facebook',
            followerCount: null, // not exposed for commenters
            verified: false,
            estimatedAgeBracket: cdemo.estimatedAgeBracket,
            inferredLocation: cdemo.inferredLocation,
            detectedLanguage: cdemo.detectedLanguage,
            interests: cdemo.interests,
          },
          content: truncate(ctext),
          timestamp: c.created_time ? new Date(c.created_time).toISOString() : new Date().toISOString(),
          url: p.permalink_url,
          likes: c.like_count ?? 0,
          shares: 0,
          replies: c.comment_count ?? 0,
          // Real reply edges: comment -> parent comment, or comment -> Page.
          inReplyToPostId: c.parent?.id ? `fb_c_${c.parent.id}` : `fb_${p.id}`,
          inReplyToAuthorId: `usr_fb_${pageId}`,
          hashtags: extractHashtags(ctext).length ? extractHashtags(ctext) : ['#comment'],
          mentionedUsernames: extractMentions(ctext),
          sentiment: analyzeSentimentAndEmotion(ctext),
        });
      }
    }
  }

  return posts;
}
