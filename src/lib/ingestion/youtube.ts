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
 * YouTube ingestion — Component A, "Appreciable Addition" tier.
 *
 * The Data API v3 needs a key (free: 10,000 quota units/day). Anonymous calls
 * return 403 (verified 2026-08-25).
 *
 * Accepts three kinds of target, because the problem statement asks for
 * "text-based context from video comments" and an analyst rarely has a bare
 * video id to hand:
 *   - a video URL or id      -> that video's comment threads
 *   - a search phrase        -> top matching videos, then their comments
 *   - a @handle / channel id -> the channel's recent uploads, then comments
 *
 * Quota notes: search.list costs 100 units, so a search-based ingest is ~100x
 * more expensive than fetching comments for a known video. The connector
 * therefore searches only when it has to.
 */

const API = 'https://www.googleapis.com/youtube/v3';

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

async function call(url: string): Promise<{ ok: boolean; code: number; json?: any; error?: string }> {
  const res = await fetch(url, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, code: res.status, json, error: json?.error?.message || `HTTP ${res.status}` };
  }
  return { ok: true, code: res.status, json };
}

/**
 * Google answers an invalid API key with HTTP 400, and an exhausted quota with
 * 403 — so the bare HTTP status misclassifies both. The `reason` in the error
 * payload is the reliable signal.
 */
function youtubeStatus(code: number, json: any): ConnectorStatus {
  const reason: string = json?.error?.errors?.[0]?.reason || '';
  const message: string = json?.error?.message || '';

  // An invalid key comes back as HTTP 400 with reason "badRequest" and only the
  // message identifying it as a key problem, so the message must be inspected.
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

/** Strips the HTML YouTube returns in textDisplay. */
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
      // Subscriber counts are not returned for commenters.
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
    // Every comment is a real reply edge to the uploader.
    inReplyToPostId: `yt_video_${videoId}`,
    inReplyToAuthorId: videoOwnerId ? `usr_yt_${videoOwnerId}` : undefined,
    // Topic label for a comment with no hashtags of its own: derive it from the
    // video title. Stripping every non-alphanumeric produced unreadable runs
    // like "#PrashantDhawanSir39sScie", so words are kept and capped instead.
    hashtags: extractHashtags(text).length ? extractHashtags(text) : [videoTopicTag(videoTitle)],
    mentionedUsernames: extractMentions(text),
    sentiment,
  };
}

/**
 * Converts a video title into a short, readable topic tag.
 * Keeps whole words rather than stripping punctuation from the whole string,
 * which previously truncated mid-word into unreadable labels.
 */
function videoTopicTag(title: string): string {
  const STOP = new Set([
    'the', 'a', 'an', 'and', 'or', 'of', 'in', 'to', 'for', 'on', 'with', 'is',
    'how', 'what', 'why', 'best', 'full', 'new', 'part', 'video', 'course',
    'shorts', 'live', 'ep', 'episode', 'hindi', 'english',
  ]);

  // Decode entities FIRST: YouTube returns titles containing &#39; and &amp;,
  // and stripping punctuation afterwards leaves the numeric part behind, which
  // produced labels like "#39IndiaSemiconductorMission".
  const words = cleanText(title || '')
    .replace(/[|:\-–—#@]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((w) => w.length > 2 && !STOP.has(w.toLowerCase()))
    .slice(0, 3);

  if (words.length === 0) return '#youtube';
  return `#${words.map((w) => w[0].toUpperCase() + w.slice(1)).join('')}`;
}

function parseVideoId(input: string): string | null {
  const m = input.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([0-9A-Za-z_-]{11})/);
  if (m) return m[1];
  if (/^[0-9A-Za-z_-]{11}$/.test(input.trim())) return input.trim();
  return null;
}

/** Resolves a target to a list of {videoId, title, ownerId}. */
async function resolveVideos(
  input: string,
  limit: number
): Promise<{ videos: { id: string; title: string; ownerId: string | null }[]; code: number; error?: string; json?: any }> {
  const direct = parseVideoId(input);
  if (direct) {
    const meta = await call(apiUrl('videos', { part: 'snippet', id: direct }));
    const item = meta.json?.items?.[0];
    return {
      videos: [{ id: direct, title: item?.snippet?.title || direct, ownerId: item?.snippet?.channelId ?? null }],
      code: meta.code,
      json: meta.json,
    };
  }

  // Channel handle or id -> recent uploads.
  const isChannel = input.startsWith('@') || /^UC[\w-]{22}$/.test(input);
  if (isChannel) {
    const params: Record<string, string> = { part: 'contentDetails' };
    if (input.startsWith('@')) params.forHandle = input;
    else params.id = input;
    const ch = await call(apiUrl('channels', params));
    const uploads = ch.json?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (uploads) {
      const pl = await call(
        apiUrl('playlistItems', { part: 'snippet', playlistId: uploads, maxResults: Math.min(limit, 10) })
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

  // Free-text search. Costs 100 quota units, so keep the result count small.
  const search = await call(
    apiUrl('search', { part: 'snippet', q: input, type: 'video', maxResults: Math.min(limit, 5), order: 'relevance' })
  );
  if (!search.ok) return { videos: [], code: search.code, error: search.error, json: search.json };

  const videos = (search.json?.items ?? []).map((i: any) => ({
    id: i.id?.videoId,
    title: i.snippet?.title || '',
    ownerId: i.snippet?.channelId ?? null,
  }));
  return { videos: videos.filter((v: any) => v.id), code: 200 };
}

export const youtubeConnector: Connector = {
  platform: 'youtube',
  displayName: 'YouTube',
  tier: 'appreciable',
  requiredEnv: ['YOUTUBE_API_KEY'],
  worksWithoutCredentials: false,
  cost: 'free',
  targetHint: 'a video URL/id, a @channel handle, or a search phrase',
  setupDoc: 'docs/platform-setup.md#youtube',
  notes: 'Free key, 10,000 quota units/day. search.list costs 100 units per call.',

  async fetch(target, limit = 25): Promise<ConnectorResult> {
    if (!hasEnv(['YOUTUBE_API_KEY'])) {
      return missingCredentials('youtube', ['YOUTUBE_API_KEY'], 'docs/platform-setup.md#youtube');
    }

    const input = (target || '').trim();
    if (!input) {
      return { platform: 'youtube', posts: [], status: 'not-found', note: 'Provide a video, channel, or search phrase.' };
    }

    try {
      const { videos, code, error, json } = await resolveVideos(input, limit);
      if (videos.length === 0) {
        return {
          platform: 'youtube',
          posts: [],
          status: code === 200 ? 'not-found' : youtubeStatus(code, json),
          note:
            code === 403
              ? `YouTube rejected the key: ${error}. Check the key is enabled for the Data API ` +
                'and that the daily quota is not exhausted.'
              : error || `No YouTube videos matched "${input}".`,
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
          })
        );
        if (!threads.ok) {
          // Comments disabled on a video is normal; skip it rather than failing
          // the whole ingest.
          console.warn(`YouTube comments unavailable for ${v.id}: ${threads.error}`);
          continue;
        }
        for (const t of (threads.json?.items ?? []) as YtCommentThread[]) {
          const p = commentToPost(t, v.id, v.title, v.ownerId);
          if (p) posts.push(p);
        }
        if (posts.length >= limit) break;
      }

      if (posts.length === 0) {
        return {
          platform: 'youtube',
          posts: [],
          status: 'ok',
          source: 'data-api-v3',
          note: 'Videos found, but none had readable comments (comments may be disabled).',
        };
      }

      return { platform: 'youtube', posts: posts.slice(0, limit), status: 'ok', source: 'data-api-v3' };
    } catch (err) {
      return { platform: 'youtube', posts: [], status: 'error', note: String(err) };
    }
  },
};

/** Backwards-compatible helper used by the ingest route. */
export async function fetchLiveYouTubeComments(
  videoId: string = 'dQw4w9WgXcQ',
  maxResults: number = 10
): Promise<SocialPost[]> {
  const result = await youtubeConnector.fetch(videoId, maxResults);
  if (result.status !== 'ok') console.warn(`YouTube: ${result.status} — ${result.note}`);
  return result.posts;
}
