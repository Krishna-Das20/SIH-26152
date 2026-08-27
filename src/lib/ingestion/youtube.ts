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
import { addPosts } from '@/lib/store';

/**
 * YouTube ingestion — Official Google YouTube Data API v3.
 *
 * Google provides 10,000 free quota units / credits per day.
 * Resource quota costs:
 *   - commentThreads.list : 1 unit
 *   - videos.list         : 1 unit
 *   - channels.list       : 1 unit
 *   - playlistItems.list  : 1 unit
 *   - search.list         : 100 units
 *
 * This connector tracks quota consumption against the 10,000 daily budget
 * and provides an automated public fallback for resilience.
 */

const API = 'https://www.googleapis.com/youtube/v3';
const DAILY_LIMIT = 10000;

interface QuotaState {
  usedToday: number;
  day: string;
  history: { timestamp: string; cost: number; action: string }[];
}

const g = globalThis as unknown as { _youtubeQuota?: QuotaState };

function getQuotaState(): QuotaState {
  const currentDay = new Date().toISOString().slice(0, 10);
  if (!g._youtubeQuota || g._youtubeQuota.day !== currentDay) {
    g._youtubeQuota = {
      usedToday: 0,
      day: currentDay,
      history: [],
    };
  }
  return g._youtubeQuota;
}

function recordQuotaUsage(cost: number, action: string) {
  const state = getQuotaState();
  state.usedToday += cost;
  state.history.unshift({
    timestamp: new Date().toISOString(),
    cost,
    action,
  });
  if (state.history.length > 50) state.history.pop();
}

export function getYoutubeQuotaTelemetry() {
  const state = getQuotaState();
  const hasKey = Boolean(process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_API_KEY.trim().length > 5);
  return {
    dailyLimit: DAILY_LIMIT,
    usedToday: state.usedToday,
    remaining: Math.max(0, DAILY_LIMIT - state.usedToday),
    hasApiKey: hasKey,
    tier: 'YouTube Data API v3 (Free 10,000 Credits/Day)',
    status: hasKey ? (state.usedToday >= DAILY_LIMIT ? 'quota_exhausted' : 'active') : 'using_fallback_no_key',
    history: state.history.slice(0, 10),
  };
}

interface YtCommentThread {
  id: string;
  snippet: {
    videoId?: string;
    totalReplyCount?: number;
    topLevelComment: {
      id: string;
      snippet: {
        textDisplay?: string;
        textOriginal?: string;
        authorDisplayName?: string;
        authorProfileImageUrl?: string;
        authorChannelId?: { value: string };
        likeCount?: number;
        publishedAt?: string;
      };
    };
  };
  replies?: { comments: { id: string; snippet: any }[] };
}

function apiUrl(path: string, params: Record<string, string | number>): string {
  const qs = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    key: process.env.YOUTUBE_API_KEY!,
  });
  return `${API}/${path}?${qs}`;
}

async function call(
  url: string,
  cost: number = 1,
  action: string = 'api_call'
): Promise<{ ok: boolean; code: number; json?: any; error?: string }> {
  recordQuotaUsage(cost, action);
  const res = await fetch(url, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, code: res.status, json, error: json?.error?.message || `HTTP ${res.status}` };
  }
  return { ok: true, code: res.status, json };
}

function youtubeStatus(code: number, json: any): ConnectorStatus {
  const reason: string = json?.error?.errors?.[0]?.reason || '';
  const message: string = json?.error?.message || '';

  if (/api key not valid|invalid api key|api key expired/i.test(message)) {
    return 'unauthorized';
  }
  if (reason === 'API_KEY_INVALID' || reason === 'keyInvalid' || reason === 'forbidden') {
    return 'unauthorized';
  }
  if (reason === 'quotaExceeded' || reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded') {
    return 'rate-limited';
  }
  if (reason === 'commentsDisabled' || reason === 'videoNotFound') return 'not-found';
  return statusFromHttp(code);
}

function cleanText(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function commentToPost(
  thread: YtCommentThread,
  videoId: string,
  videoTitle: string,
  videoOwnerId: string | null
): SocialPost | null {
  const s = thread.snippet.topLevelComment.snippet;
  const text = cleanText(s.textOriginal || s.textDisplay || '');
  if (!text) return null;

  const sentiment = analyzeSentimentAndEmotion(text);
  const demo = inferDemographics('', text);
  const channelId = s.authorChannelId?.value || s.authorDisplayName || 'unknown';

  return {
    id: `yt_${thread.id}`,
    platform: 'youtube',
    author: {
      id: `usr_yt_${channelId}`,
      username: s.authorDisplayName || 'youtube_user',
      displayName: s.authorDisplayName || 'YouTube user',
      avatarUrl: s.authorProfileImageUrl,
      platform: 'youtube',
      followerCount: null,
      verified: false,
      estimatedAgeBracket: demo.estimatedAgeBracket,
      inferredLocation: demo.inferredLocation,
      detectedLanguage: demo.detectedLanguage,
      interests: demo.interests,
    },
    content: truncate(text),
    timestamp: s.publishedAt ? new Date(s.publishedAt).toISOString() : new Date().toISOString(),
    url: `https://www.youtube.com/watch?v=${videoId}&lc=${thread.id}`,
    likes: s.likeCount ?? 0,
    shares: 0,
    replies: thread.snippet.totalReplyCount ?? 0,
    inReplyToPostId: `yt_video_${videoId}`,
    inReplyToAuthorId: videoOwnerId ? `usr_yt_${videoOwnerId}` : undefined,
    hashtags: extractHashtags(text).length ? extractHashtags(text) : [videoTopicTag(videoTitle)],
    mentionedUsernames: extractMentions(text),
    sentiment,
  };
}

function videoTopicTag(title: string): string {
  const STOP = new Set([
    'the', 'a', 'an', 'and', 'or', 'of', 'in', 'to', 'for', 'on', 'with', 'is',
    'how', 'what', 'why', 'best', 'full', 'new', 'part', 'video', 'course',
    'shorts', 'live', 'ep', 'episode', 'hindi', 'english',
  ]);

  const words = cleanText(title || '')
    .replace(/[|:\-–—#@]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((w) => w.length > 2 && !STOP.has(w.toLowerCase()))
    .slice(0, 3);

  if (words.length === 0) return '#youtube';
  return `#${words.map((w) => w[0].toUpperCase() + w.slice(1)).join('')}`;
}

export function parseVideoId(input: string): string | null {
  const m = input.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([0-9A-Za-z_-]{11})/);
  if (m) return m[1];
  if (/^[0-9A-Za-z_-]{11}$/.test(input.trim())) return input.trim();
  return null;
}

async function resolveVideos(
  input: string,
  limit: number
): Promise<{ videos: { id: string; title: string; ownerId: string | null }[]; code: number; error?: string; json?: any }> {
  const direct = parseVideoId(input);
  if (direct) {
    const meta = await call(apiUrl('videos', { part: 'snippet', id: direct }), 1, 'videos.list');
    const item = meta.json?.items?.[0];
    return {
      videos: [{ id: direct, title: item?.snippet?.title || direct, ownerId: item?.snippet?.channelId ?? null }],
      code: meta.code,
      json: meta.json,
    };
  }

  const isChannel = input.startsWith('@') || /^UC[\w-]{22}$/.test(input);
  if (isChannel) {
    const params: Record<string, string> = { part: 'contentDetails' };
    if (input.startsWith('@')) params.forHandle = input;
    else params.id = input;
    const ch = await call(apiUrl('channels', params), 1, 'channels.list');
    const uploads = ch.json?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (uploads) {
      const pl = await call(
        apiUrl('playlistItems', { part: 'snippet', playlistId: uploads, maxResults: Math.min(limit, 10) }),
        1,
        'playlistItems.list'
      );
      const videos = (pl.json?.items ?? []).map((i: any) => ({
        id: i.snippet?.resourceId?.videoId,
        title: i.snippet?.title || '',
        ownerId: i.snippet?.channelId ?? null,
      }));
      return { videos: videos.filter((v: any) => v.id), code: pl.code, error: pl.error, json: pl.json };
    }
    return { videos: [], code: ch.code, error: ch.error, json: ch.json };
  }

  // Free-text search costs 100 quota units
  const search = await call(
    apiUrl('search', { part: 'snippet', q: input, type: 'video', maxResults: Math.min(limit, 5), order: 'relevance' }),
    100,
    'search.list'
  );
  if (!search.ok) return { videos: [], code: search.code, error: search.error, json: search.json };

  const videos = (search.json?.items ?? []).map((i: any) => ({
    id: i.id?.videoId,
    title: i.snippet?.title || '',
    ownerId: i.snippet?.channelId ?? null,
  }));
  return { videos: videos.filter((v: any) => v.id), code: 200 };
}

/**
 * Public fallback for fetching comments without an API key or when quota is depleted.
 * Utilizes public YouTube continuation extraction and open gateways.
 */
async function fetchPublicYoutubeFallback(videoId: string, limit: number = 20): Promise<SocialPost[]> {
  try {
    const gateways = [
      `https://pipedapi.kavin.rocks/comments/${videoId}`,
      `https://api.invidious.io/api/v1/comments/${videoId}`,
    ];

    for (const gw of gateways) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(gw, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
        clearTimeout(timer);
        if (res.ok) {
          const json = await res.json();
          const comments = json.comments || json || [];
          if (Array.isArray(comments) && comments.length > 0) {
            const posts: SocialPost[] = [];
            for (const c of comments.slice(0, limit)) {
              const text = cleanText(c.commentText || c.content || c.text || '');
              if (!text) continue;
              const author = c.author || 'youtube_user';
              const demo = inferDemographics('', text);
              const sentiment = analyzeSentimentAndEmotion(text);
              posts.push({
                id: `yt_pub_${c.commentId || Math.random().toString(36).slice(2, 9)}`,
                platform: 'youtube',
                author: {
                  id: `usr_yt_${author}`,
                  username: author,
                  displayName: author,
                  avatarUrl: c.authorThumbnails?.[0]?.url || c.authorThumbnail,
                  platform: 'youtube',
                  followerCount: null,
                  verified: false,
                  estimatedAgeBracket: demo.estimatedAgeBracket,
                  inferredLocation: demo.inferredLocation,
                  detectedLanguage: demo.detectedLanguage,
                  interests: demo.interests,
                },
                content: truncate(text),
                timestamp: new Date().toISOString(),
                url: `https://www.youtube.com/watch?v=${videoId}`,
                likes: c.likeCount || 1,
                shares: 0,
                replies: c.replyCount || 0,
                inReplyToPostId: `yt_video_${videoId}`,
                hashtags: ['#YouTubeStream'],
                mentionedUsernames: [],
                sentiment,
              });
            }
            if (posts.length > 0) return posts;
          }
        }
      } catch {
        // try next gateway
      }
    }
  } catch (err) {
    console.warn('Public fallback error:', err);
  }
  return [];
}

export const youtubeConnector: Connector = {
  platform: 'youtube',
  displayName: 'YouTube',
  tier: 'appreciable',
  requiredEnv: ['YOUTUBE_API_KEY'],
  worksWithoutCredentials: true,
  cost: 'free',
  targetHint: 'a video URL/id, a @channel handle, or a search phrase',
  setupDoc: 'docs/platform-setup.md#youtube',
  notes: 'Free Google Cloud key gives 10,000 quota units/day. Automatically tracks daily budget and falls back gracefully.',

  async fetch(target, limit = 25): Promise<ConnectorResult> {
    const input = (target || '').trim();
    if (!input) {
      return { platform: 'youtube', posts: [], status: 'not-found', note: 'Provide a video, channel, or search phrase.' };
    }

    const hasKey = hasEnv(['YOUTUBE_API_KEY']);
    const directId = parseVideoId(input);

    // If key is absent, use public comments fallback
    if (!hasKey) {
      if (directId) {
        const fallbackPosts = await fetchPublicYoutubeFallback(directId, limit);
        if (fallbackPosts.length > 0) {
          return {
            platform: 'youtube',
            posts: fallbackPosts,
            status: 'ok',
            source: 'youtube-public-gateway',
            note: 'Fetched live comments via resilient public YouTube gateway. For full 10,000 credits/day official access, add YOUTUBE_API_KEY.',
          };
        }
      }
      return missingCredentials('youtube', ['YOUTUBE_API_KEY'], 'docs/platform-setup.md#youtube');
    }

    try {
      const { videos, code, error, json } = await resolveVideos(input, limit);
      if (videos.length === 0) {
        if (directId) {
          const fallbackPosts = await fetchPublicYoutubeFallback(directId, limit);
          if (fallbackPosts.length > 0) {
            return { platform: 'youtube', posts: fallbackPosts, status: 'ok', source: 'fallback' };
          }
        }
        return {
          platform: 'youtube',
          posts: [],
          status: code === 200 ? 'not-found' : youtubeStatus(code, json),
          note: error || `No YouTube videos matched "${input}".`,
        };
      }

      const posts: SocialPost[] = [];
      const perVideo = Math.max(5, Math.ceil(limit / videos.length));

      for (const v of videos) {
        const threads = await call(
          apiUrl('commentThreads', {
            part: 'snippet',
            videoId: v.id,
            maxResults: Math.min(perVideo, 100),
            order: 'relevance',
            textFormat: 'plainText',
          }),
          1,
          'commentThreads.list'
        );

        if (!threads.ok) {
          console.warn(`YouTube comments unavailable for ${v.id}: ${threads.error}`);
          continue;
        }

        for (const t of (threads.json?.items ?? []) as YtCommentThread[]) {
          const p = commentToPost(t, v.id, v.title, v.ownerId);
          if (p) posts.push(p);
        }
        if (posts.length >= limit) break;
      }

      if (posts.length === 0 && directId) {
        const fallbackPosts = await fetchPublicYoutubeFallback(directId, limit);
        if (fallbackPosts.length > 0) {
          return { platform: 'youtube', posts: fallbackPosts, status: 'ok', source: 'youtube-public-gateway' };
        }
      }

      return { platform: 'youtube', posts: posts.slice(0, limit), status: 'ok', source: 'data-api-v3' };
    } catch (err) {
      if (directId) {
        const fallbackPosts = await fetchPublicYoutubeFallback(directId, limit);
        if (fallbackPosts.length > 0) {
          return { platform: 'youtube', posts: fallbackPosts, status: 'ok', source: 'youtube-public-gateway' };
        }
      }
      return { platform: 'youtube', posts: [], status: 'error', note: String(err) };
    }
  },
};

/**
 * On-demand sync function: extracts YouTube comments, scores them,
 * and adds them into the global intelligence store.
 */
export async function syncLiveYoutube(
  target: string = 'dQw4w9WgXcQ',
  limit: number = 25
): Promise<{ success: boolean; count: number; posts: SocialPost[]; telemetry: any; error?: string }> {
  const result = await youtubeConnector.fetch(target, limit);
  if (result.status === 'ok' && result.posts.length > 0) {
    addPosts(result.posts);
    return {
      success: true,
      count: result.posts.length,
      posts: result.posts,
      telemetry: getYoutubeQuotaTelemetry(),
    };
  }
  return {
    success: false,
    count: 0,
    posts: [],
    telemetry: getYoutubeQuotaTelemetry(),
    error: result.note || 'Could not fetch comments for this YouTube target',
  };
}

export async function fetchLiveYouTubeComments(
  videoId: string = 'dQw4w9WgXcQ',
  maxResults: number = 10
): Promise<SocialPost[]> {
  const res = await syncLiveYoutube(videoId, maxResults);
  return res.posts;
}
