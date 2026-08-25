# AGENTS.md — AI Agent Context & Engineering Blueprint

> **Notice for Collaborating AI Agents (Cursor, Claude, Copilot, Antigravity, Devin, etc.):**  
> This document provides the complete architectural ground-truth, design decisions, database schemas, active endpoints, and ongoing roadmap for **SIH26-26152**. Read this file first before making changes or writing new modules.

---

## 1. Project Identity & Problem Statement Context

* **Hackathon:** Smart India Hackathon (SIH) 2026 — Software Edition
* **Problem Statement ID:** `SIH26-26152`
* **Problem Title:** AI-Driven Social Media Analytics Framework
* **Sponsoring Agency:** **National Technical Research Organisation (NTRO)** *(Premier technical intelligence agency under National Security Advisor, PMO)*
* **Domain / Theme:** Smart Automation / Security & Intelligence / OSINT & Graph Topology
* **Core Objective:** Design a multi-platform audience intelligence system combining 5 vectors:
  1. **Continuous Data Collection & Timeline Management** (X, Telegram, Reddit, YouTube, Instagram, Facebook)
  2. **Multi-Dimensional Sentiment Inference** (Nuanced emotions, Sarcasm detection, Stance classification)
  3. **Automated Demographic Profiling** (Inferred age brackets, Geographic distribution, Language, Interests)
  4. **Real-Time Trend & Topic Detection** ($Z$-score spike scoring, viral keyword momentum)
  5. **Link Analysis & Network Topology** (PageRank, Betweenness Centrality, Louvain Community Detection, Key Opinion Leaders)

---

## 2. Live Environments & Deployment Links

| Resource | URI / Location | Status |
| :--- | :--- | :--- |
| **Live Vercel Production URL** | `https://sih-26152.vercel.app/` | 🟢 Live & Active |
| **Authentication Page** | `https://sih-26152.vercel.app/auth/signin` | 🟢 Live |
| **GitHub Repository** | `https://github.com/Krishna-Das20/SIH-26152` | 🟢 Main Branch |
| **MongoDB Atlas Cluster** | `cluster0.nkfwjel.mongodb.net` (DB: `sih26152`) | 🟢 Connected |
| **Vercel Project Dashboard** | `https://vercel.com/krishna-das20s-projects/sih-26152` | 🟢 Synced |

---

## 3. Technology Stack & Framework Choices

* **Fullstack Framework:** **Next.js 14** (App Router, Serverless Edge-Optimized for Vercel)
* **Language:** **TypeScript** (Strict Mode, 100% Type-Safe)
* **Styling & UI:** **Tailwind CSS**, Lucide React, Glassmorphism Cyber-Intel Design System
* **Data Visualization:**
  * **Network Topology Graph:** Interactive HTML5 Canvas + `d3-force` physics engine (supports dragging, canvas pan, wheel zoom, Louvain community color schemes, and isolated pill labels).
  * **Charts:** `recharts` (Radar for 7-vector emotions, Area chart for temporal sarcasm flow, Donut for stance orientation).
* **Authentication:** **NextAuth.js (v4)** with Google OAuth 2.0 Provider and Credentials Provider (`bcryptjs` password hashing).
* **Database / Data Lake:** **MongoDB Atlas** via official `mongodb` client with connection pooling and in-memory serverless cache fallback.

---

## 4. Directory & Codebase Map

```
SIH 26152/
├── .env.example                       // Template environment variables
├── .gitignore                         // Strictly excludes .env and build output
├── package.json                       // Dependencies (Next.js, D3-Force, Recharts, NextAuth, MongoDB)
├── tsconfig.json                      // Path alias configuration (@/* -> ./src/*)
├── tailwind.config.ts                 // Intel custom color palette (cyan, emerald, amber, rose, purple)
├── next.config.mjs                    // Production Next.js config
├── README.md                          // Human-readable project overview
├── AGENTS.md                          // THIS FILE (AI Agent Context)
│
└── src/
    ├── types/
    │   ├── intelligence.ts            // Core types (SocialPost, GraphNode, GraphLink, NetworkTopology, EmotionMetrics)
    │   └── auth.ts                    // NextAuth UserAccount and Session types
    │
    ├── lib/
    │   ├── mongodb.ts                 // Cached MongoDB Atlas MongoClient connection pool
    │   ├── auth.ts                    // NextAuth configuration (Google OAuth + Credentials + Atlas lookup)
    │   ├── store.ts                   // Unified data store (Memory cache + MongoDB persistence)
    │   ├── demoData.ts                // Baseline simulation dataset with 60+ chronological events
    │   ├── ingestion/
    │   │   ├── reddit.ts              // Live Reddit public JSON stream scraper (Zero API key needed)
    │   │   └── youtube.ts             // Google Cloud YouTube Data API v3 comment scraper
    │   ├── nlp/
    │   │   ├── emotionEngine.ts       // 7-vector Nuanced Emotion taxonomy, Sarcasm detector & Stance
    │   │   └── demographicProfiler.ts // SpaCy/Regex Age, Geography, Language & Interest extractor
    │   └── graph/
    │       └── networkAnalyzer.ts     // PageRank, Centrality, Louvain Communities & Diffusion simulation
    │
    ├── components/
    │   ├── Navbar.tsx                 // Header with NTRO badge, platform tabs, user session avatar, sign in/out
    │   ├── OverviewMetrics.tsx        // 6 Top-Level KPI cards (Posts, Nodes, Sentiment, Sarcasm, Stance, Threat)
    │   ├── PageAnalyzerInput.tsx      // Real Target Page & Subreddit OSINT Scraper (Zero Dummy Data)
    │   ├── TimelineScrubber.tsx       // Interactive Chronological Time Player (T0 -> Tn with 1x, 2x, 5x)
    │   ├── NetworkGraphView.tsx       // D3-Force Canvas graph (Drag nodes, zoom, pan, community colors)
    │   ├── SentimentEmotionView.tsx   // Emotion Radar, Sarcasm Flow area chart, Stance balance
    │   ├── DemographicRadarView.tsx   // Age pyramid, Geo distribution, Language & Domain affinities
    │   ├── TrendTopicDetector.tsx     // Viral topic cards with Z-score spike indicators
    │   ├── LiveFeedStream.tsx         // Filterable raw post stream + manual test post injection
    │   └── NodeDetailsDrawer.tsx      // Slide-over Node Dossier inspection drawer
    │
    └── app/
        ├── layout.tsx                 // RootLayout wrapped with <Providers> (SessionProvider)
        ├── page.tsx                   // Main Intelligence Command Center connecting all components
        ├── providers.tsx              // Client SessionProvider wrapper
        ├── globals.css                // Cyber-intelligence dark mode styles and custom scrollbars
        │
        ├── auth/
        │   └── signin/page.tsx        // Login & Registration screen (Google 1-click + Email credentials)
        │
        └── api/
            ├── auth/
            │   ├── [...nextauth]/route.ts  // NextAuth authentication handler
            │   └── register/route.ts       // Email/password user signup with bcrypt hash in Atlas
            ├── ingest/route.ts             // Ingestion trigger & manual post injection
            ├── analyze/page/route.ts       // Real page scraper (Reddit/YouTube/Telegram/Twitter)
            └── analytics/
                ├── overview/route.ts       // Overview KPIs & threat volatility scoring
                ├── sentiment/route.ts      // Nuanced emotion radar & sarcasm temporal curves
                ├── demographics/route.ts   // Age, Geo, Language, and Interest aggregations
                ├── trends/route.ts         // Real-time trending keywords & spike detection
                └── graph/route.ts          // Network topology nodes, links, communities & KOLs
```

---

## 5. Environment Variables & Secret Configuration

The project uses the following environment variables (defined in `.env` and Vercel Project Settings):

```env
# MONGODB ATLAS (Active Production Cluster)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.nkfwjel.mongodb.net/sih26152?retryWrites=true&w=majority

# NEXTAUTH & GOOGLE OAUTH
NEXTAUTH_URL=https://sih-26152.vercel.app
NEXTAUTH_SECRET=your_nextauth_secret_key
GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret

# TELEGRAM (MTProto Ingestion)
TELEGRAM_API_ID=your_telegram_api_id
TELEGRAM_API_HASH=your_telegram_api_hash
TELEGRAM_PHONE=

# REDDIT (Optional API - Native Public JSON Gateway active by default)
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USER_AGENT=SIH2026_Monitor:v1.0

# YOUTUBE (Google Cloud Data API v3)
YOUTUBE_API_KEY=
```

---

## 6. How the 5 Core Pillars Are Implemented

### Component A: Ingestion & Timeline Management
* **Location:** `src/lib/ingestion/`, `src/app/api/analyze/page/route.ts`, `src/components/TimelineScrubber.tsx`
* **Mechanism:** 
  * Ingests real posts from Reddit public JSON (`https://www.reddit.com/r/<sub_name>/hot.json`), YouTube comment threads, Telegram MTProto feeds, and Twitter streams.
  * Normalizes all posts into ISO-8601 timestamps and indexes them chronologically.
  * The **Timeline Scrubber** filters all analytics APIs using `?cutoffTime=ISO_TIMESTAMP`, allowing real-time step-through replay from $T_0$ to $T_n$.

### Component B: Multi-Dimensional Sentiment Inference
* **Location:** `src/lib/nlp/emotionEngine.ts`, `src/components/SentimentEmotionView.tsx`
* **Mechanism:**
  * Detects 7 nuanced emotion classes: `Excitement`, `Anxiety`, `Anger`, `Joy`, `Fear`, `Supportive`, `Against`.
  * Sarcasm detection using linguistic markers (`oh great`, `slow clap`, quotation ironies, emoji sarcasm).
  * Stance Classification (`Supportive`, `Opposing`, `Neutral`) determining consensus drift.

### Component C: Automated Demographic Profiling
* **Location:** `src/lib/nlp/demographicProfiler.ts`, `src/components/DemographicRadarView.tsx`
* **Mechanism:**
  * **Age Brackets:** `<18`, `18-24`, `25-34`, `35-50`, `50+` (inferred from slang density, emoji frequency, bio keywords).
  * **Geographic Distribution:** SpaCy NER mapping location entities to Indian metros and global hubs.
  * **Language Detection:** Identifies English, Hindi (Devanagari), Hinglish (Code-Mixed), Tamil, Bengali.
  * **Interest Vectors:** Classifies affinity into Tech & AI, Geopolitics, Finance, Defense, Entertainment.

### Component D: Real-Time Trend & Topic Detection
* **Location:** `src/app/api/analytics/trends/route.ts`, `src/components/TrendTopicDetector.tsx`
* **Mechanism:**
  * Rolling $Z$-score anomaly calculation on keyword frequencies.
  * Flags topics surging $> 150\%$ above baseline as `SPIKE` with viral growth badges and dominant emotions.

### Component E: Link Analysis & Network Topology
* **Location:** `src/lib/graph/networkAnalyzer.ts`, `src/components/NetworkGraphView.tsx`
* **Mechanism:**
  * Builds directed graph of retweets, replies, mentions, and quotes.
  * Power-iteration **PageRank** ($d=0.85$) + Betweenness Centrality to score Key Opinion Leaders (KOLs).
  * **Louvain Modularity Clustering** dividing users into 4 distinct color-coded communities.
  * Botnet detection heuristics (high post velocity with minimal follower reciprocation).
  * Canvas physics with node dragging, zoom/pan, and slide-over Node Dossier inspection.

---

## 7. Working Commands & Verification

### Local Development:
```bash
npm run dev
# Starts local server at http://localhost:3000
```

### Production Build & Type Check:
```bash
npm run build
# Verified with 0 errors across all 13 routes and static pages
```

### Git Workflow:
```bash
git add .
git commit -m "feat(module): description"
git push origin main
# Vercel automatically deploys every push to https://sih-26152.vercel.app
```

---

## 8. Immediate Next Roadmap Items for Incoming Agents

If you are continuing development, prioritize these tasks:

1. **Multi-User OAuth Account Connector (1st-Party Insights):**
   - Add a `/settings/accounts` page with 1-click OAuth buttons for Instagram Business Login (`instagram_manage_insights`), YouTube (`youtube.readonly`), and Reddit.
   - Save connected tokens in the MongoDB `users` collection to allow creators to view their private reach alongside public OSINT.

2. **Automated Intelligence Dossier Export:**
   - Add an "Export Intelligence Report" button generating downloadable PDF/JSON summaries for security analysts.

3. **Live WebSocket / SSE Real-Time Streaming:**
   - Upgrade `/api/stream` to Server-Sent Events (SSE) to push newly ingested tweets/comments directly to the UI without manual page refresh.
