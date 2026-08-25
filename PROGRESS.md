# PROGRESS.md — current status & where to start

> **Read this first, then [AGENTS.md](AGENTS.md) for architecture.**
> This file is the handover note. AGENTS.md explains *how the system is built*;
> this file explains *what state it is in right now and what to do next*.
>
> **Anyone pushing to `main` must update this file in the same push.** A stale
> status file is worse than none — the next agent will act on it.

**Last updated:** 2026-08-25 · **State as of:** `6e505a2` · **Branch:** `main`

---

## 1. Where we are

| | |
| :--- | :--- |
| **Problem statement** | SIH26152 — Social Media Analytics (NTRO) |
| **Next deadline** | **Internal hackathon — 29/30 Aug 2026** |
| **After that** | Idea submission 20 Sept · Grand Finale Dec 2026 (36h) |
| **Demo state** | ✅ Runnable, network-independent, no login required |
| **Build** | ✅ `npm run build` clean, 20 routes |
| **Tests** | ✅ `npm run verify` — 3 suites, all passing |

### Right now the demo works like this

`SINGLE_TENANT_MODE=true`. A judge opens `localhost:3000` and sees a real,
pre-scored corpus immediately. No sign-in, no OAuth, no network needed.

---

## 2. Start here (new agent, 3 minutes)

```bash
# terminal 1 — ML service (5 transformers, ~11s cold start)
cd ml && .venv/Scripts/python.exe -m uvicorn main:app --port 8000

# terminal 2 — dashboard
npm run dev            # http://localhost:3000

# confirm
npm run verify         # 3 suites: graph algorithms, connectors, tenancy
```

If `ml/.venv` does not exist on your machine, see §7.

---

## 3. The five components — honest status

| | Component | State | Where |
| :-- | :-- | :-- | :-- |
| **A** | Ingestion & timeline | 🟡 2 of 6 platforms live | `src/lib/ingestion/` |
| **B** | Sentiment & emotion | 🟢 4 real transformers | `ml/`, `src/lib/ml/client.ts` |
| **C** | Demographics | 🔴 **regex only, no ML** | `src/lib/nlp/demographicProfiler.ts` |
| **D** | Trends | 🟢 real z-score · 🟡 no forecast | `src/app/api/analytics/trends/` |
| **E** | Link analysis | 🟢 real Louvain + Brandes | `src/lib/graph/` |
| **+** | **Cross-vector brief** | 🟢 **the differentiator** | `src/app/api/analytics/brief/` |

**Component C is the known weak point.** It is regex and lexicons. It does not
guess — unknown values return `null`, render as "Unknown", and the API reports
inference coverage. Do not "fix" it by adding defaults back.

---

## 4. Platform connectors

All six are written and call the real APIs. Live vs dormant depends only on
credentials. Check at runtime: `GET /api/platforms`.

| Platform | Tier | Status | Blocker |
| :-- | :-- | :-- | :-- |
| Telegram | Essential | 🟢 **live** | none — public channels need no credentials |
| YouTube | Appreciable | 🟢 **live** | none — API key configured |
| X (Twitter) | Essential | 🔴 needs funding | pay-per-call since Feb 2026, ~$24/mo at demo volume |
| Instagram | Desirable | 🔴 blocked | Meta Business Verification + App Review, 4–6 wks |
| Facebook | Desirable | 🔴 blocked | same Meta process, 3–6 wks |
| Reddit | Appreciable | 🔴 blocked | manual approval queue; commercial use needs an agreement |

Setup for each: [`docs/platform-setup.md`](docs/platform-setup.md).
Commercial/multi-tenant credentials: [`docs/commercial-setup.md`](docs/commercial-setup.md).

### Verified access reality (2026-08-25)

Every unauthenticated route except Telegram's is closed. Do not waste time
re-testing these:

- Reddit public JSON → **403**; `old.reddit.com` redirects to login
- X syndication → **200 with an empty body**; v2 → 401 without a token
- Instagram `?__a=1` → no JSON; `web_profile_info` → 429; Basic Display API retired Dec 2024
- Facebook Graph anonymous → `(#200) Provide valid app ID`
- YouTube Data API → 403 without a key

---

## 5. Demo corpus

`src/lib/frozenCorpus.json` — **201 real posts** (161 YouTube + 40 Telegram),
all transformer-scored at capture, committed to the repo.

This is a **real captured snapshot, not synthetic data**. It exists so the demo
never depends on venue wi-fi, a live API, or YouTube's 10,000 units/day quota
(`search.list` costs 100 units — a morning of rehearsals could exhaust it).

Graph it produces: **158 accounts, 67 edges, 7 communities, modularity Q = 0.83**
(>0.3 indicates real community structure).

To refresh it after ingesting more data:

```bash
node scripts/freeze-corpus.mjs
```

More sources → more communities → a richer brief. This is the cheapest way to
improve the demo.

---

## 6. What to do next

### Before the internal hackathon (29/30 Aug) — priority order

1. **Dry run on the actual presentation laptop.** The ML service needs its venv
   and ~2 GB of cached models; a different machine means a 20-minute download.
   Pre-warm before presenting.
2. **Record a backup demo video.** If the laptop fails, present the video.
3. **Ingest 2–3 more YouTube queries** and re-freeze. Richer corpus, better brief.
4. **Rehearse the honest answers** (§8). Do not invent an accuracy number.

### Do NOT start before the internal round

These are December problems and will not finish in time:

- Component C ML models
- Trend forecasting
- Meta / Google verification
- Anything in the multi-tenant OAuth layer

### After internal, before 20 Sept

- Hand-label ~200 posts; publish per-class precision/recall + confusion matrix.
  Judges push on model accuracy and almost no team will have this.
- Fund X (~$24/mo) — it is the second Essential platform and needs no approval.
- Add trend forecasting (Holt's linear trend on the bucketed series is enough).

---

## 7. Environment

Required in `.env` (gitignored — never commit it):

| Variable | Needed for |
| :-- | :-- |
| `MONGODB_URI` | persistence (optional; falls back to memory) |
| `NEXTAUTH_SECRET` | **required**, ≥32 chars, app refuses to start without it |
| `YOUTUBE_API_KEY` | YouTube ingestion — **configured** |
| `SINGLE_TENANT_MODE` | `true` for the demo |
| `ML_API_URL` | defaults to `http://127.0.0.1:8000` |
| `TOKEN_ENCRYPTION_KEY` | multi-tenant mode only |

Full template: `.env.example`.

### Rebuilding the ML service from scratch

```bash
cd ml
python -m venv .venv
.venv/Scripts/python.exe -m pip install torch --index-url https://download.pytorch.org/whl/cpu
.venv/Scripts/python.exe -m pip install -r requirements.txt
.venv/Scripts/python.exe download_models.py      # ~2 GB, one time
.venv/Scripts/python.exe -m pytest -q            # 40 tests
```

---

## 8. Honest answers for judges

Rehearse these. In each case the honest answer scores better than a bluff, and a
judge who catches an invented number discounts everything else.

**"How accurate is your model?"**
> Not measured yet. Plan: hand-label 200 posts, report per-class precision and
> recall, publish the confusion matrix.

**"Is the demographic profiling AI?"**
> No — regex and lexicons, and it is our weakest component. It refuses to guess:
> unknown values return Unknown and we report inference coverage.

**"Why is X not connected?"**
> X removed its free tier in Feb 2026; reading costs per call. The connector is
> written and tested against the real API contract — it needs a funded balance,
> not more code. We chose not to mock an Essential platform.

---

## 9. Engineering rules (non-negotiable)

1. **Never fabricate a metric.** No `Math.random()` in any analysis path. If a
   value cannot be determined, return `null` and render "Unknown". Seven
   fabrication sites were removed on 2026-08-25 — do not reintroduce them.
2. **A connector that returns nothing must say why.** `missing-credentials`,
   `unauthorized`, `rate-limited` and `not-found` are distinct states.
   `npm run verify:connectors` enforces that connectors never return fake posts.
3. **Never mock a platform to make it look live.** An honest gap beats a fake.
4. **Tenant reads go through `src/lib/tenant.ts`.** Calling `getAllPosts()`
   directly in an analytics route is a cross-tenant data leak.
5. **Update this file before pushing.**

---

## 10. Recent history

| Commit | What changed |
| :-- | :-- |
| `6e505a2` | PROGRESS.md handover note + pre-push hook enforcing it |
| `b7d1415` | Reddit reports missing-credentials when the legacy gateway errors |
| `cc8eaab` | Cross-vector brief + frozen corpus + network-independent demo |
| `29d4607` | Multi-tenant OAuth for all six platforms, encrypted token storage |
| `a6bdf3c` | `tsx` devDependency so `npm run verify` works |
| `d2c3fd8` | All six platform connectors implemented |
| `84fe687` | Removed fabricated metrics; real Louvain, Brandes, PageRank; wired ML |
| `81c4cd7` | Merged PR #1 — Python ML service from @Rishiraj-De |
