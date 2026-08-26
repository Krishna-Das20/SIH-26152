import { SocialPost, PlatformType } from '@/types/intelligence';

/**
 * Resolves the direct external link for a social post or comment.
 */
export function getPostUrl(post: Partial<SocialPost>): string | null {
  if (post.url && post.url.startsWith('http')) {
    return post.url;
  }

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
    if (post.url) return post.url;
    return 'https://www.instagram.com/';
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
        url: post.url || 'https://www.instagram.com/',
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

    return {
      url: post.url || null,
      label: 'Parent Thread',
      id: parentId,
    };
  }

  // If YouTube comment URL has &lc=
  if (post.url && post.url.includes('&lc=')) {
    const videoUrl = post.url.split('&lc=')[0];
    const videoId = videoUrl.split('v=')[1] || 'Source Video';
    return {
      url: videoUrl,
      label: 'Source Video',
      id: videoId,
    };
  }

  return null;
}
