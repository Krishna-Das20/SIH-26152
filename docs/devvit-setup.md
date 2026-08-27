# Reddit Devvit Platform Integration Guide

This document explains how the NEXUS Social Intelligence Platform integrates with **Reddit Devvit** (Reddit's official Developer Platform) to stream real-time Reddit posts and comments directly into the intelligence engine.

---

## 1. Overview: What is Devvit?
[Devvit](https://developers.reddit.com/) is Reddit's official app ecosystem. Devvit applications run directly inside Reddit's infrastructure with native access to the Reddit event bus and APIs:
- `PostSubmit` trigger: Triggers in real time when any post is submitted.
- `CommentSubmit` trigger: Triggers in real time when any comment is submitted.
- Native Subreddit APIs: `context.reddit.getHotPosts()`, `context.reddit.getNewPosts()`, and `context.reddit.getComments()`.
- HTTP Fetch: Devvit apps can stream events directly to external Webhook endpoints like NEXUS.

---

## 2. Directory Structure
The repository includes a ready-to-deploy Devvit app package under `devvit/`:

```
devvit/
├── devvit.yaml         # Reddit Developer Platform app manifest and permissions
├── package.json        # Dependencies (@devvit/public-api)
└── src/
    └── main.ts         # Event triggers and NEXUS HTTP sync bridge
```

---

## 3. How NEXUS Ingests Live Reddit Data

NEXUS supports two simultaneous ingestion modes:

### Mode A: Real-Time Webhook Receiver (`POST /api/devvit/ingest`)
When installed on any subreddit, the Devvit app sends live `PostSubmit` and `CommentSubmit` payloads directly to:
```
POST /api/devvit/ingest
```
NEXUS immediately:
1. Validates the incoming Reddit event.
2. Normalizes it into the canonical `SocialPost` schema (`reddit_devvit_<id>`).
3. Runs the ML/NLP sentiment and `GoEmotions` model.
4. Appends it to the live stream and updates all volatility and sentiment radar cards.

### Mode B: On-Demand Devvit Live Stream Bridge
You can also trigger real-time subreddit streaming on demand directly from the NEXUS UI or via API:
```bash
curl -X POST http://localhost:3000/api/devvit/ingest \
  -H "Content-Type: application/json" \
  -d '{"subreddit": "technology", "limit": 25}'
```
This queries the live Reddit feed, bypasses rate limits using Devvit bridge headers, and ingests authentic, currently trending Reddit discussions.

---

## 4. Deploying the Devvit App to Reddit (Optional for Mod Teams)

To deploy the NEXUS Devvit app to a subreddit:

1. **Install Devvit CLI**:
   ```bash
   npm install -g devvit
   ```

2. **Log in to Reddit Developer Platform**:
   ```bash
   devvit login
   ```

3. **Navigate to the devvit folder**:
   ```bash
   cd devvit
   npm install
   ```

4. **Upload and install to your test subreddit**:
   ```bash
   devvit upload
   devvit playtest <your_subreddit_name>
   ```

Any new post or comment submitted to that subreddit will now immediately stream live into the NEXUS intelligence dashboard!
