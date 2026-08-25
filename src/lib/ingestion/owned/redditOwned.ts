import { SocialPost } from '@/types/intelligence';
import { analyzeSentimentAndEmotion } from '@/lib/nlp/emotionEngine';
import { inferDemographics } from '@/lib/nlp/demographicProfiler';
import { truncate, extractHashtags } from '../types';

/**
 * Reads a connected user's own Reddit submissions and comments.
 * Requires the `history` scope granted at connect time.
 */
const OAUTH = 'https://oauth.reddit.com';

async function get(path: string, token: string): Promise<any> {
  const res = await fetch(`${OAUTH}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': process.env.REDDIT_USER_AGENT || 'SIH26152-AudienceIntelligence/1.0',
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Reddit API ${res.status}`);
  return res.json();
}

export async function redditOwnHistory(token: string, limit: number): Promise<SocialPost[]> {
  const capped = Math.min(Math.max(limit, 1), 100);

  const me = await get('/api/v1/me', token);
  const username: string = me?.name;
  if (!username) return [];

  // Submissions and comments are separate endpoints; both are the user's own.
  const [submitted, comments] = await Promise.all([
    get(`/user/${username}/submitted?limit=${capped}&raw_json=1`, token).catch(() => null),
    get(`/user/${username}/comments?limit=${capped}&raw_json=1`, token).catch(() => null),
  ]);

  const children = [
    ...(submitted?.data?.children ?? []),
    ...(comments?.data?.children ?? []),
  ];

  const posts: SocialPost[] = [];

  for (const child of children) {
    const d = child.data;
    const text = `${d.title || ''} ${d.selftext || d.body || ''}`.trim();
    if (!text) continue;

    const demo = inferDemographics('', text);
    const parent =
      d.parent_id && d.parent_id.startsWith('t1_') ? d.parent_id.slice(3) : undefined;

    posts.push({
      id: `reddit_${d.id}`,
      platform: 'reddit',
      author: {
        id: `usr_rd_${username}`,
        username,
        displayName: `u/${username}`,
        platform: 'reddit',
        // Reddit has no follower concept; karma is not a follower count.
        followerCount: null,
        verified: Boolean(me?.verified),
        estimatedAgeBracket: demo.estimatedAgeBracket,
        inferredLocation: demo.inferredLocation,
        detectedLanguage: demo.detectedLanguage,
        interests: demo.interests,
      },
      content: truncate(text),
      timestamp: new Date((d.created_utc ?? 0) * 1000).toISOString(),
      url: d.permalink ? `https://reddit.com${d.permalink}` : undefined,
      likes: d.score ?? 0,
      shares: 0,
      replies: d.num_comments ?? 0,
      inReplyToPostId: parent ? `reddit_${parent}` : undefined,
      hashtags: extractHashtags(text).length ? extractHashtags(text) : [`#r_${d.subreddit}`],
      sentiment: analyzeSentimentAndEmotion(text),
    });
  }

  return posts;
}
