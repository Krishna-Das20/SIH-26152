# PROGRESS.md — current status & where to start

> **Read this first, then [AGENTS.md](AGENTS.md) for architecture.**
> **Presenting?** [`docs/team-brief.md`](docs/team-brief.md) is the deck-building
> brief — slide-by-slide content, the demo script, and rehearsed answers to the
> questions judges ask. `docs/team-brief.docx` is the same content for Word;
> the markdown is the source, so edit it and run `npm run build:brief` rather
> than editing the .docx by hand.
> This file is the handover note. AGENTS.md explains *how the system is built*;
> this file explains *what state it is in right now and what to do next*.
>
> **Anyone pushing to `main` must update this file in the same push.** A stale
> status file is worse than none — the next agent will act on it.

**Last updated:** 2026-08-27 (PR #3 merged) · **State as of:** `main` = `beta` = PR #2 merged · **Branches:** `main` (stable) · `beta` (PR target)

---

## 0. Branching — read before you open a PR

| Branch | Purpose |
| :-- | :-- |
| **`main`** | Stable. This is what Vercel deploys and what we demo. Do not push directly. |
| **`beta`** | **Open all PRs against this.** Integration branch for teammates and agents. |

```bash
git checkout beta && git pull
git checkout -b feat/your-change     # branch off beta, not main
# ...work...
git push -u origin feat/your-change  # then open a PR into beta
```

`beta` is merged into `main` only after the demo still runs: `npm run build`
passes, `npm run verify` passes, and the dashboard loads with the ML service
stopped. With the internal hackathon days away, a broken `main` means a broken
demo — that is the whole reason this branch exists.

---

## 1. Where we are

| | |
| :--- | :--- |
| **Problem statement** | SIH26152 — Social Media Analytics (NTRO) |
| **Next deadline** | **Internal hackathon — 29/30 Aug 2026** |
| **After that** | Idea submission 20 Sept · Grand Finale Dec 2026 (36h) |
| **Demo state** | ✅ Runnable, network-independent, no login required |
| **Build** | ✅ `npm run build` clean, 29 routes |
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
| **A** | Ingestion & timeline | 🟢 **4 of 6 working** (YT, TG, IG, FB*) | `src/lib/ingestion/` |
| **B** | Sentiment & emotion | 🟢 4 real transformers | `ml/`, `src/lib/ml/client.ts` |
| **C** | Demographics | 🔴 **regex only, no ML** | `src/lib/nlp/demographicProfiler.ts` |
| **D** | Trends | 🟢 real z-score · 🟡 no forecast | `src/app/api/analytics/trends/` |
| **E** | Link analysis | 🟢 real Louvain + Brandes | `src/lib/graph/` |
| **+** | **Cross-vector brief** | 🟢 **the differentiator** | `src/app/api/analytics/brief/` |
| **+** | **Narrative mutation** | 🟢 8 dimensions · see §11 | `src/lib/narratives/` |
| **+** | **SKYNET UI** | 🟢 merged from PR #3 · see §12 | `src/components/skynet/` |

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
| Instagram | Desirable | 🟢 **live** | permanent Page token, re-minted 2026-08-27 · @bbsrgotlatent |
| Facebook | Desirable | 🟡 **live, feed scope missing** | Page metadata OK; `/{page}/posts` needs a scope the app has not enabled — §4c |
| Reddit | Appreciable | 🔴 blocked on review | Gated by Responsible Builder Policy; Devvit RFC in `docs/devvit-integration.md` |
| X (Twitter) | Essential | 🔴 needs funding | pay-per-call since Feb 2026, ~$24/mo at demo volume |

Setup for each: [`docs/platform-setup.md`](docs/platform-setup.md).
Devvit Alternative Architecture: [`docs/devvit-integration.md`](docs/devvit-integration.md).
Commercial/multi-tenant credentials: [`docs/commercial-setup.md`](docs/commercial-setup.md).

### Verified access reality (2026-08-25)

Every unauthenticated route except Telegram's is closed. Do not waste time
re-testing these:

- Reddit public JSON → **403**; `old.reddit.com` redirects to login
- X syndication → **200 with an empty body**; v2 → 401 without a token
- Instagram `?__a=1` → no JSON; `web_profile_info` → 429; Basic Display API retired Dec 2024
- Facebook Graph anonymous → `(#200) Provide valid app ID`
- YouTube Data API → 403 without a key

### Run this before trusting any of the above

```bash
npm run check:tokens
```

`/api/platforms` reports whether an env var is **present**. It cannot tell you
whether the credential still **works** — that would cost an API call on every
request. `check:tokens` makes one real call per platform and exits non-zero if
anything configured is dead. Run it before every rehearsal.

---

## 4c. Meta tokens — RESTORED 2026-08-27

`npm run check:tokens` now reports Instagram and Facebook as dead. The failing
call returns:

> `(#190) OAuthException — Any of the pages_read_engagement,
> pages_manage_metadata, pages_read_user_content, pages_manage_ads,
> pages_show_list or pages_messaging permission(s) must be granted before
> impersonating a user's page.`

This is **not** an expiry, and not a scope problem either. The root cause is one
level up:

> **RESOLVED 2026-08-27.** The developer-account block was lifted and the token
> re-minted. `npm run check:tokens` reports **4/6**, with Facebook and Instagram
> both `PERMANENT (no scheduled expiry)` — and `debug_token` can now verify that
> claim, because `FACEBOOK_APP_SECRET` is back in `.env`. A live ingest returned
> 80 Instagram items, so the credential works end to end, not just on paper.
>
> Two things to know for next time, both learned the hard way below.
>
> **The Meta developer account had been blocked.**
> `developers.facebook.com` redirects to a "Developer Platform Blocked User
> Error" page reading: *"Account confirmation needed — We've noticed unusual
> activity on this developer account. Please complete the confirmation steps to
> regain access."*

Every app token dies while the developer account behind the app is blocked,
which is why even `/me` returns 190. The app "SIH" still shows as **Active** in
the account's Business Integrations — the connection was never removed. There is
nothing to fix in `.env` or in the code.

### Likely trigger — do not repeat it

The OAuth flow was driven through **browser automation**, followed by scripted
token-exchange calls in quick succession. That is a close match for the pattern
Meta's anti-abuse systems flag as unusual activity. **Do the Meta OAuth steps by
hand from now on.** Automating a login against Meta is not worth a second block.

Related: `FACEBOOK_APP_SECRET` is no longer present in `.env` (the file was last
modified 2026-08-26 19:08 by something other than this session). Without it
`check:tokens` cannot call `debug_token`, so it guesses "EXPIRED" from the error
code instead of reporting the real reason. Re-add it when the account is
unblocked.

### This does NOT affect the demo

`src/lib/frozenCorpus.json` still holds all **352 posts including the 160
Instagram ones**, every one transformer-scored. The corpus is committed, so
every panel renders exactly as before. What is broken is *new* ingestion from
those two platforms — nothing the internal round depends on.

### If it dies again — the exact recipe

1. Check `developers.facebook.com` loads at all. If it shows "Account
   confirmation needed", that is the real problem and no token can be minted
   until the account owner clears it **manually**.
2. `FACEBOOK_APP_SECRET` must be in `.env`. Revealing it needs the account
   password (App settings → Basic → App secret → Show) — an owner-only step.
3. `npm run get:meta-token`, then open the URL it prints.

### Do NOT widen the scope list without enabling the scope first

Requesting a scope the app has not enabled does not degrade gracefully —
Facebook refuses the **entire** OAuth dialog with `Invalid Scopes: ...` and
issues no code at all. Verified 2026-08-27: `pages_read_user_content` and
`instagram_manage_insights` both bounced, because the app's Instagram use case
is configured for *"API setup with Instagram login"* rather than *"with Facebook
login"*. `SCOPES` in `scripts/get-meta-token.mjs` is therefore the **minimum**
that mints a working token; the aspirational ones sit in a comment beside it
with instructions, and `META_SCOPES=a,b,c` overrides without editing the file.

**Consequence:** the Facebook feed (`/{page}/posts`) is still blocked, and so is
Instagram hashtag search. Own-account Instagram media and comments — the 160
posts in the corpus — work fine. To unblock the rest, enable those permissions
under Use cases → Customize → Permissions and features first, then re-mint.

---

## 4c-history. Meta setup — how it was first resolved 2026-08-26

**Instagram is live.** `@bbsrgotlatent`, 160 posts + comments ingested.

The token in `.env` is a **permanent Page access token** (`type: PAGE`,
`expires_at: 0`, verified via `debug_token`). The same token serves both
platforms, because Instagram Graph reads the linked Business account through
the Page.

| | |
| :-- | :-- |
| App | SIH — `2451159215406440` |
| Page | BBSR Got Laytent — `1378817178638963` |
| Instagram | `17841415627266694` |

### Why the earlier tokens died

A Page token **inherits the lifetime of the user token it was derived from**.
The first attempt derived it from a raw Graph API Explorer token (1–2 hours),
so it expired the same day. The fix is to exchange for a long-lived user token
*first*, then call `/me/accounts`. `npm run get:meta-token` does this in the
correct order and verifies `expires_at: 0` before printing.

**This token has no timer but is not immortal** — it dies if the Facebook
password changes, the role on the Page is removed, or access is revoked. Do not
change that password before December. Verify with `npm run check:tokens`.

### Facebook feed is still blocked

The token is valid and reads Page metadata, but `/{page}/posts` returns:

> `(#10) This endpoint requires the 'pages_read_user_content' permission`

That scope was not granted. To fix, re-run the Explorer flow adding
`pages_read_user_content`, then repeat the long-lived exchange. Low priority —
the Page has 1 post, while Instagram already supplies 160.

### Instagram commenters are anonymous by design

The API returns only `[id, text, timestamp, like_count]` for comments — **no
username**. Each anonymous commenter is given an id derived from the comment
id, so distinct-author counts are an UPPER bound (two comments by the same
person cannot be merged). The reply edge to the media owner is real. A shared
placeholder was previously collapsing all 160 commenters into ONE node.

---

## 4b. Deployed site (Vercel)

`https://sih-26152.vercel.app` serves the same frozen corpus — identical
analysis, Q = 0.83, all 5 findings — because `frozenCorpus.json` is committed.

Two deliberate differences from local:

- **No `YOUTUBE_API_KEY`** there, so it reports 1/6 platforms live. Existing
  YouTube data displays fine; new YouTube ingestion is unavailable.
- **No ML host reachable**, so `/narratives` is EMPTY on Vercel. Sentiment and
  emotion are unaffected — those are baked into `frozenCorpus.json` — but
  narrative clustering needs live embeddings from `POST /embeddings`, and there
  is nowhere to call. The page says so explicitly (it distinguishes "could not
  embed" from "no clusters found"; do not collapse those two messages). **Demo
  narratives locally, not from the deployed URL.**
- **No `PUBLIC_INGEST`**, so `/api/ingest` and `/api/analyze/page` require a
  session. Reads stay open — a judge sees the whole dashboard without an account.

**Set `SINGLE_TENANT_MODE=true` on Vercel.** Without it a visitor who signs in
flips from `demo` to `tenant` mode and sees an EMPTY dashboard, because a new
user has no connected accounts.

Use Vercel as the backup demo. Prefer localhost, because Vercel cannot reach the
ML service on `127.0.0.1`, so new ingestion there falls back to the lexicon.

---

## 4d. ML batch sizing (matters on CPU)

`ML_CHUNK_SIZE=12`, `ML_TIMEOUT_MS=90000` in `.env`.

A timeout degrades the **whole request** to lexicon scores, so an oversized
chunk silently costs every post in it. At chunk size 40 the rescue path aborted
and left 40 posts on fallback quality with no error surfaced anywhere except
`engineBreakdown`. Raise the chunk size only if you also verify
`npm run check:tokens` and the `engineBreakdown` afterwards.

Stuck on lexicon scores? Upgrade without re-fetching from the platforms:

```bash
curl -X POST http://localhost:3000/api/ingest   -H 'Content-Type: application/json' -d '{"action":"rescore"}'
```

---

## 5. Demo corpus

`src/lib/frozenCorpus.json` — **352 real posts, 352/352 transformer-scored**
(152 YouTube + 160 Instagram + 40 Telegram),
all transformer-scored at capture, committed to the repo.

This is a **real captured snapshot, not synthetic data**. It exists so the demo
never depends on venue wi-fi, a live API, or YouTube's 10,000 units/day quota
(`search.list` costs 100 units — a morning of rehearsals could exhaust it).

Graph it produces: **298 accounts, 174 edges, 5 communities, modularity Q = 0.28**
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
| `YOUTUBE_API_KEY` | YouTube ingestion — **configured locally**, not on Vercel |
| `PUBLIC_INGEST` | `true` locally so the demo needs no login. **Never set on Vercel** — ingestion spends our YouTube quota and the URL is public |
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
5. **`against` and `anxiety` must stay reachable.** GoEmotions `disapproval`
   maps to `against` and `nervousness` to `anxiety`. Folding them back into
   `anger`/`fear` makes two dimensions the problem statement names structurally
   impossible to emit. `ml/emotion/analyzer.py`, `ml/pipeline/nlp_pipeline.py`
   and `src/lib/ml/client.ts` must all carry them — the pipeline enumerates
   fields, so a new dimension is silently dropped unless listed there too.
6. **Stance is a position, not a mood.** Fear, sadness and nervousness are
   negative but express no stance. Do not rank polarity above the explicit
   support/oppose signals in `deriveStance`.
7. **Reads open, writes guarded.** Ingestion routes spend real third-party
   quota, so they require a session unless `PUBLIC_INGEST=true`. Do not remove
   the guard to make a deployment "just work".
8. **Update this file before pushing.**

---

## 11. Narrative Mutation Tracker (PR #2, merged into `beta` 2026-08-26)

@Rishiraj-De's second contribution. Embeds every post with all-MiniLM-L6-v2 via
a new `POST /embeddings` endpoint on the ML service, clusters semantically
similar posts with union-find, and scores how much each cluster changed between
its earlier and later halves.

| | |
| :-- | :-- |
| UI | `/narratives` (linked from the navbar) |
| API | `/api/analytics/narratives`, `/[id]`, `/[id]/timeline` |
| Core | `src/lib/narratives/` — clustering, mutations, titles, analyzer |
| Tests | `npm run verify:narratives` — 39 assertions |
| Docs | [`docs/narrative-mutation.md`](docs/narrative-mutation.md) |

`mutation = 0.40·semantic + 0.25·sentiment + 0.20·emotion + 0.15·keyword`

### Two fixes applied during merge — do not revert them

**1. `MIN_STAGE_POSTS = 2` in `src/lib/narratives/mutations.ts`.**
Three of the four components are *distribution* comparisons. With one post per
stage there is no distribution: sentiment TVD collapses to exactly 0 or exactly
100, the emotion "mode" is that single post's emotion, and two short comments
never share a top-5 keyword so Jaccard pins at 100. Measured on the 352-post
corpus, **all 18 two-post narratives had sentimentShift of exactly 0 or 100**,
and those three components carry 60 of the 100 points — so unrelated comment
*pairs* scored 60–72 while the one genuinely large narrative (69 posts) scored
17. The ranking was measuring cluster smallness. Below the floor the components
return `null`, which makes the composite `null` by the existing strict rule.

**2. `MIN_NARRATIVE_POSTS_FOR_FINDING = 6` in the brief route.**
Finding 7 previously took `narratives[0]` and asserted the narrative "changed
meaningfully" — on this corpus that was a 2-post Instagram pair. The floor is
about what the sentence claims, not whether the number computes. The `catch`
now logs instead of swallowing, so a genuine bug in narrative code cannot hide
behind a permanently-missing finding and a 200 response.

### What it actually shows on the current corpus

24 narratives, 2 with a composite score (18.3 and 17.1), 22 reading "N/A".
**That is correct, not broken** — this corpus has no multi-post evolving
narrative. The largest cluster is 69 posts spanning all three platforms and is
almost entirely emoji reactions (🔥🔥, ❤️, 😍), which genuinely have not
mutated: semantic shift 0, emotion shift 0.

Because nothing clears 30, **the narrative finding does not appear in the brief
on this corpus.** Demo the feature from `/narratives`, not from the brief. Do
NOT lower the threshold to make a finding appear — that is the fabrication trap
this project exists to avoid. The real fix is a corpus with actual discourse in
it (more YouTube queries on one contested topic).

### Requires the ML service — unlike everything else

This is the first panel that needs `ml/` running at demo time. Sentiment,
emotion, graph and trends all read pre-scored values out of `frozenCorpus.json`
and survive with the service stopped; narrative clustering cannot, because
embeddings are computed live. With the service down the page reports 0 embedded
of 352 and names the cause. **Check `curl 127.0.0.1:8000/health` before
demoing this page.**

---

## 14. Security review — 2026-08-27

Two HIGH findings in the PR #3 web-preview path, both fixed. Regression tests
live in `src/lib/__tests__/verify-url-safety.ts` (`npm run verify:urls`, part of
`npm run verify`). **Confirmed they fail against the pre-fix code: 7 of 20.**

### 1. SSRF — `src/lib/ingestion/instagram.ts`

The web preview passed the caller's target straight to `fetch()`. The gate was
`input.startsWith('http') || input.includes('instagram.com/')` — a prefix test,
not a host test, so `http://169.254.169.254/...` passed and the caller
controlled host, port and path of a request from inside our network. Reachable
from `POST /api/analyze/page` and `POST /api/ingest`; `guardIngest()` only needs
a session and registration is open.

**This was demonstrated, not theorised.** Against the old code the regression
test reached the local ML service and returned its response as a post:
`refuses http://127.0.0.1:8000/health — status=ok posts=1`.

Fixed by `instagramPreviewUrl()`: parse with `new URL`, require `https:`, require
the host to be `instagram.com` or a subdomain. Also `redirect: 'manual'` on the
fetch, or an allowlisted URL that 302s to an internal host walks back through
the hole.

### 2. Stored XSS — `src/lib/urls.ts`

`getPostUrl()` guarded line 7 with `startsWith('http')` but the instagram branch
re-returned `post.url` unchecked, and `getParentSource()` did the same twice —
one of those on a branch that fires for **any** platform. These land in `href`
attributes in six places. React renders a `javascript:` href as-is, and
`target="_blank"` does not help.

The source was `og:url` scraped from the fetched page, and `/api/ingest` stores
posts with no `ownerUserId`, so `tenant.ts` serves them to **every anonymous
visitor** — stored cross-user XSS, not self-XSS.

Fixed with `safeExternal()` applied to all five `post.url` return paths, plus
`safeHttpUrl()` in `src/lib/ingestion/types.ts` so the value is rejected at the
ingestion boundary too. **Use `safeHttpUrl` on any URL a connector lifts out of
fetched content.** `startsWith('http')` is not a scheme check — `httpfoo:`
passes it.

### 3. Cross-tenant overwrite — `src/lib/store.ts`

Upserting on `{ id }` alone let one tenant's write land on another's document:
`$set` replaced the content while the existing `ownerUserId` survived. Ingested
ids derive from the target, so `ig_<shortcode>` collides across tenants.
`tenantScopedFilter()` now puts ownership in the filter.

### 4. Substituted results — found while verifying the SSRF fix

Once unusable URLs were rejected, a URL target fell through to the own-account
branch and returned the connected account's **own media** with `status: 'ok'` —
the exact substitution `analyze/page`'s docstring forbids. A URL target is now
answered by the web preview or by `not-found`, never by other data.

---

## 13. Ad-hoc ingest — timings, and the bug it exposed

The SKYNET dashboard has a live ingest console: paste a YouTube URL, Instagram
reel, or Telegram channel and it collects, ML-scores and re-renders. Measured
2026-08-27 on this laptop, end to end:

| Target | Collected | Time |
| :-- | --: | --: |
| YouTube video (cold — route compiles) | 25 | **12.3 s** |
| YouTube video (warm) | 25 | **9.3 s** |
| Instagram reel | 1 | **6.2 s** |
| Telegram channel | 20 | **26.5 s** |

Then the dashboard refetches five analytics routes in parallel, 1.3–3.5 s warm.
**So a judge pasting a YouTube link sees a fully re-scored dashboard in roughly
12–13 seconds.** Telegram is the slow one — it fetches the channel preview page
and parses it, so budget ~30 s if demoing that path.

First call after `npm run dev` is always slower: Next compiles the route on
demand, and the ML service costs ~20 s extra on its very first batch. **Warm
both up before judging** — one throwaway ingest during setup is enough.

### The bug this exposed — fixed, do not reintroduce

`getAllPosts()` prefers a NON-EMPTY MongoDB collection over the memory cache,
but the frozen baseline is only ever seeded into the CACHE. `addPosts()`
persisted only the incoming batch. So against a fresh database the first ingest
made the collection non-empty with *only the new posts*, and every later read
returned those instead of the corpus.

Measured before the fix: four ad-hoc ingests took the dashboard from **352 posts
to 71**. On stage that turns "analyse this video" into "delete the demo" — and
pasting a link is the single most likely thing a judge will try.

`seedBaselineIfEmpty()` now runs before the first upsert, keeping MongoDB a
**superset** of the baseline. Verified after the fix: 358 baseline + 25 ingested
= 383, all three platforms intact.

---

## 12. SKYNET UI (PR #3, merged 2026-08-27)

@Rishiraj-De's frontend overhaul, renamed from "NEXUS" to **SKYNET** (team name)
on merge. Dark intelligence-console theme, a component kit in
`src/components/skynet/`, and nine screens: `/`, `/narratives`,
`/narratives/[id]`, `/sentiment`, `/trends`, `/network`, `/audience`,
`/sources`, `/brief`. Build is 29 routes; `npm run verify` still exits 0.

It also expands the corpus to **358 posts, 358/358 transformer-scored**
(160 Instagram + 152 YouTube + 46 Telegram) and adds four mutation dimensions
— entity, platform, community, amplification — for eight in total, weighted
`0.25/0.15/0.15/0.10/0.10/0.10/0.08/0.07`.

### What was NOT taken from the PR, and why

**The PROGRESS.md rewrite was rejected wholesale.** It deleted §4c (the entire
Meta token diagnosis), the `check:tokens` documentation, §4d (ML batch sizing),
and engineering rules 5 and 6 — the two rules that stop someone reintroducing
the `against`/`anxiety` and stance-vs-mood bugs. It also asserted things that
are false: Instagram and Facebook as "🔴 blocked, Meta Business Verification
4–6 wks" when both are live on a permanent token, and a corpus of "201 posts,
Q = 0.83" when the PR's own `frozenCorpus.json` holds 358 and measures
**Q = 0.2796** — verified by running `buildNetworkTopology` over it.

### Three fixes applied on merge — do not revert them

The four new dimensions did not carry the anti-fabrication discipline the
original four were given in PR #2:

1. **`computePlatformShift` and `computeCommunityShift` now respect
   `MIN_STAGE_POSTS`.** Both are TVD over a distribution, so both saturate to
   exactly 0 or 100 on a single-post stage — the identical bug fixed in
   `sentimentShift`.
2. **`computeCommunityShift` returns `null`, not `0`, when no post carries a
   community.** `author.communityId` is written by the graph layer, never by
   ingestion, so **0 of 358** corpus posts have one. Returning `0` claimed
   measured stability for something entirely unobserved.
3. **The composite renormalises over present dimensions instead of `?? 0`.**
   Folding an unmeasured dimension in as a measured zero was both a false claim
   and a silent penalty: every score was docked a fixed 8% of weight that no
   evidence supported. Measured effect: the two scoreable narratives went from
   29.9/23.1 to **32.5/25.1**.

Still 2 of 25 narratives carry a composite score, because the PR #2 gate on the
four core dimensions is intact. That remains correct for this corpus.

### UI wording — "intercepted" removed 2026-08-27

The PR's copy described public API reads as "intercepted" / "LIVE INTERCEPT".
Against an NTRO audience that word is legally loaded and overclaims what the
system does — it reads as signals interception rather than a documented GET
against a public endpoint. All 8 UI strings now say "collected" / "original".

One occurrence was deliberately KEPT: `src/app/api/connect/[provider]/route.ts`
says an "intercepted authorization code cannot be redeemed without it", which is
correct security terminology for what PKCE defends against, not a claim about
collection.

**Still open:** `/api/analytics/overview` emits `threatLevel`
(LOW/ELEVATED/HIGH/CRITICAL) derived purely from the share of negative
sentiment. Its own comment calls it "Threat / Volatility Level Assessment" —
volatility is what it measures. Renaming it is an API-contract change touching
several consumers, so it was left alone; consider it before the final round.

---

## 10. Recent history

| Commit | What changed |
| :-- | :-- |
| _(head)_ | Merged PR #3 — SKYNET UI, 358-post corpus, 8-dimension mutation, + 3 fixes |
| `43560e7` | get-meta-token mints with only the scopes the app has enabled |
| `bee0b12` | Meta outage root cause: blocked developer account |
| `15becad` | Team brief for the internal round: `docs/team-brief.md` |
| `b33f67d` | Narratives: stopped blaming the corpus for an unreachable ML service |
| `acc8c40` | Merged PR #2 — Narrative Mutation Tracker from @Rishiraj-De, + 2 scoring fixes |
| `a5af070` | Made `against`/`anxiety` reachable, decoupled stance from mood, rescore path |
| `6e505a2` | PROGRESS.md handover note + pre-push hook enforcing it |
| `b7d1415` | Reddit reports missing-credentials when the legacy gateway errors |
| `cc8eaab` | Cross-vector brief + frozen corpus + network-independent demo |
| `29d4607` | Multi-tenant OAuth for all six platforms, encrypted token storage |
| `a6bdf3c` | `tsx` devDependency so `npm run verify` works |
| `d2c3fd8` | All six platform connectors implemented |
| `84fe687` | Removed fabricated metrics; real Louvain, Brandes, PageRank; wired ML |
| `81c4cd7` | Merged PR #1 — Python ML service from @Rishiraj-De |
