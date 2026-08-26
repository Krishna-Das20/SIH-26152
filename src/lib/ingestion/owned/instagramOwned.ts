import { SocialPost } from '@/types/intelligence';
import { analyzeSentimentAndEmotion } from '@/lib/nlp/emotionEngine';
import { inferDemographics } from '@/lib/nlp/demographicProfiler';
import { truncate, extractHashtags, extractMentions } from '../types';

/**
 * Reads a connected user's own Instagram media and the comments on it.
 *
 * Uses graph.instagram.com (the Instagram-Login host) rather than
 * graph.facebook.com, because Business Login issues tokens scoped to the
 * Instagram account directly and does not require a linked Facebook Page —
 * which removes the largest drop-off point in onboarding.
 */
const GRAPH = 'https://graph.instagram.com/v21.0';

async function get(path: string, token: string): Promise<any> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${GRAPH}${path}${sep}access_token=${encodeURIComponent(token)}`, {
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Instagram API ${res.status}: ${json?.error?.message || ''}`.slice(0, 180));
  }
  return json;
}

export async function instagramOwnMedia(token: string, limit: number): Promise<SocialPost[]> {
  const capped = Math.min(Math.max(limit, 1), 50);

  const me = await get('/me?fields=id,username,followers_count,media_count', token);
  const ownerId: string = me?.id;
  const handle: string = me?.username || 'account';
  const followers = typeof me?.followers_count === 'number' ? me.followers_count : null;
  if (!ownerId) return [];

  const media = await get(
    '/me/media?fields=id,caption,media_type,permalink,timestamp,like_count,comments_count,' +
      `comments{id,text,timestamp,like_count,username}&limit=${capped}`,
    token
  );

  const posts: SocialPost[] = [];

  for (const m of media?.data ?? []) {
    const caption: string = m.caption || '';

    if (caption) {
      const demo = inferDemographics('', caption);
      posts.push({
        id: `ig_${m.id}`,
        platform: 'instagram',
        author: {
          id: `usr_ig_${ownerId}`,
          username: handle,
          displayName: handle,
          platform: 'instagram',
          followerCount: followers,
          verified: false,
          estimatedAgeBracket: demo.estimatedAgeBracket,
          inferredLocation: demo.inferredLocation,
          detectedLanguage: demo.detectedLanguage,
          interests: demo.interests,
        },
        content: truncate(caption),
        timestamp: m.timestamp ? new Date(m.timestamp).toISOString() : new Date().toISOString(),
        url: m.permalink,
        likes: m.like_count ?? 0,
        // Instagram exposes no share count on media; zero is truthful.
        shares: 0,
        replies: m.comments_count ?? 0,
        hashtags: extractHashtags(caption).length ? extractHashtags(caption) : ['#instagram'],
        mentionedUsernames: extractMentions(caption),
        sentiment: analyzeSentimentAndEmotion(caption),
      });
    }

    // Comments are the audience signal this product exists to analyse.
    for (const c of m.comments?.data ?? []) {
      const text: string = c.text || '';
      if (!text) continue;

      const demo = inferDemographics('', text);
      // See instagram.ts: the API withholds commenter usernames, so a shared
      // placeholder would merge every commenter into one graph node.
      const commenter = c.username || `ig_anon_${c.id.slice(-8)}`;

      posts.push({
        id: `ig_c_${c.id}`,
        platform: 'instagram',
        author: {
          id: `usr_ig_${commenter}`,
          username: commenter,
          displayName: commenter,
          platform: 'instagram',
          followerCount: null, // not exposed for commenters
          verified: false,
          estimatedAgeBracket: demo.estimatedAgeBracket,
          inferredLocation: demo.inferredLocation,
          detectedLanguage: demo.detectedLanguage,
          interests: demo.interests,
        },
        content: truncate(text),
        timestamp: c.timestamp ? new Date(c.timestamp).toISOString() : new Date().toISOString(),
        url: m.permalink,
        likes: c.like_count ?? 0,
        shares: 0,
        replies: 0,
        // Real reply edge: commenter -> account owner.
        inReplyToPostId: `ig_${m.id}`,
        inReplyToAuthorId: `usr_ig_${ownerId}`,
        hashtags: extractHashtags(text).length ? extractHashtags(text) : ['#comment'],
        mentionedUsernames: extractMentions(text),
        sentiment: analyzeSentimentAndEmotion(text),
      });
    }
  }

  return posts;
}
