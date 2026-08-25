import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import { authOptions } from '@/lib/auth';
import { getProvider, isProviderConfigured, redirectUri } from '@/lib/oauth/providers';
import { randomToken, pkceChallenge } from '@/lib/crypto';
import { isEncryptionConfigured } from '@/lib/crypto';

/**
 * Starts the OAuth authorisation flow for one provider.
 *
 * Security properties:
 *  - Requires an authenticated session. A connected account belongs to a
 *    specific user, so there must be a user to attach it to.
 *  - Issues a random `state`, stored in an httpOnly cookie and verified on
 *    callback. Without it, an attacker can complete a flow with their own
 *    authorization code and attach THEIR account to the victim's session
 *    (OAuth login CSRF).
 *  - For PKCE providers, generates a fresh verifier per attempt so an
 *    intercepted authorization code cannot be redeemed without it.
 *  - Refuses to start if token encryption is unconfigured, rather than
 *    obtaining a token it would have to store in plaintext.
 */
export async function GET(req: Request, { params }: { params: { provider: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  if (!userId) {
    const url = new URL('/auth/signin', process.env.NEXTAUTH_URL || 'http://localhost:3000');
    url.searchParams.set('callbackUrl', `/settings/accounts`);
    return NextResponse.redirect(url);
  }

  const config = getProvider(params.provider);
  if (!config) {
    return NextResponse.json({ error: `Unknown provider "${params.provider}".` }, { status: 404 });
  }

  if (!isEncryptionConfigured()) {
    return NextResponse.json(
      {
        error:
          'TOKEN_ENCRYPTION_KEY is not configured. Refusing to obtain an access token ' +
          'that could not be stored encrypted. Generate one with: openssl rand -base64 32',
      },
      { status: 500 }
    );
  }

  if (!isProviderConfigured(config)) {
    return NextResponse.json(
      {
        error: `${config.displayName} is not configured on this deployment.`,
        missing: [config.clientIdEnv, config.clientSecretEnv],
        docs: config.docsUrl,
      },
      { status: 503 }
    );
  }

  // Telegram is not OAuth 2.0 — it uses a signed Login Widget payload posted
  // back to the callback, so there is no authorize URL to redirect to here.
  if (config.authKind === 'telegram-widget') {
    return NextResponse.json({
      authKind: 'telegram-widget',
      botUsername: process.env[config.clientIdEnv],
      callbackUrl: redirectUri(config.id),
      instructions:
        'Render the Telegram Login Widget with this bot username; it posts a signed ' +
        'payload to the callback URL, which is verified with an HMAC of the bot token.',
    });
  }

  const state = randomToken(32);
  const jar = cookies();
  const secure = (process.env.NEXTAUTH_URL || '').startsWith('https');

  // Bind the state cookie to this provider so two concurrent connect flows in
  // different tabs cannot clobber each other's state.
  jar.set(`oauth_state_${config.id}`, state, {
    httpOnly: true,
    secure,
    sameSite: 'lax', // must survive the cross-site redirect back from the provider
    path: '/',
    maxAge: 600, // 10 minutes is ample for a consent screen
  });

  const authUrl = new URL(config.authorizeUrl);
  authUrl.searchParams.set('client_id', process.env[config.clientIdEnv]!);
  authUrl.searchParams.set('redirect_uri', redirectUri(config.id));
  authUrl.searchParams.set('scope', config.scopes.join(' '));
  authUrl.searchParams.set('state', state);

  for (const [k, v] of Object.entries(config.extraAuthParams || {})) {
    authUrl.searchParams.set(k, v);
  }

  if (config.authKind === 'oauth2-pkce') {
    const verifier = randomToken(48);
    jar.set(`oauth_verifier_${config.id}`, verifier, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
    authUrl.searchParams.set('code_challenge', pkceChallenge(verifier));
    authUrl.searchParams.set('code_challenge_method', 'S256');
  }

  return NextResponse.redirect(authUrl.toString());
}
