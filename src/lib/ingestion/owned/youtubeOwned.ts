import { SocialPost } from '@/types/intelligence';
import { analyzeSentimentAndEmotion } from '@/lib/nlp/emotionEngine';
import { inferDemographics } from '@/lib/nlp/demographicProfiler';
import { truncate, extractHashtags } from '../types';

/**
 * Reads a connected user's own YouTube channel: recent uploads plus the
 * comments on them.
 *
 * The comments are the audience voice this product exists to analyse, so the
 * uploads are fetched mainly to reach them. Uses the user's OAuth token, so
 * quota is charged to our project but the data is scoped to their channel.
 */
const API = 'https://www.googleapis.com/youtube/v3';

async function get(path: string, token: string): Promise<any> {
  const res = await fetch(`${API}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`YouTube API ${res.status}: ${body?.error?.message || ''}`.slice(0, 180));
  }
  return res.json();
}

function clean(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

export async function youtubeOwnChannel(token: string, limit: number): Promise<SocialPost[]> {
  const channels = await get('channels?part=snippet,contentDetails,statistics&mine=true', token);
  const channel = channels?.items?.[0];
  if (!channel) return [];

  const channelId: string = channel.id;
  const channelTitle: string = channel.snippet?.title || 'My channel';
  const subscribers = Number(channel.statistics?.subscriberCount);
  const followerCount = Number.isFinite(subscribers) ? subscribers : null;

  const uploadsPlaylist = channel.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylist) return [];

  const videoCount = Math.min(Math.max(Math.ceil(limit / 5), 1), 10);
  const playlist = await get(
    `playlistItems?part=snippet&playlistId=${uploadsPlaylist}&maxResults=${videoCount}`,
    token
  );

  const posts: SocialPost[] = [];

  for (const item of playlist?.items ?? []) {
    const videoId = item.snippet?.resourceId?.videoId;
    const title: string = item.snippet?.title || '';
    if (!videoId) continue;

    // The upload itself, so the graph has a node the comments can reply to.
    const videoDemo = inferDemographics('', title);
    posts.push({
      id: `yt_video_${videoId}`,
      platform: 'youtube',
      author: {
        id: `usr_yt_${channelId}`,
        username: channel.snippet?.customUrl || channelTitle,
        displayName: channelTitle,
        platform: 'youtube',
        followerCount,
        verified: false,
        estimatedAgeBracket: videoDemo.estimatedAgeBracket,
        inferredLocation: videoDemo.inferredLocation,
        detectedLanguage: videoDemo.detectedLanguage,
        interests: videoDemo.interests,
      },
      content: truncate(title),
      timestamp: item.snippet?.publishedAt
        ? new Date(item.snippet.publishedAt).toISOString()
        : new Date().toISOString(),
      url: `https://www.youtube.com/watch?v=${videoId}`,
      likes: 0,
      shares: 0,
      replies: 0,
      hashtags: extractHashtags(title).length ? extractHashtags(title) : ['#upload'],
      sentiment: analyzeSentimentAndEmotion(title),
    });

    // Comments on a video may be disabled; that must not fail the whole sync.
    let threads: any;
    try {
      threads = await get(
        `commentThreads?part=snippet&videoId=${videoId}&maxResults=25&order=relevance&textFormat=plainText`,
        token
      );
    } catch {
      continue;
    }

    for (const t of threads?.items ?? []) {
      const s = t.snippet?.topLevelComment?.snippet;
      const text = clean(s?.textOriginal || s?.textDisplay || '');
      if (!text) continue;

      const demo = inferDemographics('', text);
      posts.push({
        id: `yt_${t.id}`,
        platform: 'youtube',
        author: {
          id: `usr_yt_${s.authorChannelId?.value || s.authorDisplayName}`,
          username: s.authorDisplayName || 'youtube_user',
          displayName: s.authorDisplayName || 'YouTube user',
          avatarUrl: s.authorProfileImageUrl,
          platform: 'youtube',
          followerCount: null, // not exposed for commenters
          verified: false,
          estimatedAgeBracket: demo.estimatedAgeBracket,
          inferredLocation: demo.inferredLocation,
          detectedLanguage: demo.detectedLanguage,
          interests: demo.interests,
        },
        content: truncate(text),
        timestamp: s.publishedAt ? new Date(s.publishedAt).toISOString() : new Date().toISOString(),
        url: `https://www.youtube.com/watch?v=${videoId}&lc=${t.id}`,
        likes: s.likeCount ?? 0,
        shares: 0,
        replies: t.snippet?.totalReplyCount ?? 0,
        // Real reply edge: commenter -> channel owner.
        inReplyToPostId: `yt_video_${videoId}`,
        inReplyToAuthorId: `usr_yt_${channelId}`,
        hashtags: extractHashtags(text).length ? extractHashtags(text) : ['#comment'],
        sentiment: analyzeSentimentAndEmotion(text),
      });
    }

    if (posts.length >= limit * 3) break;
  }

  return posts;
}
