# Commercial setup — credentials for a multi-tenant product

## The key shift

In the single-tenant analyst tool, `.env` held **your** tokens. In a commercial
product it holds **your app's** credentials, and every customer authorises that
app against their own account. So:

| | Single-tenant | Multi-tenant (this) |
| :-- | :-- | :-- |
| What is in `.env` | your access tokens | your **app** client id + secret |
| Whose data | yours | each customer's own |
| Token storage | none needed | per-user, **encrypted**, in MongoDB |
| Platform approval | not needed | **required** (this is the long pole) |

**The code is done. The blocker is platform approval**, which takes weeks and
cannot be shortened by engineering.

---

## What you must generate first

```bash
openssl rand -base64 32   # TOKEN_ENCRYPTION_KEY
openssl rand -base64 32   # NEXTAUTH_SECRET
```

`TOKEN_ENCRYPTION_KEY` encrypts every customer token at rest (AES-256-GCM,
bound to `userId:provider`). **The app refuses to start an OAuth flow without
it** rather than obtaining a token it would have to store in plaintext.

> Losing this key makes every stored token undecryptable and forces all users
> to reconnect. Keep it in a secret manager, not in git. Rotating it requires a
> re-encryption migration.

---

## Effort and cost, ranked

| Platform | Approval needed | Time | Cost to you |
| :-- | :-- | :-- | :-- |
| **Telegram** | none | minutes | free |
| **X** | none | hours (funding) | **pay-per-call** |
| **YouTube** | Google OAuth verification | 2–6 weeks | free (quota-capped) |
| **Facebook** | Business Verification + App Review | 3–6 weeks | free |
| **Instagram** | Business Verification + App Review | 4–6 weeks | free |
| **Reddit** | manual app approval + commercial agreement | 2–4 weeks+ | **negotiated** |

**Start Meta and Google verification immediately** — they run in parallel with
development and are the critical path to launch.

---

## 1. Telegram — start here

No review. Working in ten minutes.

1. Message [@BotFather](https://t.me/BotFather) → `/newbot`.
2. `/setdomain` → your production domain (required by the Login Widget).

```env
TELEGRAM_BOT_USERNAME=YourBotName
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
```

> **Real limitation:** Telegram has no OAuth and no per-user data grant. Login
> gives you *identity*. To read a channel, the customer must add your bot as an
> **administrator** of that channel. Say this plainly in your onboarding — it is
> a genuine product constraint, not a bug.

---

## 2. X (Twitter) — no review, but it costs per call

Since **6 February 2026** X is pay-per-usage. There is **no free tier**.
Legacy subscriptions (Basic $200/mo, Pro $5,000/mo) are closed to new signups.

1. <https://developer.x.com/en/portal/dashboard> → create a project + app.
2. Enable **OAuth 2.0**, type **Web App**, set the callback to
   `https://yourdomain.com/api/connect/x/callback`.
3. Fund your credit balance.

```env
X_CLIENT_ID=your_oauth2_client_id
X_CLIENT_SECRET=your_oauth2_client_secret
```

### The economics that make this viable

Published rates: **$0.005** per post read, **$0.010** per user read — but
reading a connected user's **own** data bills at the **Owned Reads** rate of
**$0.001 per resource**, and identical reads inside a 24-hour UTC window are
charged **once**.

Since your customers connect their own accounts, you pay the owned rate. A
rough per-customer estimate:

| Assumption | Value |
| :-- | :-- |
| Posts + replies read per sync | 200 |
| Syncs per day | 4 |
| Owned-read rate | $0.001 |
| **Cost per customer per month** | **≈ $24** |

That is your X floor per seat. **Price above it**, cache aggressively, and
lean on the 24-hour deduplication window — syncing hourly instead of every
15 minutes cuts this ~4× with little analytical loss. Pay-per-usage is capped
at 3M post reads/month before Enterprise is required.

---

## 3. YouTube (Google) — verification required

`youtube.readonly` and `yt-analytics.readonly` are **sensitive** scopes. That
means brand verification and a demo video, but **not** a CASA third-party
security assessment (that applies to *restricted* scopes such as Gmail/Drive).
So no $3,000+ assessor fee.

1. Google Cloud Console → enable **YouTube Data API v3** and
   **YouTube Analytics API**.
2. **OAuth consent screen** → External. Fill in app name, logo, support email,
   and the **authorised domain**.
3. Add both scopes; add the privacy-policy and terms URLs.
4. Create an **OAuth client ID** (Web application) with redirect
   `https://yourdomain.com/api/connect/youtube/callback`.
5. **Submit for verification** — expect 2–6 weeks and follow-up questions.

```env
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_secret
```

> Unverified apps are capped at **100 users** and show an "unverified app"
> warning. That is fine for a pilot, fatal for launch.
>
> **Quota is the real constraint:** 10,000 units/day *per project*, not per
> user. `commentThreads.list` costs 1 unit, `search.list` costs 100. Budget
> roughly 30–50 units per customer sync and you get a few hundred customers per
> project before you must request a quota increase — start that early too.

---

## 4. Facebook — Business Verification + App Review

1. <https://developers.facebook.com/apps> → **Create App** → **Business**.
2. Add **Facebook Login**; set the redirect to
   `https://yourdomain.com/api/connect/facebook/callback`.
3. Complete **Business Verification** (legal documents that match your Meta
   Business Manager details *exactly* — mismatches are the top rejection cause).
4. Request **Advanced Access** for `pages_show_list`, `pages_read_engagement`,
   `read_insights`.
5. Record a screencast showing each requested permission actually being used.

```env
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret
```

> **Request read scopes only.** Asking for `pages_manage_posts` when your
> screencast shows only reading is a standard rejection. Business Verification
> must complete *before* App Review, and reviews have been running ~20 days.

---

## 5. Instagram — the longest path

Use **Business Login for Instagram**, not the old Facebook-linked flow: a
Creator account can then connect **without** a linked Facebook Page, which
removes the biggest onboarding drop-off. The Basic Display API was retired in
**December 2024**; personal accounts are unreachable by any official API.

1. Same Meta app → add **Instagram** product → enable **Business Login**.
2. Redirect: `https://yourdomain.com/api/connect/instagram/callback`.
3. Request `instagram_business_basic` and `instagram_business_manage_insights`.
4. Business Verification, then App Review with a screencast.

```env
INSTAGRAM_APP_ID=your_instagram_app_id
INSTAGRAM_APP_SECRET=your_instagram_app_secret
```

> Your customers need an Instagram **Professional** (Business or Creator)
> account. Your privacy policy must be on the **same domain** as your app's
> homepage URL — a common and avoidable rejection.

---

## 6. Reddit — verify the commercial terms yourself

**Do not assume the free tier covers you.** Reddit's free tier
(100 queries/min per OAuth client) is **non-commercial only**, and social or
brand monitoring sold as a product does not qualify. Self-service app
registration was also tightened in late 2025 — new clients go through a manual
approval queue.

Widely-cited commercial figures (around $0.24 per 1,000 calls, with a large
bundled tier) come from **secondary sources and are not authoritative**.

**Action: contact Reddit directly** via
<https://support.reddithelp.com/hc/en-us/requests/new> and get the current
terms in writing before you build Reddit into a paid plan.

```env
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret
REDDIT_USER_AGENT=YourApp/1.0 (by /u/yourusername)
```

Register as a **web app** (not "script") with redirect
`https://yourdomain.com/api/connect/reddit/callback`.

---

## Compliance you cannot skip

These are launch blockers, not polish.

### Required public pages

Every platform requires these before approval, and Instagram requires the
privacy policy on your app's own domain:

- `/privacy` — privacy policy
- `/terms` — terms of service
- `/privacy/deletion-status` — deletion confirmation lookup

### Meta's Data Deletion Callback

Meta will not grant Advanced Access without a working callback. It is already
implemented at **`/api/privacy/data-deletion`**: it verifies Meta's
`signed_request` HMAC, performs a real deletion, and returns the
`{ url, confirmation_code }` shape Meta expects. Register that URL in your
app's settings.

### Indian law (DPDP Act 2023)

You are a **Data Fiduciary**. Obligations that bite:

- **Consent** must be specific and revocable — the Disconnect button is that.
- **Erasure** on request — `/api/privacy/data-deletion` implements it.
- **Security safeguards** — tokens are AES-256-GCM encrypted at rest.
- **Breach notification** to the Data Protection Board.
- **Purpose limitation** — do not use customer data to train models unless you
  ask separately and explicitly.

### What is already built

| Requirement | Status |
| :-- | :-- |
| Token encryption at rest | ✅ AES-256-GCM, AAD-bound to `userId:provider` |
| OAuth CSRF protection | ✅ `state` in an httpOnly cookie, constant-time compare |
| PKCE for X | ✅ S256 |
| Automatic token refresh | ✅ 5-minute pre-expiry margin |
| Tenant isolation | ✅ every read scoped by `ownerUserId` |
| Data deletion | ✅ user-initiated **and** Meta callback |
| Token revocation on disconnect | ✅ remote revoke, then local delete |
| Privacy / terms pages | ❌ **you must write these** |

---

## Suggested order

**Week 1** — generate keys; ship Telegram; start Meta Business Verification and
Google OAuth verification (both are queues, start them now); write privacy
policy and terms; contact Reddit about commercial terms.

**Week 2–3** — fund X and enable it; keep verifications moving; pilot with
Google's 100-user unverified cap.

**Week 4–6** — Meta App Review with screencasts; request a YouTube quota
increase; launch with whatever has cleared.

A defensible launch is Telegram + X + YouTube, with Instagram and Facebook
switched on as their reviews clear. The UI already reports per-provider
availability from the live environment, so a platform appears the moment its
credentials land — no code change needed.
