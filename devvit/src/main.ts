/**
 * NEXUS Social Intelligence Platform - Devvit App
 *
 * Runs directly on the Reddit Developer Platform (Devvit).
 * Listens to live subreddit events (PostSubmit, CommentSubmit)
 * and streams authentic, live Reddit posts and comments to the NEXUS platform.
 */

// Note: In an installed Devvit environment, Devvit is imported from '@devvit/public-api'
// We define standard types here so the bridge code compiles both within Devvit and in Next.js builds.
export interface DevvitPostEvent {
  id: string;
  title: string;
  body?: string;
  author: string;
  subreddit: string;
  score: number;
  numComments: number;
  createdUtc: number;
  permalink: string;
  url?: string;
}

export interface DevvitCommentEvent {
  id: string;
  body: string;
  author: string;
  subreddit: string;
  postId: string;
  parentId?: string;
  score: number;
  createdUtc: number;
  permalink: string;
}

const NEXUS_ENDPOINT = process.env.NEXUS_ENDPOINT || 'http://localhost:3000/api/devvit/ingest';

export async function sendToNexus(payload: {
  type: 'post' | 'comment' | 'batch';
  data: DevvitPostEvent | DevvitCommentEvent | (DevvitPostEvent | DevvitCommentEvent)[];
}) {
  try {
    const res = await fetch(NEXUS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Source': 'Reddit-Devvit',
      },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.error('[NEXUS Devvit Bridge] Failed to send event to NEXUS:', err);
    return null;
  }
}

// Below is the standard Devvit implementation when running in Reddit Developer Platform environment:
/*
import { Devvit } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
  http: true,
});

// Trigger 1: Real-time Live Post Stream
Devvit.addTrigger({
  event: 'PostSubmit',
  async onEvent(event, context) {
    const post = event.post;
    if (!post) return;

    await sendToNexus({
      type: 'post',
      data: {
        id: post.id,
        title: post.title,
        body: post.body || '',
        author: post.authorName || 'reddit_user',
        subreddit: post.subredditName || 'reddit',
        score: post.score || 1,
        numComments: post.numberOfComments || 0,
        createdUtc: Math.floor(post.createdAt.getTime() / 1000),
        permalink: post.permalink || `https://reddit.com/r/${post.subredditName}/comments/${post.id}`,
        url: post.url,
      },
    });
  },
});

// Trigger 2: Real-time Live Comment Stream
Devvit.addTrigger({
  event: 'CommentSubmit',
  async onEvent(event, context) {
    const comment = event.comment;
    if (!comment) return;

    await sendToNexus({
      type: 'comment',
      data: {
        id: comment.id,
        body: comment.body,
        author: comment.authorName || 'reddit_user',
        subreddit: comment.subredditName || 'reddit',
        postId: comment.postId,
        parentId: comment.parentId,
        score: comment.score || 1,
        createdUtc: Math.floor(comment.createdAt.getTime() / 1000),
        permalink: `https://reddit.com/r/${comment.subredditName}/comments/${comment.postId}/comment/${comment.id}`,
      },
    });
  },
});

// Menu Action: Stream entire Subreddit to NEXUS
Devvit.addMenuItem({
  location: 'subreddit',
  label: 'Stream Subreddit to NEXUS Intelligence',
  onPress: async (_event, context) => {
    const subreddit = await context.reddit.getCurrentSubreddit();
    const posts = await context.reddit.getHotPosts({ subredditName: subreddit.name, limit: 25 }).all();

    const batch: DevvitPostEvent[] = posts.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body || '',
      author: p.authorName || 'reddit_user',
      subreddit: p.subredditName,
      score: p.score,
      numComments: p.numberOfComments,
      createdUtc: Math.floor(p.createdAt.getTime() / 1000),
      permalink: p.permalink,
      url: p.url,
    }));

    await sendToNexus({ type: 'batch', data: batch });
    context.ui.showToast(`Streamed ${batch.length} posts from r/${subreddit.name} to NEXUS!`);
  },
});

export default Devvit;
*/
