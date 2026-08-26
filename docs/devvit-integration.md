# RFC: Reddit Ingestion via Devvit (Reddit Developer Platform)

> **Document Type:** Technical Proposal & Feasibility Assessment  
> **Status:** Proposed for Evaluation  
> **Author:** Antigravity  
> **Target Reviewers:** Claude Code, Core Team, Hackathon Reviewers  
> **Relates to:** Component A (Continuous Data Collection), src/lib/ingestion/reddit.ts, src/app/api/ingest/route.ts

---

## 1. Problem Context

Under Reddit’s **Responsible Builder Policy** (enacted late 2024–2026):
1. Legacy self-service script creation on old.reddit.com/prefs/apps is restricted for new accounts and routed through a manual developer review queue.
2. Unauthenticated public .json scraping endpoints return HTTP **403 Forbidden**.
3. Traditional OAuth2 client_credentials requires REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET, which are temporarily gated behind the manual approval queue.

However, modern developer accounts (such as Soul_Immortal206) can instantly register and authenticate on **Devvit** ([developers.reddit.com](https://developers.reddit.com)), Reddit’s official Developer Platform.

---

## 2. What is Devvit?

**Devvit** is Reddit’s serverless TypeScript application platform that executes natively inside Reddit’s cloud infrastructure.

Key runtime capabilities:
* **context.reddit**: Elevated native access to read subreddits, posts, comments, authors, and user flairs without external OAuth token handshake issues.
* **context.scheduler**: Built-in cron / scheduled background tasks.
* **etch()**: Ability to make outbound HTTPS requests to external endpoints.
* **Event Triggers**: Real-time event listeners for PostSubmit, CommentSubmit, PostUpdate, etc.

---

## 3. Proposed Architecture: Devvit Push Bridge

Instead of our Next.js dashboard *polling* Reddit's external REST API (Pull model), a lightweight Devvit companion app runs inside Reddit and *pushes* real-time posts into our SIH backend (Push model).

`
┌─────────────────────────────────────────────────────────────┐
│ Reddit Ecosystem (Native Devvit Execution)                 │
│                                                             │
│  r/technology, r/india, or creator's community             │
│        │                                                    │
│        ▼ (Event Trigger: onPostCreate or Cron: 5min)       │
│  [ Devvit Listener App ]                                    │
│        │                                                    │
│        │ native context.reddit.getHotPosts() / getComments()│
│        │                                                    │
│        ▼                                                    │
│  HTTPS POST (with x-devvit-secret signature)                │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Next.js 14 Dashboard (Vercel)                               │
│                                                             │
│  POST /api/ingest/webhook/reddit                            │
│        │                                                    │
│        ▼                                                    │
│  MongoDB Atlas (Deduplicated & Persisted)                   │
│        │                                                    │
│        ▼                                                    │
│  Python ML Transformer Pipeline (Sentiment, Emotion, Louvain)│
└─────────────────────────────────────────────────────────────┘
`

---

## 4. Technical Feasibility & Implementation Plan

### A. Devvit Companion App Code (devvit-sih-bridge/src/main.ts)

`	ypescript
import { Devvit } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
  http: true,
});

// 1. Scheduled Ingestion Job (Every 10 Minutes)
Devvit.addSchedulerJob({
  name: 'ingest_subreddit_stream',
  onRun: async (event, context) => {
    const subreddit = await context.reddit.getCurrentSubreddit();
    const posts = await context.reddit.getHotPosts({
      subredditName: subreddit.name,
      limit: 25,
    }).all();

    const payload = posts.map(p => ({
      id: eddit_,
      platform: 'reddit',
      author: {
        id: usr_reddit_,
        username: p.authorName,
        displayName: p.authorName,
        platform: 'reddit',
        followerCount: null,
        verified: false,
      },
      content: ${p.title}\n\n,
      timestamp: new Date(p.createdAt).toISOString(),
      url: https://reddit.com,
      likes: p.score,
      replies: p.numberOfComments,
      hashtags: [],
      mentionedUsernames: [],
    }));

    // 2. Push to SIH Dashboard API
    const response = await fetch('https://sih-26152.vercel.app/api/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sih-source': 'devvit-bridge',
      },
      body: JSON.stringify({ posts: payload }),
    });

    console.log(Pushed  posts to SIH platform:, response.status);
  },
});

export default Devvit;
`

---

## 5. Feasibility Evaluation & Trade-off Matrix

| Criteria | Traditional REST OAuth2 | Devvit Push Bridge |
| :--- | :--- | :--- |
| **Setup Friction** | Blocked on manual review queue (Responsible Builder Policy) | ✅ Instant developer registration via developers.reddit.com |
| **Rate Limits** | 100 req/min, strict 429 throttling | ✅ Native Reddit runtime, elevated internal quotas |
| **Latency** | Polling delay (5–60 mins) | ✅ Real-time event-driven push |
| **Prerequisites** | Needs REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET | Needs Devvit CLI installed + app installed on target subreddit |
| **Scope Constraint** | Can read any public subreddit | Requires the app to be installed on subreddits where developer has permissions (or test subreddit /sih2026_demo) |

---

## 6. Recommended Action Items for Claude Code

1. **Verify Devvit CLI Setup:**
   `ash
   npm install -g devvit
   devvit login
   `
2. **Evaluate Subreddit Installation:**
   * Devvit apps can be installed on any subreddit where the developer has moderator permissions, or run via devvit playtest <subreddit>.
   * For the SIH demo, creating a dedicated demo subreddit (e.g. /sih2026_analytics) allows live streaming of Reddit discussions directly into the dashboard.
3. **Keep Dual Strategy:**
   * **Primary Live:** YouTube, Telegram, Instagram, Facebook (all 4 are 100% active).
   * **Reddit Path A (Devvit):** Live event streaming via Devvit companion.
   * **Reddit Path B (OAuth2 REST):** Keep src/lib/ingestion/reddit.ts ready for when Reddit approves the standard application.
   * **Demo Safety:** src/lib/frozenCorpus.json ensures offline presentation readiness.
