import { SocialPost } from '@/types/intelligence';
import { analyzeSentimentAndEmotion } from '@/lib/nlp/emotionEngine';
import { inferDemographics } from '@/lib/nlp/demographicProfiler';

interface RedditPostItem {
  data: {
    id: string;
    title: string;
    selftext: string;
    author: string;
    subreddit: string;
    score: number;
    num_comments: number;
    created_utc: number;
    permalink: string;
    upvote_ratio: number;
  };
}

/**
 * Live Ingest from Public Reddit JSON feeds (Zero API key needed)
 */
export async function fetchLiveRedditPosts(subreddit: string = 'india', limit: number = 15): Promise<SocialPost[]> {
  try {
    const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SIH2026Intelligence/1.0'
      },
      next: { revalidate: 60 } // Next.js ISR cache
    });

    if (!response.ok) {
      console.warn(`Reddit fetch responded with status: ${response.status}`);
      return [];
    }

    const json = await response.json();
    const children: RedditPostItem[] = json?.data?.children || [];

    return children.map((item) => {
      const p = item.data;
      const text = `${p.title} ${p.selftext || ''}`.trim();
      const sentiment = analyzeSentimentAndEmotion(text);
      const demo = inferDemographics('', text);

      return {
        id: `reddit_${p.id}`,
        platform: 'reddit',
        author: {
          id: `user_rd_${p.author}`,
          username: p.author,
          displayName: `u/${p.author}`,
          platform: 'reddit',
          followerCount: Math.floor(p.score * 12 + Math.random() * 500),
          verified: false,
          estimatedAgeBracket: demo.estimatedAgeBracket,
          inferredLocation: demo.inferredLocation,
          detectedLanguage: demo.detectedLanguage,
          interests: demo.interests
        },
        content: text.length > 300 ? text.slice(0, 300) + '...' : text,
        timestamp: new Date(p.created_utc * 1000).toISOString(),
        url: `https://reddit.com${p.permalink}`,
        likes: p.score,
        shares: Math.floor(p.score * 0.15),
        replies: p.num_comments,
        hashtags: [`#r_${p.subreddit}`, '#reddit'],
        sentiment
      };
    });
  } catch (err) {
    console.error('Error fetching live Reddit posts:', err);
    return [];
  }
}
