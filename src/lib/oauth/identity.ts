import { ProviderConfig } from './providers';

/**
 * Resolves "who did the user just connect?" immediately after the OAuth
 * exchange.
 *
 * Needed for two reasons: the UI must show a recognisable account rather than
 * an opaque id, and `providerAccountId` is part of the storage key — a user
 * may legitimately connect two YouTube channels or two Facebook Pages, and
 * without a stable per-account id the second would overwrite the first.
 *
 * Identity lookup must never fail the whole connection: a token that works for
 * data but not for the profile endpoint is still worth keeping, so every
 * branch degrades to a placeholder id rather than throwing.
 */

export interface ProviderIdentity {
  id: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
}

const GRAPH = 'https://graph.facebook.com/v21.0';

async function getJson(url: string, headers?: Record<string, string>): Promise<any | null> {
  try {
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) {
      console.warn(`Identity lookup returned ${res.status} for ${new URL(url).host}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn('Identity lookup failed:', e);
    return null;
  }
}

function fallback(config: ProviderConfig): ProviderIdentity {
  return {
    // Timestamped so two failed lookups do not collide on the same key and
    // silently overwrite each other.
    id: `${config.id}_unidentified_${Date.now()}`,
    displayName: `${config.displayName} account`,
  };
}

export async function fetchProviderIdentity(
  config: ProviderConfig,
  accessToken: string
): Promise<ProviderIdentity> {
  switch (config.id) {
    case 'instagram': {
      const json = await getJson(
        `https://graph.instagram.com/v21.0/me?fields=id,username,name,profile_picture_url&access_token=${encodeURIComponent(accessToken)}`
      );
      if (!json?.id) return fallback(config);
      return {
        id: String(json.id),
        displayName: json.name || json.username || 'Instagram account',
        username: json.username,
        avatarUrl: json.profile_picture_url,
      };
    }

    case 'facebook': {
      // Identify by the first Page the token administers, not the person —
      // Page insights are what the product actually reads.
      const pages = await getJson(
        `${GRAPH}/me/accounts?fields=id,name,picture&access_token=${encodeURIComponent(accessToken)}`
      );
      const page = pages?.data?.[0];
      if (page?.id) {
        return {
          id: String(page.id),
          displayName: page.name || 'Facebook Page',
          avatarUrl: page.picture?.data?.url,
        };
      }
      const me = await getJson(
        `${GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`
      );
      if (!me?.id) return fallback(config);
      return { id: String(me.id), displayName: me.name || 'Facebook account' };
    }

    case 'x': {
      const json = await getJson(
        'https://api.twitter.com/2/users/me?user.fields=username,name,profile_image_url',
        { Authorization: `Bearer ${accessToken}` }
      );
      const d = json?.data;
      if (!d?.id) return fallback(config);
      return {
        id: String(d.id),
        displayName: d.name || d.username,
        username: d.username,
        avatarUrl: d.profile_image_url,
      };
    }

    case 'reddit': {
      const json = await getJson('https://oauth.reddit.com/api/v1/me', {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': process.env.REDDIT_USER_AGENT || 'SIH26152-AudienceIntelligence/1.0',
      });
      if (!json?.id) return fallback(config);
      return {
        id: String(json.id),
        displayName: json.name ? `u/${json.name}` : 'Reddit account',
        username: json.name,
        avatarUrl: typeof json.icon_img === 'string' ? json.icon_img.split('?')[0] : undefined,
      };
    }

    case 'youtube': {
      const json = await getJson(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        { Authorization: `Bearer ${accessToken}` }
      );
      const ch = json?.items?.[0];
      if (!ch?.id) return fallback(config);
      return {
        id: String(ch.id),
        displayName: ch.snippet?.title || 'YouTube channel',
        username: ch.snippet?.customUrl,
        avatarUrl: ch.snippet?.thumbnails?.default?.url,
      };
    }

    default:
      return fallback(config);
  }
}
