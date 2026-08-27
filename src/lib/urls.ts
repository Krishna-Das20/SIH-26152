import { SocialPost, PlatformType } from '@/types/intelligence';

/**
 * Returns `u` only if it is a real http(s) URL, otherwise null.
 *
 * Every value in this module that comes from `post.url` MUST pass through here
 * before it is returned, because the return values land straight in `href`
 * attributes (PlatformFeed, MutationBreakpointDrawer, the narrative dossier).
 * React does not block `javascript:` hrefs -- it warns and renders the
 * attribute anyway -- and `target="_blank"` does not help either, since
 * browsers ignore `target` for `javascript:` and run it in the current
 * document. So an unchecked `post.url` in an href is executable script.
 *
 * `post.url` is NOT trustworthy: for web-preview ingests it is scraped from
 * the `og:url` meta tag of a fetched page, and posts stored through
 * /api/ingest carry no ownerUserId, so they render for every anonymous
 * visitor to the demo dashboard. That makes an unchecked value stored,
 * cross-user XSS rather than self-XSS.
 *
 * `startsWith('http')` is NOT an adequate check on its own -- `httpfoo:` and
 * `javascript:x//http` both pass it. Parse the protocol instead.
 */
function safeExternal(u?: string | null): string | null {
  if (!u) return null;
  try {
    const { protocol } = new URL(u);
    return protocol === 'https:' || protocol === 'http:' ? u : null;
  } catch {
    return null;
  }
}

/**
 * Resolves the direct external link for a social post or comment.
 *
 * URLs built from `post.id` below are safe by construction -- they are always
 * interpolated after a literal `https://` origin, so no id can change the
 * scheme. Only the `post.url` paths need filtering.
 */
export function getPostUrl(post: Partial<SocialPost>): string | null {
  const direct = safeExternal(post.url);
  if (direct) return direct;

  const id = post.id || '';
  const platform = post.platform || 'youtube';

  if (platform === 'youtube') {
    if (id.startsWith('yt_video_')) {
      return `https://www.youtube.com/watch?v=${id.replace('yt_video_', '')}`;
    }
    if (id.startsWith('yt_')) {
      const cleanId = id.replace('yt_', '');
      if (post.inReplyToPostId?.startsWith('yt_video_')) {
        const videoId = post.inReplyToPostId.replace('yt_video_', '');
        return `https://www.youtube.com/watch?v=${videoId}&lc=${cleanId}`;
      }
      return `https://www.youtube.com/watch?v=${cleanId}`;
    }
  }

  if (platform === 'telegram') {
    if (id.startsWith('tg_')) {
      const parts = id.replace('tg_', '').split('_');
      if (parts.length >= 2) {
        return `https://t.me/${parts[0]}/${parts[1]}`;
      }
      return `https://t.me/${parts[0]}`;
    }
  }

  if (platform === 'instagram') {
    return safeExternal(post.url) || 'https://www.instagram.com/';
  }

  if (platform === 'reddit') {
    return 'https://reddit.com/';
  }

  if (platform === 'x') {
    return 'https://x.com/';
  }

  return null;
}

/**
 * Resolves the parent source post/video from which a comment was added.
 */
export function getParentSource(post: Partial<SocialPost>): {
  url: string | null;
  label: string;
  id: string;
} | null {
  // If explicitly a comment / reply to a parent post
  if (post.inReplyToPostId) {
    const parentId = post.inReplyToPostId;

    if (parentId.startsWith('yt_video_')) {
      const videoId = parentId.replace('yt_video_', '');
      return {
        url: `https://www.youtube.com/watch?v=${videoId}`,
        label: 'Source Video',
        id: videoId,
      };
    }

    if (parentId.startsWith('ig_')) {
      return {
        url: safeExternal(post.url) || 'https://www.instagram.com/',
        label: 'Source Reel / Post',
        id: parentId,
      };
    }

    if (parentId.startsWith('tg_')) {
      const parts = parentId.replace('tg_', '').split('_');
      return {
        url: parts.length >= 2 ? `https://t.me/${parts[0]}/${parts[1]}` : `https://t.me/${parts[0]}`,
        label: 'Original Dispatch',
        id: parentId,
      };
    }

    // Reached for any platform whose parent id has no known prefix, so this
    // is not an Instagram-only sink.
    return {
      url: safeExternal(post.url),
      label: 'Parent Thread',
      id: parentId,
    };
  }

  // If YouTube comment URL has &lc=
  const commentUrl = safeExternal(post.url);
  if (commentUrl && commentUrl.includes('&lc=')) {
    const videoUrl = commentUrl.split('&lc=')[0];
    const videoId = videoUrl.split('v=')[1] || 'Source Video';
    return {
      url: videoUrl,
      label: 'Source Video',
      id: videoId,
    };
  }

  return null;
}
