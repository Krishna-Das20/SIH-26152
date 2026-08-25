import { SocialPost, PlatformType } from '@/types/intelligence';
import { ProviderId } from '@/lib/oauth/providers';
import { getAccessToken, listAccounts, markSynced } from '@/lib/oauth/tokenStore';
import { enrichPosts } from '@/lib/ml/client';
import { ConnectorResult } from './types';

/**
 * Multi-tenant ingestion: pulls a user's OWN data using the token they granted.
 *
 * This is the commercial product's data path, and it differs from the
 * single-tenant connectors in `registry.ts` in three ways that matter:
 *
 *  1. **Token source.** Credentials come from the per-user encrypted store,
 *     not from `process.env`. Two customers hitting the same platform use
 *     different tokens and see only their own data.
 *
 *  2. **Ownership tagging.** Every post is stamped with `ownerUserId`. Any
 *     query that forgets to filter on it would leak one tenant's data to
 *     another, so it is applied here at the single point of creation rather
 *     than being left to call sites.
 *
 *  3. **Cost profile.** These are "owned reads" — a user's own posts and the
 *     engagement on them. On X that is billed at $0.001/resource rather than
 *     $0.005, which is what makes per-seat pricing viable.
 */

export interface UserIngestResult {
  posts: SocialPost[];
  results: ConnectorResult[];
  connectedProviders: ProviderId[];
}

/** Stamps ownership and namespaces ids so two tenants never collide. */
function tagOwnership(posts: SocialPost[], userId: string): SocialPost[] {
  return posts.map((p) => ({
    ...p,
    // Namespaced because two customers may both connect, say, the same public
    // channel — identical provider ids must not overwrite each other.
    id: `${userId}::${p.id}`,
    ownerUserId: userId,
  }));
}

// ── Per-provider "my own data" fetchers ─────────────────────────────────

async function fetchOwnInstagram(token: string, limit: number): Promise<SocialPost[]> {
  const { instagramOwnMedia } = await import('./owned/instagramOwned');
  return instagramOwnMedia(token, limit);
}

async function fetchOwnFacebook(token: string, limit: number): Promise<SocialPost[]> {
  const { facebookOwnPages } = await import('./owned/facebookOwned');
  return facebookOwnPages(token, limit);
}

async function fetchOwnX(token: string, limit: number): Promise<SocialPost[]> {
  const { xOwnTimeline } = await import('./owned/xOwned');
  return xOwnTimeline(token, limit);
}

async function fetchOwnReddit(token: string, limit: number): Promise<SocialPost[]> {
  const { redditOwnHistory } = await import('./owned/redditOwned');
  return redditOwnHistory(token, limit);
}

async function fetchOwnYouTube(token: string, limit: number): Promise<SocialPost[]> {
  const { youtubeOwnChannel } = await import('./owned/youtubeOwned');
  return youtubeOwnChannel(token, limit);
}

const FETCHERS: Partial<Record<ProviderId, (token: string, limit: number) => Promise<SocialPost[]>>> = {
  instagram: fetchOwnInstagram,
  facebook: fetchOwnFacebook,
  x: fetchOwnX,
  reddit: fetchOwnReddit,
  youtube: fetchOwnYouTube,
};

/**
 * Ingests from every account the user has connected.
 *
 * Providers run in parallel and are fault-isolated: an expired Instagram token
 * must not stop YouTube from syncing.
 */
export async function ingestForUser(
  userId: string,
  limitPerProvider = 25
): Promise<UserIngestResult> {
  const accounts = await listAccounts(userId);
  const connected = accounts.filter((a) => !a.needsReauth).map((a) => a.provider);

  const settled = await Promise.all(
    connected.map(async (provider): Promise<ConnectorResult> => {
      const platform = provider as PlatformType;
      const fetcher = FETCHERS[provider];

      if (!fetcher) {
        return {
          platform,
          posts: [],
          status: 'ok',
          note:
            provider === 'telegram'
              ? 'Telegram login provides identity only. Add our bot as an administrator ' +
                'of a channel to ingest its content.'
              : 'No owned-data fetcher for this provider.',
        };
      }

      const token = await getAccessToken(userId, provider);
      if (!token) {
        return {
          platform,
          posts: [],
          status: 'unauthorized',
          note: 'Access token expired or was revoked. Reconnect this account.',
        };
      }

      try {
        const posts = await fetcher(token, limitPerProvider);
        await markSynced(userId, provider);
        return { platform, posts, status: 'ok', source: 'user-oauth' };
      } catch (err) {
        return { platform, posts: [], status: 'error', note: String(err).slice(0, 200) };
      }
    })
  );

  const merged = tagOwnership(
    settled.flatMap((r) => r.posts),
    userId
  );

  // One ML pass across every platform is far cheaper than one per provider.
  const scored = merged.length > 0 ? await enrichPosts(merged) : [];

  return { posts: scored, results: settled, connectedProviders: connected };
}
