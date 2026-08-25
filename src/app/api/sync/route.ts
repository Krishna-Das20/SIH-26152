import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ingestForUser } from '@/lib/ingestion/userIngest';
import { addPosts } from '@/lib/store';

/**
 * Syncs every account the signed-in user has connected.
 *
 * This is the multi-tenant data path: it reads only data the user themselves
 * authorised, using their own tokens, and every stored post is tagged with
 * their user id.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const limit = Math.min(Number(body.limit) || 25, 100);

  try {
    const outcome = await ingestForUser(userId, limit);
    if (outcome.posts.length > 0) await addPosts(outcome.posts);

    return NextResponse.json({
      success: true,
      syncedCount: outcome.posts.length,
      connectedProviders: outcome.connectedProviders,
      // Per-provider outcome, so a failure is attributable rather than silent.
      results: outcome.results.map((r) => ({
        platform: r.platform,
        status: r.status,
        count: r.posts.length,
        note: r.note,
      })),
    });
  } catch (err: any) {
    console.error('User sync failed:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
