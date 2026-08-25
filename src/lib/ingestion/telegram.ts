import { SocialPost } from '@/types/intelligence';
import { analyzeSentimentAndEmotion } from '@/lib/nlp/emotionEngine';
import { inferDemographics } from '@/lib/nlp/demographicProfiler';
import { enrichPosts } from '@/lib/ml/client';
import { Connector, ConnectorResult } from './types';

/**
 * Telegram ingestion (Component A, Essential platform).
 *
 * Telegram exposes public channel content through two very different routes,
 * and which one is available depends entirely on credentials:
 *
 *   1. Bot API (TELEGRAM_BOT_TOKEN) -- simple HTTP, but a bot only receives
 *      messages from chats it has been ADDED TO. It cannot read an arbitrary
 *      public channel it is not a member of. Useful for monitoring channels
 *      you control or have been invited to.
 *
 *   2. Public web preview (no credentials) -- t.me/s/<channel> serves a static
 *      HTML preview of any public channel. No auth, no rate-limit headers, but
 *      it is HTML scraping and will break if Telegram changes its markup. It
 *      returns recent messages only, not full history.
 *
 * Full historical access needs MTProto (TELEGRAM_API_ID / TELEGRAM_API_HASH)
 * via a library like GramJS. That requires an interactive phone-number login
 * to mint a session string, which cannot happen inside a serverless request --
 * it is a one-time local step whose output is stored as TELEGRAM_SESSION.
 * See `docs/telegram-setup.md`. Until that session exists, this module uses
 * route 2 and reports honestly which route produced the data.
 */

export type TelegramSource = 'web-preview' | 'bot-api' | 'unavailable';

export interface TelegramIngestResult {
  posts: SocialPost[];
  source: TelegramSource;
  note?: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  quot: '"', apos: "'", amp: '&', lt: '<', gt: '>', nbsp: ' ',
  hellip: '\u2026', mdash: '\u2014', ndash: '\u2013',
  laquo: '\u00ab', raquo: '\u00bb', deg: '\u00b0', euro: '\u20ac', pound: '\u00a3',
};

/** Guards against a malformed entity producing a RangeError. */
function safeCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/**
 * Strips HTML tags and decodes entities from Telegram's preview markup.
 *
 * Telegram DOUBLE-ESCAPES: the raw preview HTML contains `&amp;#036;` for a
 * literal '$'. A single decode pass turns that into `&#036;` and stops, which
 * then leaks into hashtag extraction as the bogus topic "#036" (and "#33" from
 * `&amp;#33;`). So the decode runs repeatedly until the string stops changing.
 *
 * The pass count is capped: without a bound, text that legitimately reads
 * "&amp;amp;" would be unwound further than the author intended, and a crafted
 * input could loop for a long time. Two passes covers the double-escaping
 * Telegram actually emits.
 */
function decodeEntities(text: string, maxPasses = 2): string {
  let out = text;
  for (let pass = 0; pass < maxPasses; pass++) {
    const next = out
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(parseInt(dec, 10)))
      .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
    if (next === out) break; // stable
    out = next;
  }
  return out;
}

function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Parses "1.2K" / "3.4M" view counts into a number. */
function parseCount(raw: string | undefined): number {
  if (!raw) return 0;
  const text = raw.trim().toUpperCase();
  const value = parseFloat(text);
  if (Number.isNaN(value)) return 0;
  if (text.includes('K')) return Math.round(value * 1_000);
  if (text.includes('M')) return Math.round(value * 1_000_000);
  return Math.round(value);
}

function extractHashtags(text: string): string[] {
  return Array.from(new Set(text.match(/#[\p{L}0-9_]+/gu) || []));
}

function extractMentions(text: string): string[] {
  return Array.from(new Set((text.match(/@[a-zA-Z0-9_]{4,}/g) || []).map((m) => m.slice(1))));
}

/**
 * Scrapes recent messages from a public channel's web preview.
 *
 * @param channel Channel username, with or without a leading @ or t.me/ prefix.
 */
async function fetchFromWebPreview(channel: string, limit: number): Promise<SocialPost[]> {
  const handle = channel
    .replace(/^https?:\/\/(t\.me|telegram\.me)\/(s\/)?/i, '')
    .replace(/^@/, '')
    .split('/')[0]
    .trim();

  if (!handle) return [];

  const res = await fetch(`https://t.me/s/${encodeURIComponent(handle)}`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    next: { revalidate: 120 },
  });

  if (!res.ok) {
    console.warn(`Telegram preview for @${handle} returned ${res.status}`);
    return [];
  }

  const html = await res.text();

  // Each message is a `tgme_widget_message` wrapper. Parsing with regex rather
  // than a DOM library keeps this dependency-free; the shapes below are the
  // stable parts of the markup (data attributes, not styling classes).
  const messageBlocks = html.split('class="tgme_widget_message ').slice(1);
  const posts: SocialPost[] = [];

  for (const block of messageBlocks.slice(0, limit)) {
    const idMatch = block.match(/data-post="([^"]+)"/);
    if (!idMatch) continue;
    const postPath = idMatch[1]; // e.g. "channelname/1234"

    const textMatch = block.match(
      /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/
    );
    const content = textMatch ? stripHtml(textMatch[1]) : '';
    if (!content) continue; // media-only posts carry no text to analyse

    const timeMatch = block.match(/<time[^>]+datetime="([^"]+)"/);
    const timestamp = timeMatch ? new Date(timeMatch[1]).toISOString() : new Date().toISOString();

    const viewsMatch = block.match(/<span class="tgme_widget_message_views">([^<]+)<\/span>/);
    const views = parseCount(viewsMatch?.[1]);

    const authorMatch = block.match(/<div class="tgme_widget_message_author[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const displayName = authorMatch ? stripHtml(authorMatch[1]) : `@${handle}`;

    const sentiment = analyzeSentimentAndEmotion(content);
    const demo = inferDemographics('', content);

    posts.push({
      id: `tg_${postPath.replace('/', '_')}`,
      platform: 'telegram',
      author: {
        id: `usr_tg_${handle}`,
        username: handle,
        displayName: displayName || `@${handle}`,
        platform: 'telegram',
        // Channel subscriber counts are not exposed on the message preview.
        followerCount: null,
        verified: false,
        estimatedAgeBracket: demo.estimatedAgeBracket,
        inferredLocation: demo.inferredLocation,
        detectedLanguage: demo.detectedLanguage,
        interests: demo.interests,
      },
      content: content.length > 400 ? `${content.slice(0, 400)}...` : content,
      timestamp,
      url: `https://t.me/${postPath}`,
      // Telegram channels have no like/share primitives; views is the one real
      // engagement signal, and the rest stay at zero rather than being derived.
      likes: 0,
      shares: 0,
      replies: 0,
      views,
      hashtags: extractHashtags(content).length
        ? extractHashtags(content)
        : [`#tg_${handle}`],
      mentionedUsernames: extractMentions(content),
      sentiment,
    });
  }

  return posts;
}

/**
 * Fetches recent updates visible to a configured bot. Only returns messages
 * from chats the bot has been added to.
 */
async function fetchFromBotApi(limit: number): Promise<SocialPost[]> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return [];

  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=${limit}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    console.warn(`Telegram Bot API returned ${res.status}`);
    return [];
  }

  const json = await res.json();
  if (!json.ok || !Array.isArray(json.result)) return [];

  const posts: SocialPost[] = [];

  for (const update of json.result) {
    const msg = update.message || update.channel_post;
    const content: string = msg?.text || msg?.caption || '';
    if (!msg || !content) continue;

    const chat = msg.chat || {};
    const from = msg.from || {};
    const username: string = from.username || chat.username || `chat_${chat.id}`;

    const sentiment = analyzeSentimentAndEmotion(content);
    const demo = inferDemographics('', content);

    posts.push({
      id: `tg_bot_${chat.id}_${msg.message_id}`,
      platform: 'telegram',
      author: {
        id: `usr_tg_${from.id || chat.id}`,
        username,
        displayName: [from.first_name, from.last_name].filter(Boolean).join(' ') || chat.title || username,
        platform: 'telegram',
        followerCount: null,
        verified: false,
        estimatedAgeBracket: demo.estimatedAgeBracket,
        inferredLocation: demo.inferredLocation,
        detectedLanguage: demo.detectedLanguage,
        interests: demo.interests,
      },
      content: content.length > 400 ? `${content.slice(0, 400)}...` : content,
      timestamp: new Date((msg.date || Date.now() / 1000) * 1000).toISOString(),
      likes: 0,
      shares: msg.forward_date ? 1 : 0,
      replies: 0,
      // Reply chains are the real interaction edges Telegram exposes; feeding
      // them through preserves genuine graph structure.
      inReplyToPostId: msg.reply_to_message
        ? `tg_bot_${chat.id}_${msg.reply_to_message.message_id}`
        : undefined,
      inReplyToAuthorId: msg.reply_to_message?.from?.id
        ? `usr_tg_${msg.reply_to_message.from.id}`
        : undefined,
      hashtags: extractHashtags(content).length ? extractHashtags(content) : ['#telegram'],
      mentionedUsernames: extractMentions(content),
      sentiment,
    });
  }

  return posts;
}

/**
 * Ingests recent Telegram messages.
 *
 * Prefers the public web preview when a channel is named (it works for any
 * public channel with no credentials), and falls back to the Bot API when no
 * channel is given but a bot token is configured.
 */
export async function fetchTelegramPosts(
  channel?: string,
  limit: number = 20
): Promise<TelegramIngestResult> {
  try {
    if (channel) {
      const posts = await fetchFromWebPreview(channel, limit);
      if (posts.length > 0) {
        return { posts: await enrichPosts(posts), source: 'web-preview' };
      }
      return {
        posts: [],
        source: 'unavailable',
        note: `No public messages found for "${channel}". The channel may be private, empty, or media-only.`,
      };
    }

    const botPosts = await fetchFromBotApi(limit);
    if (botPosts.length > 0) {
      return { posts: await enrichPosts(botPosts), source: 'bot-api' };
    }

    return {
      posts: [],
      source: 'unavailable',
      note: process.env.TELEGRAM_BOT_TOKEN
        ? 'Bot API reachable but no updates pending. Add the bot to a channel, or pass a public channel name.'
        : 'Pass a public channel name (e.g. "durov"), or set TELEGRAM_BOT_TOKEN.',
    };
  } catch (err) {
    console.error('Telegram ingestion error:', err);
    return { posts: [], source: 'unavailable', note: String(err) };
  }
}

/**
 * Connector-interface wrapper around the routes above.
 *
 * Telegram is the one Essential platform that needs no credentials at all: the
 * t.me public preview serves any public channel. That makes it the reliable
 * demo path while the credentialed platforms are being provisioned.
 */
export const telegramConnector: Connector = {
  platform: 'telegram',
  displayName: 'Telegram',
  tier: 'essential',
  requiredEnv: [],
  worksWithoutCredentials: true,
  cost: 'none',
  targetHint: 'a public channel name, e.g. "durov" or a t.me/<channel> URL',
  setupDoc: 'docs/telegram-setup.md',
  notes:
    'Public channels work with no credentials via the t.me preview. A bot token ' +
    'additionally reads chats the bot has joined. Full history needs MTProto.',

  async fetch(target, limit = 25): Promise<ConnectorResult> {
    const result = await fetchTelegramPosts(target, limit);
    return {
      platform: 'telegram',
      posts: result.posts,
      status:
        result.source === 'unavailable'
          ? result.posts.length === 0
            ? 'not-found'
            : 'ok'
          : 'ok',
      source: result.source,
      note: result.note,
    };
  },
};
