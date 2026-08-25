import { SocialPost } from '@/types/intelligence';
import { analyzeSentimentAndEmotion } from '@/lib/nlp/emotionEngine';
import { inferDemographics } from '@/lib/nlp/demographicProfiler';
import { truncate, extractHashtags } from '../types';

/**
 * Reads a connected user's OWN X timeline and the replies to it.
 *
 * Cost note: X bills reads of your own data at the "Owned Reads" rate of
 * $0.001 per resource rather than $0.005, and de-duplicates identical reads
 * within a 24h UTC window. Both matter for unit economics, so this fetcher
 * deliberately reads the user's own timeline rather than running a search.
 */
const API = 'https://api.twitter.com/2';

const TWEET_FIELDS =
  'created_at,public_metrics,lang,conversation_id,in_reply_to_user_id,referenced_tweets,entities,author_id';
const USER_FIELDS = 'username,name,public_metrics,verified,description,location';

async function get(url: string, token: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`X API ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`);
  }
  return res.json();
}

export async function xOwnTimeline(token: string, limit: number): Promise<SocialPost[]> {
  const max = Math.min(Math.max(limit, 5), 100);

  const me = await get(`${API}/users/me?user.fields=${USER_FIELDS}`, token);
  const user = me?.data;
  if (!user?.id) return [];

  const timeline = await get(
    `${API}/users/${user.id}/tweets?max_results=${max}&tweet.fields=${TWEET_FIELDS}` +
      `&expansions=author_id&user.fields=${USER_FIELDS}`,
    token
  );

  const tweets: any[] = timeline?.data ?? [];
  const followers = user.public_metrics?.followers_count ?? null;

  return tweets.map((t) => {
    const text: string = t.text || '';
    const m = t.public_metrics || {};
    const demo = inferDemographics(user.description || '', text, user.location);

    return {
      id: `x_${t.id}`,
      platform: 'x' as const,
      author: {
        id: `usr_x_${user.id}`,
        username: user.username,
        displayName: user.name || user.username,
        bio: user.description,
        platform: 'x' as const,
        followerCount: followers,
        verified: Boolean(user.verified),
        estimatedAgeBracket: demo.estimatedAgeBracket,
        inferredLocation: demo.inferredLocation,
        detectedLanguage: demo.detectedLanguage,
        interests: demo.interests,
      },
      content: truncate(text),
      timestamp: t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString(),
      url: `https://x.com/${user.username}/status/${t.id}`,
      likes: m.like_count ?? 0,
      shares: (m.retweet_count ?? 0) + (m.quote_count ?? 0),
      replies: m.reply_count ?? 0,
      views: m.impression_count,
      inReplyToAuthorId: t.in_reply_to_user_id ? `usr_x_${t.in_reply_to_user_id}` : undefined,
      mentionedUsernames: t.entities?.mentions?.map((x: any) => x.username) ?? [],
      hashtags: t.entities?.hashtags?.length
        ? t.entities.hashtags.map((h: any) => `#${h.tag}`)
        : extractHashtags(text),
      sentiment: analyzeSentimentAndEmotion(text),
    };
  });
}
