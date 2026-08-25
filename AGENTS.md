# AGENTS.md — AI Agent Context & Engineering Blueprint

> **Notice for collaborating AI agents (Cursor, Claude, Copilot, Devin, etc.):**
> This document is the architectural ground truth for **SIH26-26152**. Read it
> before changing anything.
>
> **It documents what the code actually does, not what it aspires to do.**
> Anything not yet implemented is listed in §9 as a known gap. If you implement
> something from §9, move it up into the relevant section in the same commit.
> Do not describe an algorithm here that the code does not perform.

---

## 1. Problem statement

* **Hackathon:** Smart India Hackathon 2026 — Software Edition
* **Problem Statement ID:** `SIH26152`
* **Title:** Social Media Analytics
* **Organisation:** National Technical Research Organisation (NTRO)
* **Category / Theme:** Software / Miscellaneous
* **Submission deadline:** 20 September 2026

### Expected solution — the five components, verbatim in intent

**A. Continuous Data Collection & Timeline Management.** Multi-platform
ingestion with a time-stamped historical database. The problem statement ranks
the platforms explicitly, and this ranking drives our priorities:

**All six platforms have working connectors** in `src/lib/ingestion/`. None is
simulated. Whether one is *live* depends only on whether its credentials are
present — check `/api/platforms` for the runtime truth.

| Tier | Platform | Connector | Credentials | Cost |
| :--- | :--- | :--- | :--- | :--- |
| **Essential** | **X (Twitter)** | `x.ts` — API v2 | `X_BEARER_TOKEN` | **paid (~$100/mo)** |
| **Essential** | **Telegram** | `telegram.ts` | none for public channels | **free — live now** |
| Desirable | Instagram | `instagram.ts` — Graph API | `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ID` | free |
| Desirable | Facebook | `facebook.ts` — Graph API | `FACEBOOK_PAGE_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID` | free |
| Appreciable | Reddit | `reddit.ts` — OAuth2 | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` | free (~2 min) |
| Appreciable | YouTube | `youtube.ts` — Data API v3 | `YOUTUBE_API_KEY` | free (~5 min) |

Access reality, all verified 2026-08-25 — **every unauthenticated route is now
closed except Telegram's**:
- Reddit's public JSON gateway returns **403**; old.reddit.com redirects to login.
- X syndication returns **200 with an empty body**; v2 returns 401 without a token.
- Instagram `?__a=1` no longer returns JSON; `web_profile_info` 429s; the Basic
  Display API was retired in Dec 2024.
- Facebook Graph answers `(#200) Provide valid app ID` to anonymous callers.
- YouTube Data API returns 403 without a key.

Setup for every platform: `docs/platform-setup.md`.

**B. Multi-Dimensional Sentiment Inference.** NLP for nuanced emotions
(sarcasm, anxiety, excitement, supportive, against), tracked along the timeline.

**C. Automated Demographic Profiling.** Aggregate, anonymised inference of age
brackets, geography, language, and professional interests.

**D. Real-Time Trend & Topic Detection.** Identify and rank rising trends and
viral keywords chronologically.

**E. Link Analysis & Network Topology.** Map follower relationships, identify
key opinion leaders, visualise how sentiment spreads between segments.

---

## 2. Architecture

Two deployable units. This split is forced by the models: the transformer stack
holds ~2 GB of weights resident, which a serverless function cannot do.

```
┌────────────────────────────┐        ┌──────────────────────────────┐
│  Next.js 14 dashboard      │  HTTP  │  Python ML service (ml/)     │
│  (Vercel, serverless)      │ ─────► │  FastAPI + transformers      │
│                            │        │  MUST run on a real container│
│  ingestion, graph, UI      │ ◄───── │  sentiment/emotion/sarcasm/  │
│  MongoDB persistence       │        │  toxicity/topics/embeddings  │
└────────────────────────────┘        └──────────────────────────────┘
         │                                        ▲
         │ falls back to lexicon engine ──────────┘
         │ when the ML service is unreachable
```

`src/lib/ml/client.ts` is the only bridge. Every call degrades to the local
lexicon engine on timeout or error, and stamps `sentiment.engine` as `'ml'` or
`'lexicon'` so the UI can state which produced a given number.

### Stack

* **Frontend:** Next.js 14 App Router, TypeScript strict, Tailwind
* **Charts:** `recharts`; network graph is hand-rolled HTML5 Canvas + `d3-force`
* **Auth:** NextAuth v4 (Google OAuth + bcrypt credentials)
* **Database:** MongoDB Atlas, pooled client cached on `globalThis`
* **ML:** PyTorch (CPU), HuggingFace transformers, BERTopic, KeyBERT

---

## 3. Live environments

| Resource | URI | Status |
| :--- | :--- | :--- |
| Vercel production | `https://sih-26152.vercel.app/` | 🟢 live |
| GitHub | `https://github.com/Krishna-Das20/SIH-26152` | 🟢 main |
| MongoDB Atlas | `cluster0.nkfwjel.mongodb.net` | 🟢 connected |
| ML service | not yet deployed | 🔴 **local only** |

`ML_API_URL` must point at a deployed ML service before production uses
transformer output. Until then production silently runs on the lexicon
fallback — which works, but is not what the demo should claim.

---

## 4. Codebase map

```
SIH 26152/
├── render.yaml                        # Render blueprint for the ML service
├── src/
│   ├── types/intelligence.ts          # Core types. Fields that may be unknowable
│   │                                  #   (followerCount, location, age, language)
│   │                                  #   are `| null` BY DESIGN — see §5.
│   ├── lib/
│   │   ├── mongodb.ts                 # Pooled client cached on globalThis
│   │   ├── auth.ts                    # NextAuth; FAILS CLOSED when DB is down
│   │   ├── store.ts                   # Memory cache + Atlas persistence
│   │   ├── demoData.ts                # Synthetic seed data (deterministic)
│   │   ├── ml/client.ts               # ★ Bridge to the Python service
│   │   ├── ingestion/
│   │   │   ├── reddit.ts              # Public JSON, no key needed
│   │   │   ├── youtube.ts             # Data API v3, needs YOUTUBE_API_KEY
│   │   │   └── telegram.ts            # t.me web preview + Bot API
│   │   ├── nlp/
│   │   │   ├── emotionEngine.ts       # Lexicon FALLBACK only
│   │   │   └── demographicProfiler.ts # Regex; returns null when unknown
│   │   └── graph/
│   │       ├── networkAnalyzer.ts     # Orchestrates the graph build
│   │       ├── louvain.ts             # ★ Real Louvain (Blondel et al. 2008)
│   │       └── betweenness.ts         # ★ Real Brandes betweenness (2001)
│   ├── components/                    # Dashboard views
│   └── app/api/
│       ├── posts/route.ts             # Real ingested posts for the live feed
│       ├── ingest/route.ts            # Ingestion trigger + manual injection
│       ├── analyze/page/route.ts      # Target scraper (reddit/youtube/telegram)
│       └── analytics/{overview,sentiment,demographics,trends,graph}/
└── ml/                                # Python service — see ml/README.md
    ├── Dockerfile                     # Deploy target (NOT Vercel)
    ├── download_models.py             # Pre-fetch weights
    ├── config.py                      # Model registry
    ├── main.py                        # FastAPI app
    └── {sentiment,emotion,sarcasm,toxicity,topics,trends,embeddings}/
```

---

## 5. Non-negotiable engineering rule: never fabricate a metric

The sponsor is an intelligence agency. A number an analyst cannot trust is
worse than no number.

**Do not use `Math.random()` (or any synthetic default) anywhere in an analysis
path.** If a value cannot be determined, return `null` and render it as
"Unknown". This is enforced by types: `followerCount`, `inferredLocation`,
`estimatedAgeBracket`, and `detectedLanguage` are all nullable.

An earlier revision violated this in seven places — random confidence scores,
randomly assigned cities, randomly generated graph edges that then fed
PageRank, invented follower counts that drove KOL ranking, random trend growth
rates. All have been removed. Do not reintroduce them.

Corollary: the API reports **coverage** and **method**. `/api/analytics/
demographics` returns the share of authors each attribute could be inferred
for; `/api/analytics/trends` returns its bucket size and z-threshold;
`/api/analytics/graph` returns the partition's modularity. A reader can judge
the numbers instead of trusting them.

---

## 6. How the five components are implemented

### A — Ingestion & Timeline
`src/lib/ingestion/`, `src/app/api/{ingest,analyze/page,platforms}/route.ts`

Every connector implements the same `Connector` interface (`types.ts`) and is
registered in `registry.ts`. Connectors run in **parallel and fault-isolated**:
one platform being unconfigured, rate-limited, or down never stops the others.

**The honesty rule for ingestion:** a connector that returns no posts must say
*why*. `ConnectorStatus` distinguishes `missing-credentials`, `unauthorized`,
`rate-limited`, `not-found`, `blocked`, and `error`, so "not configured" is
never rendered as "no activity". A connector must NEVER return fabricated posts
— `npm run verify:connectors` asserts exactly this.

* **Telegram** — `t.me/s/<channel>` preview (no credentials) + Bot API.
* **X** — API v2 user timeline and recent search. Real reply edges via
  `in_reply_to_user_id`.
* **Instagram** — own-account media + comments, and `#hashtag` search.
* **Facebook** — Page feed + comments, with real reply edges.
* **Reddit** — OAuth2 `client_credentials`, token cached on `globalThis`.
* **YouTube** — accepts a video, an `@channel`, or a search phrase.

Timestamps are normalised to ISO-8601. All analytics routes accept
`?cutoffTime=` for timeline replay, and drop unparseable timestamps rather than
letting `NaN` propagate.

### B — Sentiment & Emotion
`ml/` (primary) → `src/lib/nlp/emotionEngine.ts` (fallback)

* Sentiment: `cardiffnlp/twitter-roberta-base-sentiment-latest`
* Emotion: `SamLowe/roberta-base-go_emotions` (28 labels)
* Sarcasm: `helinivan/multilingual-sarcasm-detector`
* Toxicity: `unitary/toxic-bert`

The GoEmotions taxonomy does not match this project's `EmotionType`. The
mapping lives in `mapEmotion()` in `src/lib/ml/client.ts`: GoEmotions `fear` →
our `anxiety`, `love`/`optimism` → `supportive`, and so on.

**Stance is a documented heuristic, not a model output.** `deriveStance()`
infers it from polarity plus supportive/hostile emotion mass. A fine-tuned
stance classifier is the correct fix (§9); until then, call it inferred stance.

### C — Demographic Profiling
`src/lib/nlp/demographicProfiler.ts`

Regex and lexicon based, with **no ML behind it yet** — this is the weakest
component and the largest remaining gap (§9). Age from slang density, geography
from word-boundary city matching, language from Unicode script ranges plus a
Hinglish marker list, interests from keyword sets. Every field returns `null`
when no evidence is found.

### D — Trend & Topic Detection
`src/app/api/analytics/trends/route.ts`

Genuine rolling **z-score**: the timeline is bucketed hourly, and a keyword is
flagged as a spike when its latest bucket exceeds its own historical mean by
≥ 2.0 standard deviations. Growth compares the trailing half of the window to
the leading half. The response includes the parameters used.

### E — Link Analysis & Network Topology
`src/lib/graph/`

* **Edges** come only from observed replies and mentions. Nothing synthesised.
* **PageRank** — damped power iteration (d=0.85), with dangling-node mass
  redistribution and early exit on convergence.
* **Betweenness** — real Brandes (2001), O(V·E), normalised to [0,1].
* **Communities** — real Louvain (Blondel et al. 2008), two-phase with
  aggregation. Reported alongside Newman-Girvan modularity Q so the partition's
  quality is visible. Community names are derived from members' actual dominant
  hashtags.
* **Influence score** blends PageRank, betweenness, in-degree, and reach —
  reweighting to structure alone on platforms that expose no follower count.

---

## 7. Environment variables

See `.env.example`. Two that matter most:

* `NEXTAUTH_SECRET` — **required**, ≥32 chars. The app throws on startup
  without it. There is deliberately no fallback default.
* `ML_API_URL` — where the Python service lives. Defaults to
  `http://127.0.0.1:8000`. Set `ML_ENABLED=false` to force the lexicon path.

---

## 8. Commands

```bash
# Dashboard
npm install && npm run dev            # http://localhost:3000
npx tsc --noEmit                      # type check
npm run verify                        # graph algorithms + connector contracts
npm run build

# ML service (first run downloads ~2 GB of weights)
cd ml
python -m venv .venv && .venv/Scripts/activate     # Windows
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
python download_models.py
uvicorn main:app --port 8000
pytest                                # test suite
```

---

## 9. Known gaps — the honest backlog

Ordered by scoring impact against the problem statement.

1. **Credentials not yet provisioned.** All six connectors are implemented, but
   only Telegram is live. Reddit (~2 min) and YouTube (~5 min) are free and
   should be done first; Instagram and Facebook next; X requires paying for the
   Basic tier. See `docs/platform-setup.md`. **Never mock a platform to make it
   look live** — `npm run verify:connectors` guards this.
2. **Demographic profiling has no ML** (Component C). Regex only. Needs a real
   model, or at minimum an honest accuracy measurement.
3. **Stance classification is heuristic.** The PS names "supportive, against"
   explicitly. Needs a fine-tuned classifier.
4. **No evaluation.** Nothing reports precision/recall for any classifier.
   Hand-label ~200 posts and publish a confusion matrix — it is worth more than
   another chart, and no competing team will have one.
5. **ML service not deployed.** `Dockerfile` and `render.yaml` are ready.
   Until it is deployed, production runs the lexicon fallback.
6. **Facebook cannot read third-party Pages** without Meta App Review and
   business verification (weeks). It reads Pages the token administers.
7. **MTProto Telegram** for full channel history — needs a one-time
   interactive login to mint `TELEGRAM_SESSION`.
8. **No SSE/WebSocket streaming.** The dashboard polls.

---

## 10. Attribution

The `ml/` service was contributed by **Rishiraj-De** via PR #1.
