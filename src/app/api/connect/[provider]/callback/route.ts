import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import { authOptions } from '@/lib/auth';
import { getProvider, isProviderConfigured, redirectUri, ProviderConfig } from '@/lib/oauth/providers';
import { safeEqual } from '@/lib/crypto';
import { saveAccount } from '@/lib/oauth/tokenStore';
import { fetchProviderIdentity } from '@/lib/oauth/identity';
import { verifyTelegramLogin } from '@/lib/oauth/telegramLogin';

/**
 * OAuth callback: verifies state, exchanges the code, and stores the token
 * against the signed-in user.
 *
 * Everything here runs server-side. The authorization code and the resulting
 * tokens never reach the browser.
 */

function settingsRedirect(status: string, detail?: string): NextResponse {
  const base = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
  const url = new URL('/settings/accounts', base);
  url.searchParams.set('status', status);
  if (detail) url.searchParams.set('detail', detail.slice(0, 200));
  return NextResponse.redirect(url.toString());
}

/** Exchanges an authorization code for tokens. */
async function exchangeCode(
  config: ProviderConfig,
  code: string,
  verifier?: string
): Promise<{ ok: boolean; json?: any; error?: string }> {
  const clientId = process.env[config.clientIdEnv]!;
  const clientSecret = process.env[config.clientSecretEnv]!;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(config.id),
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'SIH26152-AudienceIntelligence/1.0',
  };

  if (config.tokenAuthStyle === 'basic') {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
    // X still wants client_id in the body alongside Basic auth.
    body.set('client_id', clientId);
  } else {
    body.set('client_id', clientId);
    body.set('client_secret', clientSecret);
  }

  if (verifier) body.set('code_verifier', verifier);

  const res = await fetch(config.tokenUrl, { method: 'POST', headers, body, cache: 'no-store' });
  const text = await res.text();

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    // Older Meta endpoints can answer form-encoded rather than JSON.
    json = Object.fromEntries(new URLSearchParams(text));
  }

  if (!res.ok) {
    return { ok: false, error: json?.error_description || json?.error?.message || text.slice(0, 200) };
  }
  return { ok: true, json };
}

/**
 * Trades a short-lived token for a long-lived one where the provider supports
 * it. Meta's initial tokens last ~1 hour; without this the connection would
 * break almost immediately.
 */
async function upgradeToLongLived(
  config: ProviderConfig,
  shortToken: string
): Promise<{ token: string; expiresIn?: number } | null> {
  if (!config.longLivedUrl) return null;

  const clientId = process.env[config.clientIdEnv]!;
  const clientSecret = process.env[config.clientSecretEnv]!;

  let url: string;
  if (config.id === 'instagram') {
    url =
      `${config.longLivedUrl}?grant_type=ig_exchange_token` +
      `&client_secret=${encodeURIComponent(clientSecret)}` +
      `&access_token=${encodeURIComponent(shortToken)}`;
  } else if (config.id === 'facebook') {
    url =
      `${config.longLivedUrl}?grant_type=fb_exchange_token` +
      `&client_id=${encodeURIComponent(clientId)}` +
      `&client_secret=${encodeURIComponent(clientSecret)}` +
      `&fb_exchange_token=${encodeURIComponent(shortToken)}`;
  } else {
    return null;
  }

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    console.warn(`Long-lived token exchange failed for ${config.id}: ${res.status}`);
    return null;
  }
  const json = await res.json();
  return json.access_token ? { token: json.access_token, expiresIn: json.expires_in } : null;
}

export async function GET(req: Request, { params }: { params: { provider: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return settingsRedirect('error', 'Sign in before connecting an account.');

  const config = getProvider(params.provider);
  if (!config) return settingsRedirect('error', `Unknown provider "${params.provider}".`);
  if (!isProviderConfigured(config)) {
    return settingsRedirect('error', `${config.displayName} is not configured on this deployment.`);
  }

  const url = new URL(req.url);
  const jar = cookies();

  // Telegram Login Widget: no code exchange, a signed payload instead.
  if (config.authKind === 'telegram-widget') {
    const payload = Object.fromEntries(url.searchParams.entries());
    const verified = verifyTelegramLogin(payload, process.env[config.clientSecretEnv]!);
    if (!verified.valid) return settingsRedirect('error', `Telegram: ${verified.reason}`);

    await saveAccount({
      userId,
      provider: 'telegram',
      providerAccountId: String(payload.id),
      displayName: [payload.first_name, payload.last_name].filter(Boolean).join(' ') || 'Telegram user',
      username: payload.username,
      avatarUrl: payload.photo_url,
      // The widget authenticates identity; it issues no API token. Channel
      // reads go through our bot, which the user adds as a channel admin.
      accessToken: `tg_identity:${payload.id}`,
      scopes: ['identity'],
    });
    return settingsRedirect('connected', 'telegram');
  }

  // The provider reports user denial or its own failure here.
  const error = url.searchParams.get('error');
  if (error) {
    const desc = url.searchParams.get('error_description') || error;
    return settingsRedirect(error === 'access_denied' ? 'cancelled' : 'error', desc);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return settingsRedirect('error', 'Missing authorization code or state.');

  // CSRF check. Compared in constant time, and the cookie is cleared whatever
  // the outcome so a state value can never be replayed.
  const expectedState = jar.get(`oauth_state_${config.id}`)?.value;
  jar.delete(`oauth_state_${config.id}`);

  if (!expectedState || !safeEqual(state, expectedState)) {
    return settingsRedirect('error', 'State mismatch — the connection attempt was rejected.');
  }

  let verifier: string | undefined;
  if (config.authKind === 'oauth2-pkce') {
    verifier = jar.get(`oauth_verifier_${config.id}`)?.value;
    jar.delete(`oauth_verifier_${config.id}`);
    if (!verifier) return settingsRedirect('error', 'PKCE verifier missing or expired.');
  }

  try {
    const exchanged = await exchangeCode(config, code, verifier);
    if (!exchanged.ok) return settingsRedirect('error', exchanged.error || 'Token exchange failed.');

    let accessToken: string = exchanged.json.access_token;
    let expiresIn: number | undefined = exchanged.json.expires_in;
    const refreshToken: string | undefined = exchanged.json.refresh_token;

    if (!accessToken) return settingsRedirect('error', 'Provider returned no access token.');

    const upgraded = await upgradeToLongLived(config, accessToken);
    if (upgraded) {
      accessToken = upgraded.token;
      expiresIn = upgraded.expiresIn ?? expiresIn;
    }

    // Identify the account so the UI can show who was connected, and so two
    // accounts on the same provider are stored separately.
    const identity = await fetchProviderIdentity(config, accessToken);

    await saveAccount({
      userId,
      provider: config.id,
      providerAccountId: identity.id,
      displayName: identity.displayName,
      username: identity.username,
      avatarUrl: identity.avatarUrl,
      accessToken,
      refreshToken,
      expiresInSeconds: expiresIn,
      scopes:
        typeof exchanged.json.scope === 'string'
          ? exchanged.json.scope.split(/[\s,]+/).filter(Boolean)
          : config.scopes,
    });

    return settingsRedirect('connected', config.id);
  } catch (err: any) {
    console.error(`OAuth callback failed for ${config.id}:`, err);
    return settingsRedirect('error', err?.message || 'Unexpected error during connection.');
  }
}
