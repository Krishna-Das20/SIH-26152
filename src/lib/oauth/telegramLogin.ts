import crypto from 'crypto';

/**
 * Verifies a Telegram Login Widget payload.
 *
 * Telegram does not implement OAuth 2.0. The widget redirects back with the
 * user's profile fields plus a `hash`. Authenticity is proved by recomputing
 * an HMAC-SHA256 over the sorted fields, keyed by SHA256(bot_token), per
 * https://core.telegram.org/widgets/login#checking-authorization.
 *
 * Without this check the callback would accept any hand-crafted query string,
 * letting anyone attach an arbitrary Telegram identity to their account.
 */

export interface TelegramVerification {
  valid: boolean;
  reason?: string;
}

/** Payloads older than this are rejected as replays. */
const MAX_AUTH_AGE_SECONDS = 86400; // Telegram's own recommendation

export function verifyTelegramLogin(
  payload: Record<string, string>,
  botToken: string
): TelegramVerification {
  const { hash, auth_date, id } = payload;

  if (!hash) return { valid: false, reason: 'missing hash' };
  if (!id) return { valid: false, reason: 'missing user id' };
  if (!botToken) return { valid: false, reason: 'bot token not configured' };

  // The data-check string is every field except `hash`, as `key=value`,
  // sorted by key and joined with newlines.
  const dataCheckString = Object.keys(payload)
    .filter((k) => k !== 'hash')
    .sort()
    .map((k) => `${k}=${payload[k]}`)
    .join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: 'signature mismatch' };
  }

  // Freshness check: a valid signature stays valid forever, so without this a
  // captured login URL could be replayed indefinitely.
  const authDate = Number(auth_date);
  if (!Number.isFinite(authDate)) return { valid: false, reason: 'invalid auth_date' };

  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds > MAX_AUTH_AGE_SECONDS) {
    return { valid: false, reason: 'login payload expired — please sign in again' };
  }
  if (ageSeconds < -300) {
    // Clock skew beyond five minutes into the future is not plausible.
    return { valid: false, reason: 'auth_date is in the future' };
  }

  return { valid: true };
}
