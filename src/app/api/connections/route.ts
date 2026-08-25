import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listAccounts } from '@/lib/oauth/tokenStore';
import { PROVIDERS, PROVIDER_IDS, isProviderConfigured } from '@/lib/oauth/providers';
import { isEncryptionConfigured } from '@/lib/crypto';

/**
 * Lists the signed-in user's connected accounts, alongside which providers
 * this deployment can offer at all.
 *
 * Two different notions of "available" are reported separately, because they
 * fail for different reasons and have different fixes:
 *   - `deploymentReady`  : WE have registered app credentials for it.
 *   - `connected`        : THIS user has authorised their account.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const accounts = await listAccounts(userId);
  const byProvider = new Map(accounts.map((a) => [a.provider, a]));

  const providers = PROVIDER_IDS.map((id) => {
    const config = PROVIDERS[id];
    const account = byProvider.get(id);
    return {
      provider: id,
      displayName: config.displayName,
      authKind: config.authKind,
      scopes: config.scopes,
      deploymentReady: isProviderConfigured(config),
      connected: Boolean(account),
      account: account ?? null,
      needsReauth: account?.needsReauth ?? false,
      userPrerequisite: config.userPrerequisite,
      cost: config.cost,
      launchGate: config.launchGate,
      docsUrl: config.docsUrl,
    };
  });

  return NextResponse.json({
    // Surfaced so a misconfigured deployment is diagnosable rather than just broken:
    // without this key, connecting is refused outright.
    encryptionConfigured: isEncryptionConfigured(),
    connectedCount: accounts.length,
    providers,
  });
}
