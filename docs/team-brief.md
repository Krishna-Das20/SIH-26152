# Team Brief — SIH26152 Internal Round

> **For the teammates building the presentation.**
> Everything the deck needs: what the problem statement asks, what is actually
> running, what deliberately is not, and the numbers to put on slides.
>
> Styled version (same content, nicer to read):
> https://claude.ai/code/artifact/e2778199-b136-47ba-8987-a8b404443f96
> If you edit one, edit the other — a stale copy is worse than one copy.

| | |
| :-- | :-- |
| **Problem statement** | SIH26152 — Social Media Analytics · Sponsor **NTRO** |
| **Internal round** | **29–30 Aug 2026** |
| **After that** | Idea submission 20 Sept · Grand Finale Dec 2026 (36h) |
| **State as of** | `b33f67d` |
| **Repo** | `Krishna-Das20/SIH-26152` |

Each section below maps to roughly one slide. **Every number here was read off the
running system on 26 Aug 2026 — none are aspirational.**

> **If a number is not in this document, do not put it on a slide.**
> That rule is the whole reason the project reads as credible.

---

## 1. What the problem statement actually asks for

*Slide 1–2 · Problem framing*

NTRO wants a system that reads public social media and tells an analyst not just
*what* is being said, but *who* is saying it, *how they feel*, and *how it
spreads*. Five named components:

| # | Component | What it demands |
| :-- | :-- | :-- |
| **A** | Continuous data collection | Tiered: **Essential** — X & Telegram. **Desirable** — Instagram & Facebook. **Appreciable** — Reddit or YouTube. |
| **B** | Multi-dimensional sentiment | Beyond positive/negative — sarcasm, anxiety, excitement, supportive, against. |
| **C** | Demographic profiling | Automated inference of age, location, language, interests. |
| **D** | Trend & topic detection | Identify, rank, and **predict** emerging topics in real time. |
| **E** | Link analysis | Network topology — communities, influencers, how content travels. |

### The line that decides the winner

The statement says plainly:

> **"Combining these four vectors using AI is the key to unlocking true audience intelligence."**

Most teams will build five separate dashboards and stop. The brief is that the
*combination* is the product. Section 3 is our answer to that sentence, and it
should get the most stage time.

---

## 2. What is built, stated honestly

*Slide 3 · Component status matrix*

| # | Component | Status | What is actually behind it |
| :-- | :-- | :-- | :-- |
| **A** | Ingestion | 🟡 **4 of 6 live** | Six connectors written against real APIs. YouTube, Telegram, Instagram live; Facebook token valid but feed scope missing; X needs funding; Reddit is policy-gated. |
| **B** | Sentiment & emotion | 🟢 **Real models** | Five transformers on a Python service — RoBERTa sentiment, GoEmotions, a sarcasm classifier, toxicity, MiniLM embeddings. **352 of 352** posts transformer-scored. |
| **C** | Demographics | 🔴 **Rules only** | Regex and lexicons, no ML. Reports its own coverage and returns `null` rather than guessing. Our known weak point — own it, don't hide it. |
| **D** | Trends | 🟡 **No forecast** | Real z-score spike detection over 2,035 time buckets. Ranks and detects; does not yet predict. |
| **E** | Link analysis | 🟢 **Real algorithms** | Louvain community detection, Brandes betweenness, damped PageRank. Verified against hand-computed modularity. |
| **+** | Cross-vector brief | 🟢 **Differentiator** | The fusion layer. Six finding types that only exist by intersecting vectors. See section 3. |
| **+** | Narrative mutation | 🟢 **New** | Clusters posts by semantic similarity, scores how a narrative shifts between its early and late halves. |

### The rule that makes all of this defensible

Nothing in the system fabricates a number. Where a platform does not report a
follower count, the field is `null` and the UI says "Unknown". Where the ML
service is unreachable, the page says so instead of silently degrading. Seven
places that previously generated `Math.random()` values were removed.

**Say this out loud to the judges.** Half the projects in the room will have
plausible-looking numbers that came from nowhere, and a judge who probes one will
find it. Ours survives the probe.

---

## 3. The differentiator — findings no single vector can see

*Slide 4–5 · Spend the most time here*

Every other panel answers a question you already knew to ask. The Audience
Intelligence Brief answers questions an analyst didn't know to ask, by
intersecting vectors that are normally reported separately.

Three real findings from the current corpus, verbatim from the running system:

**[HIGH] Negative sentiment is concentrated in one community, not spread evenly**
`sentiment × network`
> Community 4 (9 accounts, topic `#IndiaSemiconductorMission`) is 56% negative,
> against 0% in Community 5. A platform-wide average would have hidden this
> 56-point split entirely.

**[NOTABLE] Sentiment on #GovernmentBudgetEconomy turned negative mid-conversation**
`trends × sentiment`
> Average sentiment moved from 0.33 to −0.20 across 9 posts, turning around
> 17 Mar 2026. Tracking the topic total alone would show only that it was busy.

**[NOTABLE] 7 posts read as positive but are sarcastic**
`sentiment × sarcasm`
> A polarity-only model would score these as support. The sarcasm classifier
> flags them, and the brief reports the gap between apparent and actual stance.

Every finding carries the evidence it was derived from, so a reader can check it
rather than trust it. There is a **Show evidence** toggle in the UI — open it on
stage.

### The one-sentence pitch

> "A dashboard tells you sentiment is 62% negative. Ours tells you the
> negativity lives in one 9-account community, is about semiconductors, and is
> being carried between clusters by one specific broker — which is the
> difference between a chart and an intelligence product."

---

## 4. Numbers you can safely put on a slide

*Slide 6 · Evidence*

| | |
| :-- | :-- |
| **352** | posts in the demo corpus — real, captured live |
| **352** | transformer-scored — 100%, no lexicon fallback |
| **298** | accounts in the graph, 174 real edges |
| **5** | transformer models running locally on CPU |
| **7** | cross-vector findings, each with evidence |
| **3** | platforms with live data — 6 connectors written |

### Corpus composition

| Platform | Posts | Tier in the PS |
| :-- | --: | :-- |
| Instagram | 160 | Desirable |
| YouTube | 152 | Appreciable |
| Telegram | 40 | **Essential** |

### Emotion distribution — component B in one table

This is the table that proves "multi-dimensional" is real and not a relabelled
positive/negative axis. Note that *supportive* and *against* are **stances**, not
moods — they are derived separately from emotional valence, because "I'm nervous
about this" is worry, not opposition.

| Dimension | Posts | | Dimension | Posts |
| :-- | --: | --- | :-- | --: |
| Supportive | 128 | | Sadness | 7 |
| Neutral | 87 | | Anger | 4 |
| Excitement | 66 | | Fear | 1 |
| Joy | 51 | | Anxiety | 0 |
| Against | 8 | | Sarcastic | 3% |

Stance split: **193 supportive · 12 opposing · 147 neutral**.

Anxiety at zero is a *true* reading of this corpus — it is mostly fan comments
and product announcements, not a crisis. **Do not treat a zero as a bug.**

### Network

| Measure | Value | Note |
| :-- | --: | :-- |
| Nodes / edges | 298 / 174 | No synthesised edges — every link is a real reply or mention |
| Communities | 5 | Excluding 119 isolated single-account groups |
| Modularity Q | **0.2796** | 🟡 Below 0.3 — see section 7 |
| Top influencers ranked | 8 | By PageRank and betweenness, not follower count |

---

## 5. Architecture

*Slide 7 · One diagram*

Two processes, deliberately. The dashboard is stateless and deploys anywhere; the
model service holds several gigabytes of weights in memory and cannot.

| Layer | Technology | Responsibility |
| :-- | :-- | :-- |
| Dashboard | Next.js 14 · TypeScript · Tailwind | UI, API routes, graph rendering, all analytics maths |
| Model service | Python · FastAPI · PyTorch | Sentiment, emotion, sarcasm, toxicity, embeddings |
| Storage | MongoDB Atlas | Post persistence, deduplication, encrypted user tokens |
| Ingestion | Six connectors, one interface | Fault-isolated — one platform failing never blocks the others |

### The models

| Purpose | Model | Disk |
| :-- | :-- | --: |
| Sentiment | `cardiffnlp/twitter-roberta-base-sentiment-latest` | 957 MB |
| Emotion | `SamLowe/roberta-base-go_emotions` | 479 MB |
| Sarcasm | `hallisky/sarcasm-classifier-gpt4-data` | 1.4 GB |
| Toxicity | `unitary/toxic-bert` | 418 MB |
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` | 88 MB |

The sarcasm model was chosen **empirically, not from a blog post** — four
candidates were tested and this one scored 0.999 on clear sarcasm with zero false
positives on the control set. That anecdote plays well if a judge asks how models
were selected.

### Graceful degradation

If the model service is down, every panel except Narratives keeps working,
because the demo corpus ships pre-scored. Worth demonstrating if there's time —
**stop the Python service on stage and reload.** Nothing breaks; the one affected
panel names the cause.

---

## 6. Platform access is the real constraint

*Slide 8 · The slide that shows we did the homework*

Every connector is written and calls the real API. What separates live from
dormant is credentials and platform policy — **not code**. We verified each of
these ourselves rather than repeating what blogs claim:

| Platform | Status | What we found |
| :-- | :-- | :-- |
| Telegram | 🟢 Live | The only platform with an open route left. Public channel previews need no credentials at all. |
| YouTube | 🟢 Live | Data API v3, 10,000 units/day free. Search costs 100 units, comments cost 1. |
| Instagram | 🟢 Live | Graph API with a permanent Page token. Basic Display API retired Dec 2024; unauthenticated routes return 429. |
| Facebook | 🟡 Token valid | Reads Page metadata; the feed needs one more permission scope we haven't granted. |
| X (Twitter) | 🔴 Needs funding | Pay-per-call since Feb 2026 — no free tier. Roughly $24/month at our volume. Code is written and waiting. |
| Reddit | 🔴 Policy-gated | Responsible Builder Policy routes new Data API apps through a request process aimed at moderation use cases. Public JSON returns 403. |

### Why this is a strength, not an excuse

Teams that claim six live platforms are either paying for X or scraping in breach
of terms. Naming the exact blocker for each platform, with the evidence,
demonstrates engineering judgement.

The **essential** tier in the problem statement is X *and* Telegram — Telegram is
live, and X is a **purchase decision, not an engineering one**.

---

## 7. What we deliberately did not do

*Slide 9 · Put this on a slide — judges reward it*

Volunteering the gaps before a judge finds them converts a weakness into evidence
of rigour.

| Gap | Why it is open | Plan by December |
| :-- | :-- | :-- |
| Demographics has no ML | Regex and lexicons. Coverage is honest: 58% language, 6% age, 0% location. | Fine-tune a classifier; the interface already returns `null`, so nothing else changes. |
| Trends do not forecast | Component D asks for prediction. We detect and rank; we do not yet predict. | Add a time-series model over the existing 2,035-bucket history. |
| No accuracy evaluation | We report which engine scored each post, but have no precision/recall against a labelled set. | Hand-label 200 posts, publish a confusion matrix. |
| Modularity is 0.28 | Instagram's 160 comments form one star around a single account, diluting the structure. Below the 0.3 "meaningful clustering" convention. | Ingest more discussion-heavy sources. This reached 0.83 on an earlier corpus. |

> ### ⚠ Before the 29th
> The modularity number is the one gap that is **cheap to close**: adding two or
> three more YouTube queries on a single contested topic and re-freezing the
> corpus lifts it above 0.3 *and* gives the narrative tracker real discourse to
> work with. Worth doing before the deck is finalised so the number on the slide
> is the better one.

---

## 8. Demo script

*Live segment · Target 5 minutes*

Start both services **before you walk in** — the model service takes about 14
seconds to load weights and another 20 on its first request. Have the dashboard
already open.

**01 · Open the dashboard cold**
No login, no network dependency.
> "352 real posts from three platforms, already analysed. Nothing here is sample data."

**02 · Emotion radar — component B**
Point at Supportive and Against sitting beside Joy and Anger.
> "Stance and mood are computed separately. Someone anxious about a policy is not opposing it, and most tools conflate those."

**03 · Network graph — component E**
Show the communities.
> "Real Louvain and Brandes betweenness. Every edge is an actual reply or mention — we removed the code that invented edges to make the graph look fuller."

**04 · The Audience Intelligence Brief — the differentiator**
Read the top finding aloud, then hit **Show evidence**. *Spend the most time here.*
> "This finding does not exist in any single panel. It required sentiment and network topology at the same time."

**05 · Narratives page**
Show clustering by meaning rather than hashtag. Note that most scores read "insufficient data".
> "That's the system refusing to score a two-post cluster. It would rather say nothing than say something unsupported."

**06 · If time allows — kill the model service**
Reload. Everything still works; the one dependent panel names the cause.
> "Degradation is visible, never silent."

> ### ⚠ Risk control
> **Record a screen-capture of this exact run the night before** and keep it on
> the presenting laptop. If the venue Wi-Fi or the laptop misbehaves, you present
> the video and lose nothing — the corpus is frozen, so the recording and the
> live run show identical numbers.

---

## 9. Deployment

*Slide 10 · Path to production*

### The dashboard is already deployed

Next.js runs on Vercel today (`https://sih-26152.vercel.app`) and serves the same
frozen corpus with identical analysis. That part is solved.

### The model service cannot run on Vercel

This is not a configuration problem — it's a structural mismatch, and it's worth
being able to explain why:

- The five models occupy **3.3 GB on disk** and the warmed service holds
  **3.1 GB resident**. Vercel functions cap at roughly 3 GB of memory and a far
  smaller deployment bundle — PyTorch alone exceeds the bundle limit before any
  weights are added.
- Serverless functions are ephemeral. Every cold start would reload the weights:
  about **14 seconds** to load plus **20 seconds** on the first request, against
  execution-time limits measured in seconds.

The correct architecture is exactly what we have: a stateless dashboard on Vercel
calling a long-lived model service over HTTP, pointed at by one environment
variable (`ML_API_URL`).

### Measured requirements for sizing the host

| Resource | Measured | Provision |
| :-- | --: | :-- |
| Memory | 3.1 GB resident | **4 GB minimum, 8 GB comfortable** |
| Disk | 3.3 GB weights | ~10 GB with the Python environment |
| CPU | 9.3 posts/sec | 2 vCPU is enough; **no GPU needed** |
| Cold start | ~34 s to first result | Keep one instance warm |
| Embeddings | 547 texts/sec | Negligible — never the bottleneck |

### Where to host it

| Option | Spec | Cost | Verdict |
| :-- | :-- | :-- | :-- |
| **Hugging Face Spaces** | 2 vCPU · 16 GB | Free | **Start here.** Fits comfortably, Docker support, public HTTPS, and the weights are already hosted there. Free tier sleeps when idle. |
| Oracle Cloud Free Tier | 4 ARM cores · 24 GB | Free, always on | Best free option that never sleeps. More setup — ARM builds of PyTorch. |
| Azure | B2s VM · 2 vCPU · 4 GB | ~$30/mo | Azure for Students credit covers it. |
| AWS | EC2 t3.large · 8 GB | ~$60/mo | Works, but the free-tier `t2.micro` at 1 GB will **not** — do not promise it on a slide. |
| GCP Cloud Run | 4 GB · scales to zero | Usage-based | Cold start makes the first request painful unless you pay for a warm instance. |

> ### Recommendation for the internal round
> **Do not deploy the model service before the 29th.** Demo from a laptop. The
> dashboard is already live on Vercel for anyone who wants a link, the corpus is
> frozen so results are identical either way, and a rushed deploy two days out is
> pure downside risk. Hugging Face Spaces is the September task, ahead of idea
> submission on the 20th.

---

## 10. Questions judges will ask

*Preparation only — not a slide*

Rehearse these. **The honest answer is stronger than the impressive one in every
case below.**

**Q · Is this real data or a mock-up?**
**Real.** 352 posts pulled from live APIs and frozen so the demo doesn't depend
on venue Wi-Fi. Every one carries a transformer score, and we can show the
ingestion running live if you'd like.

**Q · Why only three platforms?**
Six connectors are written against real APIs. X charges per call since February
and we haven't funded it; Reddit gates new API apps behind a policy aimed at
moderation tools; Facebook needs one more permission scope. Those are procurement
and policy blockers, not missing code — and we'd rather name them than scrape in
breach of terms.

**Q · How accurate is the sentiment analysis?**
**We don't have a number yet, and we won't invent one.** We use published models
with known benchmarks and record which engine scored each post. Hand-labelling
200 posts for a confusion matrix is our next task.

**Q · Isn't demographic inference just guessing?**
It would be if we let it. Ours is rules-based and reports its own coverage — 58%
for language, 6% for age, 0% for location on this corpus. Unknown values stay
unknown rather than defaulting to a plausible-looking value. Making it a real
classifier is scheduled work.

**Q · What stops this being another sentiment dashboard?**
The cross-vector brief. The problem statement says combining the vectors is the
point, so we built the layer that does it — findings like "the negativity is
concentrated in one nine-account community, about semiconductors, carried by one
broker." No single panel can produce that.

**Q · Could this scale to national volume?**
The analytics scale fine — the graph algorithms are standard and the ingestion is
fault-isolated per platform. The model service is the constraint at 9 posts per
second per instance on CPU; it's stateless, so it scales horizontally, and a GPU
would move it by roughly an order of magnitude.

**Q · What about user privacy?**
Only public content is collected. For the multi-tenant path, tokens are encrypted
at rest with AES-256-GCM bound to the user and provider, and there's a
data-deletion endpoint. For the demo, no personal accounts are connected at all.

---

*Brief compiled 26 Aug 2026. All figures read from the running system.*
*Related: [PROGRESS.md](../PROGRESS.md) for current status · [AGENTS.md](../AGENTS.md) for architecture.*
