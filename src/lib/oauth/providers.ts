import { PlatformType } from '@/types/intelligence';

/**
 * OAuth provider registry for the multi-tenant product.
 *
 * The credential model here differs fundamentally from the single-tenant one:
 * WE register one developer app per platform; each CUSTOMER then authorises
 * that app against their own account. So the secrets in `.env` are *app*
 * credentials (client id + secret), and every user's access token is obtained
 * at runtime and stored per-user, encrypted.
 *
 * Every entry below is transcribed from the provider's current documentation
 * and annotated with the commercial constraints that actually gate launch —
 * app review, verification, and cost — because those, not the code, are the
 * long poles for a commercial product.
 */

export type ProviderId = 'instagram' | 'facebook' | 'x' | 'reddit' | 'youtube' | 'telegram';

export type AuthKind = 'oauth2' | 'oauth2-pkce' | 'telegram-widget';

export interface ProviderConfig {
  id: ProviderId;
  platform: PlatformType;
  displayName: string;
  authKind: AuthKind;

  /** Env vars holding OUR app credentials (never a user's token). */
  clientIdEnv: string;
  clientSecretEnv: string;

  authorizeUrl: string;
  tokenUrl: string;
  /** Endpoint used to trade a short-lived token for a long-lived one. */
  longLivedUrl?: string;
  revokeUrl?: string;

  scopes: string[];
  /** Extra params appended to the authorize request. */
  extraAuthParams?: Record<string, string>;
  /** Some providers require the secret in a Basic auth header, not the body. */
  tokenAuthStyle: 'body' | 'basic';

  /** Roughly how long access tokens live, for proactive refresh. */
  accessTokenTtlDays?: number;
  supportsRefresh: boolean;

  // ── Commercial reality ────────────────────────────────────────────────
  /** What it costs us to serve one customer on this platform. */
  cost: {
    model: 'free' | 'per-call' | 'subscription' | 'negotiated';
    detail: string;
  };
  /** Gate that must clear before non-test users can connect. */
  launchGate: {
    required: boolean;
    process: string;
    estimatedDuration: string;
  };
  /** Account prerequisites on the customer's side. */
  userPrerequisite?: string;
  docsUrl: string;
}

const GRAPH_VERSION = 'v21.0';

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  // ── Instagram ─────────────────────────────────────────────────────────
  instagram: {
    id: 'instagram',
    platform: 'instagram',
    displayName: 'Instagram',
    authKind: 'oauth2',
    clientIdEnv: 'INSTAGRAM_APP_ID',
    clientSecretEnv: 'INSTAGRAM_APP_SECRET',
    // Business Login lets a Creator/Business account connect WITHOUT a linked
    // Facebook Page, which removes the biggest drop-off in onboarding.
    authorizeUrl: 'https://www.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    longLivedUrl: 'https://graph.instagram.com/access_token',
    scopes: ['instagram_business_basic', 'instagram_business_manage_insights'],
    extraAuthParams: { response_type: 'code' },
    tokenAuthStyle: 'body',
    accessTokenTtlDays: 60,
    // Long-lived tokens are *refreshed* by re-calling the refresh endpoint
    // before day 60; there is no standard refresh_token grant.
    supportsRefresh: true,
    cost: { model: 'free', detail: 'No per-call charge. Rate limited per user.' },
    launchGate: {
      required: true,
      process:
        'Meta Business Verification, then App Review for instagram_business_basic ' +
        'and instagram_business_manage_insights with a screencast showing each scope in use.',
      estimatedDuration: '4-6 weeks',
    },
    userPrerequisite: 'Instagram Professional account (Business or Creator).',
    docsUrl: 'https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login',
  },

  // ── Facebook ──────────────────────────────────────────────────────────
  facebook: {
    id: 'facebook',
    platform: 'facebook',
    displayName: 'Facebook',
    authKind: 'oauth2',
    clientIdEnv: 'FACEBOOK_APP_ID',
    clientSecretEnv: 'FACEBOOK_APP_SECRET',
    authorizeUrl: `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`,
    tokenUrl: `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
    longLivedUrl: `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
    scopes: ['pages_show_list', 'pages_read_engagement', 'read_insights'],
    extraAuthParams: { response_type: 'code' },
    tokenAuthStyle: 'body',
    accessTokenTtlDays: 60,
    supportsRefresh: true,
    cost: { model: 'free', detail: 'No per-call charge. Rate limited per app and per user.' },
    launchGate: {
      required: true,
      process:
        'Meta Business Verification, then App Review for Advanced Access to ' +
        'pages_read_engagement and read_insights. The screencast must show only ' +
        'the read operations requested — asking for manage scopes is a common rejection.',
      estimatedDuration: '3-6 weeks',
    },
    userPrerequisite: 'Admin of at least one Facebook Page.',
    docsUrl: 'https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow',
  },

  // ── X (Twitter) ───────────────────────────────────────────────────────
  x: {
    id: 'x',
    platform: 'x',
    displayName: 'X (Twitter)',
    // X requires PKCE for OAuth 2.0 user-context; there is no non-PKCE path.
    authKind: 'oauth2-pkce',
    clientIdEnv: 'X_CLIENT_ID',
    clientSecretEnv: 'X_CLIENT_SECRET',
    authorizeUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    revokeUrl: 'https://api.twitter.com/2/oauth2/revoke',
    // offline.access is what yields a refresh_token; without it the connection
    // silently dies after two hours.
    scopes: ['tweet.read', 'users.read', 'offline.access'],
    extraAuthParams: { response_type: 'code' },
    tokenAuthStyle: 'basic',
    accessTokenTtlDays: 0.083, // ~2 hours
    supportsRefresh: true,
    cost: {
      model: 'per-call',
      detail:
        'Pay-per-usage since Feb 2026; no free tier. $0.005 per post read and $0.010 ' +
        'per user read — BUT reading a connected user\'s OWN data bills at the "Owned ' +
        'Reads" rate of $0.001 per resource, and identical reads inside a 24h UTC ' +
        'window are charged once. Pay-per-usage is capped at 3M post reads/month.',
    },
    launchGate: {
      required: false,
      process: 'No app review. Requires a funded credit balance before any call succeeds.',
      estimatedDuration: 'immediate once funded',
    },
    docsUrl: 'https://docs.x.com/x-api/getting-started/pricing',
  },

  // ── Reddit ────────────────────────────────────────────────────────────
  reddit: {
    id: 'reddit',
    platform: 'reddit',
    displayName: 'Reddit',
    authKind: 'oauth2',
    clientIdEnv: 'REDDIT_CLIENT_ID',
    clientSecretEnv: 'REDDIT_CLIENT_SECRET',
    authorizeUrl: 'https://www.reddit.com/api/v1/authorize',
    tokenUrl: 'https://www.reddit.com/api/v1/access_token',
    revokeUrl: 'https://www.reddit.com/api/v1/revoke_token',
    scopes: ['identity', 'read', 'history', 'mysubreddits'],
    // duration=permanent is required to receive a refresh_token at all.
    extraAuthParams: { response_type: 'code', duration: 'permanent' },
    tokenAuthStyle: 'basic',
    accessTokenTtlDays: 0.042, // ~1 hour
    supportsRefresh: true,
    cost: {
      model: 'negotiated',
      detail:
        'The free tier (100 queries/min per OAuth client) is NON-COMMERCIAL only. ' +
        'Social/brand monitoring as a commercial product requires a paid Data API ' +
        'agreement negotiated with Reddit. Confirm current terms directly with ' +
        'Reddit before launch — published third-party figures vary and are not authoritative.',
    },
    launchGate: {
      required: true,
      process:
        'App registration now goes through a manual approval queue rather than instant ' +
        'self-service, and commercial use requires a separate agreement with Reddit.',
      estimatedDuration: '2-4 weeks (approval), longer for a commercial agreement',
    },
    docsUrl: 'https://github.com/reddit-archive/reddit/wiki/OAuth2',
  },

  // ── YouTube (Google) ──────────────────────────────────────────────────
  youtube: {
    id: 'youtube',
    platform: 'youtube',
    displayName: 'YouTube',
    authKind: 'oauth2',
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    scopes: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/yt-analytics.readonly',
    ],
    // access_type=offline + prompt=consent is the only reliable way to get a
    // refresh_token from Google; without prompt=consent it is issued once only.
    extraAuthParams: {
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    },
    tokenAuthStyle: 'body',
    accessTokenTtlDays: 0.042, // ~1 hour
    supportsRefresh: true,
    cost: {
      model: 'free',
      detail: 'Free. 10,000 quota units/day per project — the binding constraint at scale.',
    },
    launchGate: {
      required: true,
      process:
        'OAuth consent screen verification. youtube.readonly and yt-analytics.readonly ' +
        'are SENSITIVE (not restricted) scopes, so this needs brand verification and a ' +
        'demo video, but NOT a CASA third-party security assessment.',
      estimatedDuration: '2-6 weeks',
    },
    userPrerequisite: 'A YouTube channel on the connecting Google account.',
    docsUrl: 'https://developers.google.com/youtube/v3/guides/authentication',
  },

  // ── Telegram ──────────────────────────────────────────────────────────
  telegram: {
    id: 'telegram',
    platform: 'telegram',
    displayName: 'Telegram',
    // Telegram has no OAuth 2.0. The Login Widget returns a signed payload that
    // is verified with an HMAC of the bot token — a different flow entirely.
    authKind: 'telegram-widget',
    clientIdEnv: 'TELEGRAM_BOT_USERNAME',
    clientSecretEnv: 'TELEGRAM_BOT_TOKEN',
    authorizeUrl: 'https://oauth.telegram.org/auth',
    tokenUrl: '',
    scopes: [],
    tokenAuthStyle: 'body',
    supportsRefresh: false,
    cost: { model: 'free', detail: 'Free. Bot API rate limits apply.' },
    launchGate: {
      required: false,
      process: 'No review. Create a bot with @BotFather and set its domain with /setdomain.',
      estimatedDuration: 'immediate',
    },
    userPrerequisite:
      'Login identifies the user. To read a channel\'s content the user must add our ' +
      'bot as an administrator of that channel — Telegram exposes no per-user OAuth ' +
      'grant for channel data.',
    docsUrl: 'https://core.telegram.org/widgets/login',
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

export function getProvider(id: string): ProviderConfig | undefined {
  return PROVIDERS[id as ProviderId];
}

/** True when OUR app credentials for this provider are present. */
export function isProviderConfigured(config: ProviderConfig): boolean {
  const id = process.env[config.clientIdEnv];
  const secret = process.env[config.clientSecretEnv];
  return Boolean(id?.trim() && secret?.trim());
}

/**
 * Redirect URI for a provider. Must match the value registered in the
 * provider's developer console EXACTLY, including scheme and trailing path —
 * a mismatch is the single most common cause of a failed OAuth handshake.
 */
export function redirectUri(providerId: ProviderId): string {
  const base = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/api/connect/${providerId}/callback`;
}
