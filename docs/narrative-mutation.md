# Narrative Mutation Tracker

> **Status:** MVP  
> **Location:** `src/lib/narratives/`, `src/app/api/analytics/narratives/`  
> **Added:** 2026-08-25

---

## 1. Problem

Social media narratives evolve across platforms and time. A statement like
"AI will improve software development" can mutate through "AI will replace
developers" to "developers are losing jobs because of AI". Each step carries
a shift in sentiment, emotion, keywords, and semantic meaning.

Existing sentiment and trend analytics show *what people feel* and *what's
trending*, but not *how a narrative changes* across platforms and time.

The Narrative Mutation Tracker fills this gap.

---

## 2. Architecture

```
┌─────────────────────┐     POST /embeddings     ┌──────────────────────┐
│  Next.js Dashboard   │ ──────────────────────►  │  Python ML Service   │
│                      │  ◄───────────────────── │  all-MiniLM-L6-v2    │
│  src/lib/narratives/ │     384-dim vectors      │  (loaded once at     │
│  • clustering.ts     │                          │   startup)           │
│  • mutations.ts      │                          └──────────────────────┘
│  • analyzer.ts       │
│  • titleGenerator.ts │
└─────────────────────┘
        │
        ▼
  GET /api/analytics/narratives
  GET /api/analytics/narratives/:id
  GET /api/analytics/narratives/:id/timeline
  POST /api/analytics/narratives (re-analyze)
```

---

## 3. Embedding Model

**Model:** `all-MiniLM-L6-v2` (sentence-transformers)  
**Dimension:** 384  
**Size:** ~80 MB  
**Why:** Already configured in `ml/config.py`, loaded at startup by the
existing pipeline. No new dependency.

The model is loaded **once** at service startup and reused for every request.
Embeddings are cached in-memory on the Next.js side keyed by post ID.

---

## 4. Clustering Approach

**Algorithm:** Union-Find (Disjoint Set) Connected Components  
**Threshold:** Configurable via `NARRATIVE_SIMILARITY_THRESHOLD` env var (default: 0.70)

### Why not DBSCAN/HDBSCAN?

- Union-Find is fully **deterministic** (no random seed)
- Only **one parameter** (similarity threshold) — transparent and auditable
- O(n²) pairwise similarity is trivial for ~200 posts
- No `min_samples` ambiguity

### Process

1. Generate 384-dim embeddings for all post texts
2. Compute pairwise cosine similarity matrix
3. Union posts where similarity ≥ threshold
4. Extract connected components with ≥ 2 posts
5. Generate stable narrative ID from sorted post IDs (djb2 hash)

### Minimum Narrative Size

A cluster of 1 post is just a post. Minimum size is **2 posts**.

---

## 5. Semantic Mutation

**Formula:**

```
semantic_shift = (1 − cosine_similarity(early_centroid, late_centroid)) × 100
```

Clamped to [0, 100].

- **early_centroid:** Mean embedding of posts in the first half (chronological)
- **late_centroid:** Mean embedding of posts in the second half

This measures how much the *meaning* of the narrative changed, not just
keywords or sentiment.

**Returns null** if fewer than 2 posts have embeddings.

---

## 6. Sentiment Mutation

**Formula:**

```
sentiment_shift = TVD(early_distribution, late_distribution) × 100
```

Where TVD is **Total Variation Distance** = 0.5 × Σ|P(label) − Q(label)|
over {positive, negative, neutral}.

This is a proper probability distribution distance metric, not a heuristic.

**Returns null** if no sentiment data exists for either stage.

---

## 7. Emotion Mutation

The existing emotion model (`SamLowe/roberta-base-go_emotions`) provides a
categorical dominant emotion. The shift is measured as:

- **Same dominant emotion** early vs late → 0
- **Different dominant emotion** → 100

This is binary because the existing model output is categorical. A richer
distribution-distance calculation could replace this if the model is changed
to expose emotion probabilities in the API response.

**Returns null** if no emotion data exists.

---

## 8. Keyword Mutation

**Formula:**

```
keyword_shift = (1 − Jaccard(early_top5, late_top5)) × 100
```

Where Jaccard similarity = |intersection| / |union|.

Example:
- Early: {AI, coding, developers, productivity}
- Late: {AI, jobs, developers, unemployment}
- Intersection: {AI, developers} → 2
- Union: {AI, coding, developers, productivity, jobs, unemployment} → 6
- Jaccard: 2/6 = 0.333
- Shift: (1 − 0.333) × 100 = 66.7%

Keywords are extracted using term frequency from post content plus
ML-extracted keywords from the existing sentiment analysis pipeline.

**Returns null** if keywords cannot be extracted from either stage.

---

## 9. Mutation Score

**Formula:**

```
mutation_score = 0.40 × semantic_shift
              + 0.25 × sentiment_shift
              + 0.20 × emotion_shift
              + 0.15 × keyword_shift
```

**CRITICAL:** Returns null if **any** component is null. The project has a
strict anti-fabrication rule — a composite score built on missing data is
worse than no score.

The API exposes all individual components so a reader can inspect each one:

```json
{
  "semanticShift": 45.2,
  "sentimentShift": 60.0,
  "emotionShift": 100,
  "keywordShift": 66.7,
  "mutationScore": 61.0
}
```

---

## 10. Platform Progression

For each narrative, posts are sorted by timestamp to produce an
**observed platform sequence**:

```json
[
  { "platform": "youtube", "firstSeen": "...", "postCount": 25 },
  { "platform": "telegram", "firstSeen": "...", "postCount": 10 }
]
```

### Important Distinction

Chronological order establishes: "YouTube was observed before Telegram."

It does **NOT** establish: "YouTube caused the narrative to spread to Telegram."

The system uses terminology like "observed platform sequence" and
"cross-platform narrative progression", never causal claims.

---

## 11. Limitations

1. **Threshold sensitivity:** The similarity threshold (0.70) is configurable
   but may need tuning per domain. A multilingual corpus may need a lower
   threshold.

2. **Emotion shift is binary.** The current emotion model provides categorical
   output, so emotion shift is 0 or 100. A probability-based model would
   enable a richer metric.

3. **Small corpus.** The frozen corpus has 201 posts (161 YouTube + 40
   Telegram). Narrative clusters may be few or absent if posts aren't
   semantically similar above the threshold.

4. **ML service required.** Embeddings require the Python ML service. Without
   it, narrative analysis returns an empty result — never fabricated data.

5. **No causal inference.** Platform sequence is temporal, not causal.

6. **Mutation score weights are initial values.** The 40/25/20/15 split is
   a reasonable starting point, not empirically validated. Adjust weights
   based on domain expertise.

---

## 12. Example API Request

```bash
# List all narratives
curl http://localhost:3000/api/analytics/narratives

# Single narrative detail
curl http://localhost:3000/api/analytics/narratives/N1A2B3C

# Narrative timeline
curl http://localhost:3000/api/analytics/narratives/N1A2B3C/timeline

# Force re-analysis
curl -X POST http://localhost:3000/api/analytics/narratives
```

---

## 13. Example API Response

```json
{
  "mode": "shared",
  "narratives": [
    {
      "id": "N1A2B3C",
      "title": "AI coding tools and software development",
      "postIds": ["yt_001", "yt_002", "tg_003"],
      "platforms": ["youtube", "telegram"],
      "firstSeen": "2026-08-01T10:00:00Z",
      "lastSeen": "2026-08-03T15:00:00Z",
      "postCount": 3,
      "engagement": 45,
      "mutationScore": 52.3,
      "semanticShift": 38.5,
      "sentimentShift": 80.0,
      "emotionShift": 100,
      "keywordShift": 55.0,
      "dominantSentiment": "negative",
      "dominantEmotion": "anxiety",
      "timeline": [...],
      "platformFlow": [
        { "platform": "youtube", "firstSeen": "2026-08-01T10:00:00Z", "postCount": 2 },
        { "platform": "telegram", "firstSeen": "2026-08-03T15:00:00Z", "postCount": 1 }
      ],
      "keywordEvolution": [
        { "stage": "early", "keywords": ["ai", "coding", "tools"], "periodStart": "...", "periodEnd": "..." },
        { "stage": "latest", "keywords": ["ai", "replace", "jobs"], "periodStart": "...", "periodEnd": "..." }
      ]
    }
  ],
  "availablePlatforms": ["youtube", "telegram"],
  "totalPostsAnalyzed": 201,
  "coverage": { "sentiment": 1.0, "emotion": 1.0, "embeddings": 0.95 },
  "method": {
    "clustering": "union-find connected components",
    "similarityThreshold": 0.70,
    "embeddingModel": "all-MiniLM-L6-v2",
    "mutationFormula": "0.40×semantic + 0.25×sentiment + 0.20×emotion + 0.15×keyword"
  }
}
```

---

## 14. Testing

```bash
# Narrative-specific tests (clustering, mutations, title generation)
npm run verify:narratives

# Full verification suite (includes narratives)
npm run verify

# ML service tests (includes /embeddings endpoint)
cd ml && .venv/Scripts/python.exe -m pytest -q

# Type check
npx tsc --noEmit

# Production build
npm run build
```

Test fixtures use 4 deterministic posts about AI/developers — NOT from the
frozen corpus. The test data is never mixed into the production dataset.
