# SIH26-26152: AI-Driven Social Media Analytics Framework

> **National Technical Research Organisation (NTRO)**  
> **Smart India Hackathon 2026 (Software Edition)**  
> *Theme: AI / Security & Surveillance / True Audience Intelligence*

---

## 🌟 Overview

An enterprise-grade, serverless AI Social Media Analytics Framework designed to process raw multi-platform streams (X/Twitter, Telegram, Reddit, YouTube, Instagram, Facebook) and extract multi-dimensional audience intelligence.

```
                       ┌─────────────────────────────────────────────────────────┐
                       │               SIH26-26152 ARCHITECTURE                  │
                       └─────────────────────────────────────────────────────────┘
        [ MUST-HAVE ]                 [ GOOD-TO-HAVE ]              [ APPRECIABLE ]
     ┌──────────────────┐           ┌──────────────────┐          ┌──────────────────┐
     │  X (Twitter)     │           │  Reddit          │          │  YouTube         │
     │  Telegram        │           │  Instagram / FB  │          │  RSS / Live      │
     └────────┬─────────┘           └────────┬─────────┘          └────────┬─────────┘
              │                              │                             │
              └──────────────────────┬─────────────────────────────────────┘
                                     ▼
                    ┌─────────────────────────────────┐
                    │  Unified Normalized Ingestion   │
                    └────────────────┬────────────────┘
                                     ▼
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│  NLP Emotion &   │       │  Automated       │       │  Link Analysis & │
│  Sarcasm Engine  │       │  Demographics    │       │  Network Graph   │
└──────────────────┘       └──────────────────┘       └──────────────────┘
```

---

## 🚀 Core Features (5 Problem Statement Pillars)

1. **A. Multi-Platform Ingestion & Timeline Management**:
   - Live stream connectors for Telegram, Reddit JSON gateway, YouTube Data API v3, and Twitter.
   - Interactive **Timeline Scrubber** with play/pause and chronological playback from $T_0 \to T_n$.

2. **B. Multi-Dimensional Sentiment & Sarcasm Inference**:
   - 7-Vector Emotion Taxonomy (Excitement, Anxiety, Anger, Joy, Fear, Supportive, Opposing).
   - Real-time Sarcasm Index and Stance Balance analysis.

3. **C. Automated Demographic Profiling**:
   - Inferred age brackets (`<18`, `18-24`, `25-34`, `35-50`, `50+`).
   - Geographic distribution across Indian regions and global nodes.
   - Multi-script language detection (English, Hindi, Hinglish, Tamil, Bengali).
   - Professional domain interest clusters.

4. **D. Real-Time Trend & Topic Detection**:
   - Statistical $Z$-Score anomaly and spike detection algorithm.
   - Viral growth rate momentum metrics.

5. **E. Link Analysis & Network Topology**:
   - D3 force-directed physics graph with interactive canvas rendering.
   - PageRank, Betweenness Centrality, and Louvain Community Clustering.
   - Key Opinion Leader (KOL) identification and coordinated botnet detection.
   - Deep-dive Node Dossier drawer.

---

## 🛠️ Tech Stack

- **Frontend & Fullstack Framework:** Next.js 14 (App Router), React 18, TypeScript
- **Styling & UI:** Tailwind CSS, Lucide React, Glassmorphism Cyber-Intel Design
- **Visualizations:** Recharts (Radar, Area, Pie), D3 Force (Canvas Physics Graph)
- **Database & Persistence:** MongoDB Atlas (Mongoose/MongoClient) with Vercel Serverless pooling
- **Deployment:** Vercel (Edge-optimized serverless)

---

## ⚡ Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/Krishna-Das20/SIH-26152.git
cd SIH-26152
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your `MONGODB_URI` and API keys.

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the Intelligence Dashboard.

---

## 📜 License
MIT © SIH 2026 Team
