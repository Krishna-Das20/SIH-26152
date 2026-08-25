import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getProvider } from '@/lib/oauth/providers';
import { revokeAndDisconnect } from '@/lib/oauth/tokenStore';

/**
 * Disconnects one provider for the signed-in user.
 *
 * Revokes at the provider where an endpoint exists, then deletes locally. The
 * local delete happens regardless of the remote result: if a provider is
 * unreachable we must still honour the user's request to stop holding their
 * token.
 */
export async function POST(req: Request, { params }: { params: { provider: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const config = getProvider(params.provider);
  if (!config) return NextResponse.json({ error: 'Unknown provider.' }, { status: 404 });

  const body = await req.json().catch(() => ({} as any));
  const result = await revokeAndDisconnect(userId, config.id, body.providerAccountId);

  return NextResponse.json({
    success: true,
    provider: config.id,
    revokedRemotely: result.revokedRemotely,
    deleted: result.deleted,
    note: result.revokedRemotely
      ? 'Token revoked at the provider and deleted locally.'
      : 'Deleted locally. Revoke access in the provider\u2019s own settings to be certain.',
  });
}
