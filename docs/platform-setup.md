# Platform setup — all six platforms

Every platform named in SIH26152 has a working connector in
`src/lib/ingestion/`. Nothing is simulated. What separates a *live* platform
from a *dormant* one is only whether its credentials are present.

Check live status any time at **`/api/platforms`**, or in the dashboard's
"Component A — Platform Coverage" panel.

## Reality check (all verified 2026-08-25)

| Platform | Tier | Credentials | Cost | Effort |
| :-- | :-- | :-- | :-- | :-- |
| **Telegram** | Essential | none for public channels | **free** | **already working** |
| **X (Twitter)** | Essential | `X_BEARER_TOKEN` | **~$100/mo** | payment required |
| Instagram | Desirable | `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ID` | free | ~20 min, account setup |
| Facebook | Desirable | `FACEBOOK_PAGE_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID` | free | ~15 min |
| Reddit | Appreciable | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` | free | **~2 min** |
| YouTube | Appreciable | `YOUTUBE_API_KEY` | free | **~5 min** |

**Do Reddit and YouTube first** — together they take under ten minutes and cost
nothing. Then Instagram and Facebook. X last, since it is the only one that
requires spending money.

---

## Reddit

*Fastest win. Two minutes, free.*

The old no-key route is gone: `www.reddit.com/r/<sub>/hot.json` now returns
**403**, and `old.reddit.com` redirects to a login page.

1. Go to <https://www.reddit.com/prefs/apps>.
2. **Create another app...** at the bottom.
3. Name: anything. Type: **script**. Redirect URI: `http://localhost:3000`.
4. Create. The **client id** is the string under the app name; the
   **secret** is labelled `secret`.

```env
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_secret
REDDIT_USER_AGENT=SIH26152-AudienceIntelligence/1.0
```

The connector uses the `client_credentials` grant, so no Reddit account is
linked and no user login happens. Tokens are cached until expiry.

**Test:** `{"targets":[{"platform":"reddit","target":"india"}]}` to `/api/ingest`.

---

## YouTube

*Five minutes, free. 10,000 quota units/day.*

1. <https://console.cloud.google.com/> → create or pick a project.
2. **APIs & Services → Library** → enable **YouTube Data API v3**.
3. **Credentials → Create credentials → API key**.
4. Restrict the key to the YouTube Data API (recommended).

```env
YOUTUBE_API_KEY=your_key
```

Accepts a video URL/id, a `@channel` handle, or a search phrase.

> **Quota:** `search.list` costs **100 units** per call versus 1 for
> `commentThreads.list`. Prefer a concrete video or channel over a search
> phrase — a few dozen searches will exhaust the daily quota.

---

## Instagram

*~20 minutes, free, but needs account setup.*

There is no public route. `?__a=1` no longer returns profile JSON, the internal
`web_profile_info` endpoint 429s unauthenticated callers, and the Basic Display
API was retired in **December 2024**. The Graph API is the only supported path.

**Prerequisites:** an Instagram **Business or Creator** account, linked to a
Facebook Page. (Instagram app → Settings → Account type → switch to
Professional, then link a Page.)

1. <https://developers.facebook.com/apps> → **Create App** → type **Business**.
2. Add the **Instagram Graph API** product.
3. Open **Graph API Explorer**, select your app, and request these permissions:
   `instagram_basic`, `instagram_manage_insights`, `pages_show_list`,
   `pages_read_engagement`.
4. Generate a token, then **exchange it for a long-lived one** (60 days):

```bash
curl "https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_LIVED_TOKEN"
```

5. Find your Instagram Business account id:

```bash
curl "https://graph.facebook.com/v21.0/me/accounts?access_token=TOKEN"
curl "https://graph.facebook.com/v21.0/PAGE_ID?fields=instagram_business_account&access_token=TOKEN"
```

```env
INSTAGRAM_ACCESS_TOKEN=your_long_lived_token
INSTAGRAM_BUSINESS_ID=17841400000000000
```

**Two capabilities:**
- Blank target → your own media plus its comments (first-party audience data).
- `#hashtag` target → public media carrying that hashtag.

> **Limits:** hashtag search is capped at **30 unique hashtags per rolling
> 7 days** per account. Long-lived tokens expire after **60 days** — the
> connector reports a clear `unauthorized` when that happens.

---

## Facebook

*~15 minutes, free for Pages you administer.*

Anonymous Graph calls return `(#200) Provide valid app ID`. You need a token.

1. Same app as Instagram (or a new Business-type app).
2. Add the **Facebook Login** product.
3. In **Graph API Explorer**, request `pages_show_list`,
   `pages_read_engagement`, `pages_read_user_content`.
4. Get a **Page access token** (not a user token):

```bash
curl "https://graph.facebook.com/v21.0/me/accounts?access_token=USER_TOKEN"
```

The response lists each Page you administer with its own `access_token` and `id`.

```env
FACEBOOK_PAGE_ACCESS_TOKEN=your_page_token
FACEBOOK_PAGE_ID=your_page_id
```

> **Hard limit:** this reads Pages the token administers. Reading *arbitrary*
> third-party Pages requires **Page Public Content Access**, which needs Meta
> App Review plus business verification — a multi-week process, not a code
> change. For the hackathon, create a Page, post to it, and analyse that.

---

## X (Twitter)

*The only platform that costs money.*

Every free route is closed. Verified 2026-08-25:

| Route | Result |
| :-- | :-- |
| `cdn.syndication.twimg.com/timeline/profile` | 200 with an **empty body** |
| `syndication.twitter.com/srv/timeline-profile` | 429 |
| `api.twitter.com/2/*` without a token | 401 |

The **Free** tier permits posting but **not reading**. Reading needs **Basic**
(~$100/month, 10,000 tweets/month) or higher.

1. <https://developer.x.com/en/portal/dashboard> → create a project + app.
2. Subscribe to **Basic** (or higher).
3. **Keys and tokens** → generate a **Bearer Token**.

```env
X_BEARER_TOKEN=your_bearer_token
```

Accepts a `@handle`, an `x.com/<handle>` URL, or a search phrase (recent search
covers the last 7 days on Basic).

> **If you cannot fund this:** say so explicitly in your submission — "X
> connector implemented and tested against the v2 contract; not activated
> because the read tier is paid" is a defensible engineering position. Mocking
> X and presenting it as live is not, and it is exactly the kind of thing a
> technical judge checks.

---

## Telegram

Already working with **no credentials**. See [telegram-setup.md](telegram-setup.md)
for the Bot API and MTProto routes.

---

## Verifying

```bash
curl http://localhost:3000/api/platforms
```

Returns per-platform `configured` state computed from the live environment,
plus a tier-by-tier summary. Then ingest across everything configured:

```bash
curl -X POST http://localhost:3000/api/ingest -H 'Content-Type: application/json' -d '{}'
```

The response's `results[]` gives each platform's status, count, and — when it
returned nothing — the reason. A platform that is merely unconfigured is never
reported as "no activity".
