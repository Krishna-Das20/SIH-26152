# Telegram ingestion setup

Telegram is an **Essential (Must-Have)** platform for SIH26152. There are three
ways to read from it, with very different capabilities and costs.

## Route 1 — public web preview (active by default, no credentials)

Any public channel serves a static HTML preview at `https://t.me/s/<channel>`.
`src/lib/ingestion/telegram.ts` parses it. Nothing to configure.

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{"telegramChannel":"durov"}'
```

**Limits:** recent messages only (no history), text posts only, and it is HTML
scraping — Telegram can change the markup at any time. Subscriber counts are
not exposed, so `followerCount` is `null`.

## Route 2 — Bot API (optional)

Gives structured JSON including reply chains, which produce real graph edges.

1. Message [@BotFather](https://t.me/BotFather) → `/newbot` → copy the token.
2. Set `TELEGRAM_BOT_TOKEN` in `.env`.
3. **Add the bot to the channel/group you want to monitor.**
4. For channels, disable privacy mode: `/setprivacy` → Disable.

**Key limit:** a bot only ever sees chats it has been added to. It cannot read
an arbitrary public channel. Use this for channels you control or were invited
to; use Route 1 for open monitoring.

## Route 3 — MTProto, full history (not yet implemented)

The only route with real historical access — full channel archives, member
lists, search. Needed to properly satisfy Component A.

1. Get `api_id` / `api_hash` from <https://my.telegram.org/apps>.
2. Set `TELEGRAM_API_ID` and `TELEGRAM_API_HASH`.
3. Mint a session string **once, locally** — it needs an interactive phone
   login and cannot happen inside a serverless request:

   ```bash
   npm install telegram input
   node scripts/telegram-login.mjs   # to be written
   ```

4. Store the result as `TELEGRAM_SESSION`.

> **Treat the session string as a credential.** It grants full access to that
> Telegram account. Never commit it; keep it only in `.env` and the deployment
> host's secret store.

Once `TELEGRAM_SESSION` exists, add a GramJS-backed branch to
`src/lib/ingestion/telegram.ts` and prefer it over Routes 1 and 2. The module's
`TelegramSource` union already reserves room for it.

## Which route am I on?

Both ingestion endpoints report it:

```json
{ "success": true, "platforms": ["reddit", "telegram"], "telegramSource": "web-preview" }
```

Values: `web-preview`, `bot-api`, or `unavailable` (with a `note` explaining
why). Nothing is ever mocked — if Telegram returns nothing, the response says
so rather than substituting other data.
