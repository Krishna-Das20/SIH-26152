import { Db } from 'mongodb';
import { getDatabase } from '@/lib/mongodb';
import { encryptToken, decryptToken, tokenHint } from '@/lib/crypto';
import { ProviderId, getProvider, redirectUri } from './providers';

/**
 * Per-user storage for connected social accounts.
 *
 * Multi-tenant invariants, all enforced here rather than at call sites:
 *
 *  1. Every record is keyed by `userId`. No query in this module runs without
 *     a userId filter, so one customer's tokens can never be returned to
 *     another.
 *  2. Tokens are encrypted before insert and decrypted only in memory, with
 *     `userId:provider` as the AAD — a record copied between users fails to
 *     decrypt rather than working.
 *  3. Nothing that leaves this module contains a raw token. `ConnectedAccount`
 *     is the public shape and deliberately has no token fields.
 */

export interface StoredAccount {
  userId: string;
  provider: ProviderId;
  /** The account id on the provider's side. */
  providerAccountId: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;

  accessTokenEnc: string;
  refreshTokenEnc?: string;
  /** ISO timestamp when the access token expires. */
  expiresAt?: string;
  scopes: string[];

  connectedAt: string;
  lastRefreshedAt?: string;
  lastSyncedAt?: string;
  /** Set when the provider has rejected the token and re-consent is needed. */
  needsReauth?: boolean;
  lastError?: string;
}

/** Safe projection returned to the UI — never includes token material. */
export interface ConnectedAccount {
  provider: ProviderId;
  providerAccountId: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  scopes: string[];
  connectedAt: string;
  lastSyncedAt?: string;
  expiresAt?: string;
  needsReauth: boolean;
  /** Non-identifying token fingerprint, for support ("••••a1b2"). */
  tokenHint?: string;
}

const COLLECTION = 'connected_accounts';

async function collection(): Promise<Db | null> {
  return getDatabase();
}

let indexesEnsured = false;
async function ensureIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  indexesEnsured = true;
  try {
    // One record per (user, provider, provider account) — a user may legitimately
    // connect two YouTube channels, but not the same one twice.
    await db
      .collection(COLLECTION)
      .createIndex({ userId: 1, provider: 1, providerAccountId: 1 }, { unique: true, name: 'uniq_user_provider_account' });
    await db.collection(COLLECTION).createIndex({ userId: 1 }, { name: 'by_user' });
  } catch (e) {
    console.warn('Could not ensure connected_accounts indexes:', e);
    indexesEnsured = false;
  }
}

function aadFor(userId: string, provider: ProviderId): string {
  return `${userId}:${provider}`;
}

function toPublic(a: StoredAccount): ConnectedAccount {
  return {
    provider: a.provider,
    providerAccountId: a.providerAccountId,
    displayName: a.displayName,
    username: a.username,
    avatarUrl: a.avatarUrl,
    scopes: a.scopes,
    connectedAt: a.connectedAt,
    lastSyncedAt: a.lastSyncedAt,
    expiresAt: a.expiresAt,
    needsReauth: Boolean(a.needsReauth),
  };
}

export interface SaveAccountInput {
  userId: string;
  provider: ProviderId;
  providerAccountId: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds?: number;
  scopes: string[];
}

export async function saveAccount(input: SaveAccountInput): Promise<ConnectedAccount | null> {
  const db = await collection();
  if (!db) throw new Error('Database unavailable; cannot store a connected account.');
  await ensureIndexes(db);

  const aad = aadFor(input.userId, input.provider);
  const now = new Date().toISOString();

  const record: StoredAccount = {
    userId: input.userId,
    provider: input.provider,
    providerAccountId: input.providerAccountId,
    displayName: input.displayName,
    username: input.username,
    avatarUrl: input.avatarUrl,
    accessTokenEnc: encryptToken(input.accessToken, aad),
    refreshTokenEnc: input.refreshToken ? encryptToken(input.refreshToken, aad) : undefined,
    expiresAt: input.expiresInSeconds
      ? new Date(Date.now() + input.expiresInSeconds * 1000).toISOString()
      : undefined,
    scopes: input.scopes,
    connectedAt: now,
    needsReauth: false,
  };

  await db.collection<StoredAccount>(COLLECTION).updateOne(
    {
      userId: input.userId,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
    },
    {
      $set: { ...record, connectedAt: undefined as never },
      // Preserve the original connection date across reconnects.
      $setOnInsert: { connectedAt: now },
    },
    { upsert: true }
  );

  return toPublic(record);
}

export async function listAccounts(userId: string): Promise<ConnectedAccount[]> {
  const db = await collection();
  if (!db) return [];
  await ensureIndexes(db);

  const rows = await db.collection<StoredAccount>(COLLECTION).find({ userId }).toArray();
  return rows.map((r) => ({
    ...toPublic(r),
    tokenHint: (() => {
      try {
        return tokenHint(decryptToken(r.accessTokenEnc, aadFor(userId, r.provider)));
      } catch {
        return undefined;
      }
    })(),
  }));
}

export async function disconnectAccount(
  userId: string,
  provider: ProviderId,
  providerAccountId?: string
): Promise<number> {
  const db = await collection();
  if (!db) return 0;

  const filter: Record<string, unknown> = { userId, provider };
  if (providerAccountId) filter.providerAccountId = providerAccountId;

  const result = await db.collection<StoredAccount>(COLLECTION).deleteMany(filter as any);
  return result.deletedCount ?? 0;
}

/** Deletes everything held for a user. Backs the data-deletion obligation. */
export async function deleteAllForUser(userId: string): Promise<number> {
  const db = await collection();
  if (!db) return 0;
  const result = await db.collection<StoredAccount>(COLLECTION).deleteMany({ userId });
  return result.deletedCount ?? 0;
}

async function markNeedsReauth(userId: string, provider: ProviderId, reason: string): Promise<void> {
  const db = await collection();
  if (!db) return;
  await db
    .collection<StoredAccount>(COLLECTION)
    .updateMany({ userId, provider }, { $set: { needsReauth: true, lastError: reason } });
}

/**
 * Exchanges a refresh token for a fresh access token.
 * Returns null when the provider rejects it, having flagged the account so the
 * UI can prompt for re-consent instead of silently returning stale data.
 */
async function refreshAccessToken(
  account: StoredAccount
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number } | null> {
  const config = getProvider(account.provider);
  if (!config || !config.supportsRefresh || !account.refreshTokenEnc) return null;

  const aad = aadFor(account.userId, account.provider);
  const refreshToken = decryptToken(account.refreshTokenEnc, aad);

  const clientId = process.env[config.clientIdEnv] || '';
  const clientSecret = process.env[config.clientSecretEnv] || '';

  // Meta refreshes a long-lived token by re-exchanging it, not via a
  // refresh_token grant — a different shape from every other provider here.
  if (account.provider === 'instagram') {
    const url = `${config.longLivedUrl}?grant_type=ig_refresh_token&access_token=${encodeURIComponent(
      decryptToken(account.accessTokenEnc, aad)
    )}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      await markNeedsReauth(account.userId, account.provider, `refresh failed: ${res.status}`);
      return null;
    }
    const json = await res.json();
    return { accessToken: json.access_token, expiresIn: json.expires_in };
  }

  if (account.provider === 'facebook') {
    const url =
      `${config.longLivedUrl}?grant_type=fb_exchange_token` +
      `&client_id=${encodeURIComponent(clientId)}` +
      `&client_secret=${encodeURIComponent(clientSecret)}` +
      `&fb_exchange_token=${encodeURIComponent(decryptToken(account.accessTokenEnc, aad))}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      await markNeedsReauth(account.userId, account.provider, `refresh failed: ${res.status}`);
      return null;
    }
    const json = await res.json();
    return { accessToken: json.access_token, expiresIn: json.expires_in };
  }

  // Standard RFC 6749 refresh_token grant (X, Reddit, Google).
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'SIH26152-AudienceIntelligence/1.0',
  };

  if (config.tokenAuthStyle === 'basic') {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  } else {
    body.set('client_id', clientId);
    body.set('client_secret', clientSecret);
  }

  const res = await fetch(config.tokenUrl, { method: 'POST', headers, body, cache: 'no-store' });
  if (!res.ok) {
    await markNeedsReauth(
      account.userId,
      account.provider,
      `refresh failed: ${res.status} ${await res.text().catch(() => '')}`.slice(0, 200)
    );
    return null;
  }

  const json = await res.json();
  return {
    accessToken: json.access_token,
    // Providers that rotate refresh tokens (X does) return a new one; keeping
    // the old one would break the next refresh.
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in,
  };
}

/**
 * Returns a usable access token for a user's connected account, refreshing it
 * first when it is expired or close to expiry.
 *
 * This is the ONLY way callers should obtain a token — it centralises the
 * refresh-before-use logic so no ingestion path can accidentally send an
 * expired credential.
 */
export async function getAccessToken(
  userId: string,
  provider: ProviderId,
  providerAccountId?: string
): Promise<string | null> {
  const db = await collection();
  if (!db) return null;

  const filter: Record<string, unknown> = { userId, provider };
  if (providerAccountId) filter.providerAccountId = providerAccountId;

  const account = await db.collection<StoredAccount>(COLLECTION).findOne(filter as any);
  if (!account || account.needsReauth) return null;

  const aad = aadFor(userId, provider);

  // Refresh with a five-minute margin so a token cannot expire mid-request.
  const expiresSoon =
    account.expiresAt && new Date(account.expiresAt).getTime() - Date.now() < 5 * 60 * 1000;

  if (!expiresSoon) {
    try {
      return decryptToken(account.accessTokenEnc, aad);
    } catch (e) {
      console.error('Token decryption failed — key rotated or record tampered with.', e);
      await markNeedsReauth(userId, provider, 'decryption failed');
      return null;
    }
  }

  const refreshed = await refreshAccessToken(account);
  if (!refreshed) return null;

  await db.collection<StoredAccount>(COLLECTION).updateOne(filter as any, {
    $set: {
      accessTokenEnc: encryptToken(refreshed.accessToken, aad),
      ...(refreshed.refreshToken
        ? { refreshTokenEnc: encryptToken(refreshed.refreshToken, aad) }
        : {}),
      ...(refreshed.expiresIn
        ? { expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString() }
        : {}),
      lastRefreshedAt: new Date().toISOString(),
      needsReauth: false,
    },
  });

  return refreshed.accessToken;
}

/** Records a successful sync, for display in the UI. */
export async function markSynced(userId: string, provider: ProviderId): Promise<void> {
  const db = await collection();
  if (!db) return;
  await db
    .collection<StoredAccount>(COLLECTION)
    .updateMany({ userId, provider }, { $set: { lastSyncedAt: new Date().toISOString() } });
}

/**
 * Best-effort revocation at the provider, then local deletion.
 * Local deletion happens regardless: a provider being unreachable must never
 * leave us holding a token the user asked us to drop.
 */
export async function revokeAndDisconnect(
  userId: string,
  provider: ProviderId,
  providerAccountId?: string
): Promise<{ revokedRemotely: boolean; deleted: number }> {
  const config = getProvider(provider);
  let revokedRemotely = false;

  if (config?.revokeUrl) {
    try {
      const token = await getAccessToken(userId, provider, providerAccountId);
      if (token) {
        const clientId = process.env[config.clientIdEnv] || '';
        const clientSecret = process.env[config.clientSecretEnv] || '';
        const headers: Record<string, string> = {
          'Content-Type': 'application/x-www-form-urlencoded',
        };
        if (config.tokenAuthStyle === 'basic') {
          headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
        }
        const res = await fetch(config.revokeUrl, {
          method: 'POST',
          headers,
          body: new URLSearchParams({ token, token_type_hint: 'access_token' }),
        });
        revokedRemotely = res.ok;
      }
    } catch (e) {
      console.warn(`Remote revocation failed for ${provider}:`, e);
    }
  }

  const deleted = await disconnectAccount(userId, provider, providerAccountId);
  return { revokedRemotely, deleted };
}

export { redirectUri };
