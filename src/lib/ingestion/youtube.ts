import { SocialPost } from '@/types/intelligence';
import { analyzeSentimentAndEmotion } from '@/lib/nlp/emotionEngine';
import { inferDemographics } from '@/lib/nlp/demographicProfiler';

/**
 * YouTube Comments Ingestion using Google Data API v3 or fallback
 */
export async function fetchLiveYouTubeComments(videoId: string = 'dQw4w9WgXcQ', maxResults: number = 10): Promise<SocialPost[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    return [];
  }

  try {
    const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=${maxResults}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const json = await res.json();
    const items = json.items || [];

    return items.map((item: any) => {
      const snippet = item.snippet.topLevelComment.snippet;
      const text = snippet.textDisplay || '';
      const sentiment = analyzeSentimentAndEmotion(text);
      const demo = inferDemographics('', text);

      return {
        id: `yt_${item.id}`,
        platform: 'youtube',
        author: {
          id: `user_yt_${snippet.authorChannelId?.value || snippet.authorDisplayName}`,
          username: snippet.authorDisplayName,
          displayName: snippet.authorDisplayName,
          avatarUrl: snippet.authorProfileImageUrl,
          platform: 'youtube',
          // Comment threads carry no subscriber count for the commenter.
          followerCount: null,
          verified: false,
          estimatedAgeBracket: demo.estimatedAgeBracket,
          inferredLocation: demo.inferredLocation,
          detectedLanguage: demo.detectedLanguage,
          interests: demo.interests
        },
        content: text,
        timestamp: snippet.publishedAt || new Date().toISOString(),
        likes: snippet.likeCount || 0,
        shares: 0,
        replies: item.snippet.totalReplyCount || 0,
        hashtags: ['#YouTubeDiscussion'],
        sentiment
      };
    });
  } catch (err) {
    console.error('YouTube ingestion failed:', err);
    return [];
  }
}
