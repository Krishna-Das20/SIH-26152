import { SocialPost } from '@/types/intelligence';
import { analyzeSentimentAndEmotion } from '@/lib/nlp/emotionEngine';
import { inferDemographics } from '@/lib/nlp/demographicProfiler';
import { truncate, extractHashtags, extractMentions } from './types';

export interface DevvitPostInput {
  id: string;
  title?: string;
  body?: string;
  author: string;
  subreddit: string;
  score?: number;
  numComments?: number;
  createdUtc?: number;
  permalink?: string;
  url?: string;
  parentId?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var _devvitTelemetry: {
    totalReceived: number;
    lastEventTime: string | null;
    monitoredSubreddits: string[];
  } | undefined;
}

export function getDevvitTelemetry() {
  if (!global._devvitTelemetry) {
    global._devvitTelemetry = {
      totalReceived: 0,
      lastEventTime: null,
      monitoredSubreddits: ['technology', 'artificial', 'news', 'india'],
    };
  }
  return global._devvitTelemetry;
}

/**
 * Converts a live Devvit event into a normalized NEXUS SocialPost.
 */
export function devvitEventToPost(input: DevvitPostInput): SocialPost {
  const text = `${input.title || ''} ${input.body || ''}`.trim();
  const sentiment = analyzeSentimentAndEmotion(text);
  const demo = inferDemographics('', text);
  const subreddit = (input.subreddit || 'reddit').replace(/^r\//, '');
  const authorName = (input.author || 'reddit_user').replace(/^\/?u\//, '');

  const post: SocialPost = {
    id: `reddit_devvit_${input.id.replace(/^t[13]_/, '')}`,
    platform: 'reddit',
    author: {
      id: `usr_rd_${authorName}`,
      username: authorName,
      displayName: `u/${authorName}`,
      platform: 'reddit',
      followerCount: null,
      verified: false,
      estimatedAgeBracket: demo.estimatedAgeBracket,
      inferredLocation: demo.inferredLocation,
      detectedLanguage: demo.detectedLanguage,
      interests: demo.interests,
    },
    content: truncate(text),
    timestamp: input.createdUtc
      ? new Date(input.createdUtc * 1000).toISOString()
      : new Date().toISOString(),
    url: input.permalink
      ? input.permalink.startsWith('http')
        ? input.permalink
        : `https://reddit.com${input.permalink}`
      : `https://reddit.com/r/${subreddit}/`,
    // A real Devvit event carries score and numComments. When it does not,
    // the count is UNKNOWN -- `?? 1` invented a floor of one upvote for every
    // post that arrived without a score. Reddit exposes no share count at all,
    // so that one is null by nature rather than zero.
    likes: input.score ?? null,
    shares: null,
    replies: input.numComments ?? null,
    inReplyToPostId: input.parentId ? `reddit_devvit_${input.parentId.replace(/^t[13]_/, '')}` : undefined,
    hashtags: extractHashtags(text).length ? extractHashtags(text) : [`#r_${subreddit}`],
    mentionedUsernames: extractMentions(text),
    sentiment,
  };

  const tele = getDevvitTelemetry();
  tele.totalReceived++;
  tele.lastEventTime = new Date().toISOString();
  if (!tele.monitoredSubreddits.includes(subreddit)) {
    tele.monitoredSubreddits.push(subreddit);
  }

  return post;
}

/**
 * Reads a subreddit's PUBLIC Atom feed: https://reddit.com/r/<sub>/.rss
 *
 * This is not Devvit. It is kept in this file because `reddit.ts` and the
 * Devvit ingest route already import it, and because the distinction matters:
 * the Devvit app in `devvit/` is a scaffold whose Reddit implementation is
 * still commented out and which has never been uploaded. When that app is
 * live it will supply real `score`/`numComments` through
 * `devvitEventToPost()` above, and this reader becomes the fallback.
 *
 * Three deliberate constraints, each replacing something the original did:
 *
 * 1. ONE honest User-Agent that identifies this project. The original rotated
 *    at random between two browser UAs and a fake product string, and the
 *    HTML fallback sent `facebookexternalhit/1.1` -- impersonating Facebook's
 *    crawler. Rotating identities to avoid being blocked is evasion, and it is
 *    exactly what Reddit's Responsible Builder Policy exists to stop.
 *
 * 2. Engagement is NULL, because Atom does not carry it. The original wrote
 *    `Math.floor(Math.random() * 450) + 15` for likes and a similar expression
 *    for replies, on all 9,717 posts it collected. Those numbers feed KOL
 *    ranking, trend growth and the amplification dimension; inventing them
 *    corrupts every downstream metric and breaks this project's first rule.
 *
 * 3. No HTML scraping fallback. Parsing the rendered page to get around a
 *    failing feed is the same evasion in a different costume. If the feed does
 *    not answer, the connector reports that it did not answer.
 */
/** HTTP status of the most recent feed read, for honest status reporting. */
let lastFeedStatus = 0;

/** Lets the connector distinguish throttling from a genuine miss. */
export function lastRedditFeedStatus(): number {
  return lastFeedStatus;
}

export async function fetchLiveSubredditStream(
  subredditInput: string = 'technology',
  limit: number = 25
): Promise<SocialPost[]> {
  const subreddit = subredditInput.replace(/^r\//, '').trim() || 'technology';

  try {
    const res = await fetch(
      `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/.rss?limit=${limit}`,
      {
        headers: {
          'User-Agent':
            process.env.REDDIT_USER_AGENT || 'SIH26152-AudienceIntelligence/1.0 (research prototype)',
          Accept: 'application/atom+xml,application/xml,text/xml;q=0.9',
        },
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      // 429 is the common one: Reddit throttles this feed per-IP and does so
      // quickly under repeated calls. Recording it on the module lets the
      // connector report "rate-limited" rather than a blanket "error", so an
      // operator can tell throttling apart from a wrong subreddit name.
      lastFeedStatus = res.status;
      return [];
    }
    lastFeedStatus = 200;

    const xml = await res.text();
    const entries = [...xml.matchAll(/<entry>(.*?)<\/entry>/gs)];
    const posts: SocialPost[] = [];

    for (const entryMatch of entries.slice(0, limit)) {
      const raw = entryMatch[1];
      const title = decodeEntities(raw.match(/<title>([^<]*)<\/title>/)?.[1] || '');
      const authorRaw = raw.match(/<author>\s*<name>([^<]*)<\/name>/)?.[1] || '';
      const author = authorRaw.replace(/^\/?u\//, '').trim();
      const link = raw.match(/<link href="([^"]+)"/)?.[1] || '';
      const updated = raw.match(/<updated>([^<]*)<\/updated>/)?.[1] || '';
      const idMatch = raw.match(/<id>([^<]*)<\/id>/)?.[1] || '';
      const postId = idMatch.split('/').pop() || '';

      // Skip anything we cannot identify rather than minting a synthetic id --
      // a random id creates a post that can never be deduplicated or verified.
      if (!postId || !title) continue;

      const bodyHtml = raw.match(/<content type="html">(.*?)<\/content>/s)?.[1] || '';
      // Decode FIRST, then strip. Atom escapes the body, so `&lt;table&gt;`
      // only becomes a real tag after decoding -- stripping first leaves the
      // markup sitting in the post text.
      const body = decodeEntities(bodyHtml)
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const combined = body && body.length > title.length ? `${title}

${body}` : title;

      const ts = updated ? new Date(updated) : null;
      const sentiment = analyzeSentimentAndEmotion(combined);
      const demo = inferDemographics('', combined);

      posts.push({
        id: `reddit_${postId}`,
        platform: 'reddit',
        author: {
          id: `usr_reddit_${author || 'unknown'}`,
          username: author || 'unknown',
          displayName: author ? `u/${author}` : 'unknown',
          platform: 'reddit',
          followerCount: null,
          verified: false,
          estimatedAgeBracket: demo.estimatedAgeBracket,
          inferredLocation: demo.inferredLocation,
          detectedLanguage: demo.detectedLanguage,
          interests: demo.interests,
        },
        content: truncate(combined),
        timestamp: ts && !Number.isNaN(ts.getTime()) ? ts.toISOString() : new Date().toISOString(),
        url: link || `https://www.reddit.com/r/${subreddit}/`,
        // Atom carries no score or comment count. Null, never a guess.
        likes: null,
        shares: null,
        replies: null,
        hashtags: extractHashtags(combined).length ? extractHashtags(combined) : [`#r_${subreddit}`],
        mentionedUsernames: extractMentions(combined),
        sentiment,
      });
    }

    return posts;
  } catch {
    lastFeedStatus = 0;
    return [];
  }
}

/** Atom escapes markup, so titles and bodies arrive entity-encoded. */
function decodeEntities(t: string): string {
  return t
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}
