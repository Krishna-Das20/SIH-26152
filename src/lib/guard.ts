import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Write-path guard for the ingestion routes.
 *
 * Reads are open — a judge or visitor can view the whole dashboard without an
 * account, which is the point of demo mode. WRITES are different: `/api/ingest`
 * and `/api/analyze/page` spend real, rate-limited third-party quota on our
 * credentials. YouTube allows 10,000 units/day per project and `search.list`
 * costs 100 of them, so roughly a hundred anonymous requests can exhaust a
 * day's quota — and a public URL is discoverable.
 *
 * Default is SECURE: a session is required. `PUBLIC_INGEST=true` opts out
 * explicitly, for local development and trusted single-machine demos where
 * signing in would just add friction.
 */

export interface GuardResult {
  allowed: boolean;
  response?: NextResponse;
  userId?: string;
}

function ingestIsPublic(): boolean {
  return process.env.PUBLIC_INGEST === 'true';
}

export async function guardIngest(): Promise<GuardResult> {
  if (ingestIsPublic()) return { allowed: true };

  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  if (!userId) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: 'Sign in to trigger ingestion.',
          reason:
            'Ingestion spends this deployment’s third-party API quota, so it is not ' +
            'open to anonymous callers. Viewing the dashboard needs no account.',
          // Named so an operator can fix a local setup without reading the source.
          hint: 'Set PUBLIC_INGEST=true for local development or a trusted demo machine.',
        },
        { status: 401 }
      ),
    };
  }

  return { allowed: true, userId };
}
