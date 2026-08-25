import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { deleteAllForUser } from '@/lib/oauth/tokenStore';
import { getDatabase } from '@/lib/mongodb';

/**
 * Data deletion endpoint.
 *
 * Two callers, two contracts:
 *
 *  1. **Meta's Data Deletion Callback** (POST with `signed_request`).
 *     Meta REQUIRES a working callback before it will approve an app for
 *     Advanced Access. When a user removes the app from their Facebook
 *     settings, Meta calls this and expects a JSON body containing a
 *     confirmation URL and code. This is a launch blocker, not a nicety.
 *
 *  2. **The user's own request** (POST with a session, no signed_request),
 *     backing the erasure right under GDPR Art. 17 and the DPDP Act 2023.
 *
 * Deletion is real: connected-account records and the user's ingested posts
 * are removed, not merely flagged.
 */

interface DeletionRecord {
  confirmationCode: string;
  userId: string;
  source: 'meta-callback' | 'user-request';
  requestedAt: string;
  completedAt?: string;
  deletedCounts?: Record<string, number>;
}

/**
 * Parses Meta's `signed_request`: `<base64url signature>.<base64url payload>`,
 * signed with HMAC-SHA256 keyed by the app secret.
 */
function parseSignedRequest(signedRequest: string, appSecret: string): any | null {
  const [encodedSig, payload] = signedRequest.split('.', 2);
  if (!encodedSig || !payload) return null;

  const expected = crypto.createHmac('sha256', appSecret).update(payload).digest();
  const actual = Buffer.from(encodedSig, 'base64url');

  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

async function performDeletion(
  userId: string,
  source: DeletionRecord['source']
): Promise<{ confirmationCode: string; counts: Record<string, number> }> {
  const confirmationCode = crypto.randomBytes(12).toString('hex');
  const counts: Record<string, number> = {};

  counts.connectedAccounts = await deleteAllForUser(userId);

  const db = await getDatabase();
  if (db) {
    // Ingested content belonging to this user.
    const posts = await db.collection('posts').deleteMany({ ownerUserId: userId });
    counts.posts = posts.deletedCount ?? 0;

    // Audit trail of the deletion itself. Retained deliberately: it holds no
    // personal data beyond the user id, and it is the evidence that the
    // request was honoured.
    await db.collection('deletion_requests').insertOne({
      confirmationCode,
      userId,
      source,
      requestedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      deletedCounts: counts,
    } satisfies DeletionRecord);
  }

  return { confirmationCode, counts };
}

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') || '';

  // ── Meta's Data Deletion Callback ────────────────────────────────────
  let signedRequest: string | null = null;
  let body: any = {};

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData();
    signedRequest = (form.get('signed_request') as string) || null;
  } else {
    body = await req.json().catch(() => ({}));
    signedRequest = body.signed_request || null;
  }

  if (signedRequest) {
    const appSecret = process.env.FACEBOOK_APP_SECRET || process.env.INSTAGRAM_APP_SECRET;
    if (!appSecret) {
      return NextResponse.json({ error: 'App secret not configured.' }, { status: 500 });
    }

    const parsed = parseSignedRequest(signedRequest, appSecret);
    if (!parsed?.user_id) {
      return NextResponse.json({ error: 'Invalid signed_request.' }, { status: 400 });
    }

    // Meta identifies the person by their app-scoped id, which is what we
    // stored as providerAccountId.
    const db = await getDatabase();
    let userId = `meta:${parsed.user_id}`;
    if (db) {
      const account = await db
        .collection('connected_accounts')
        .findOne({ providerAccountId: String(parsed.user_id) });
      if (account?.userId) userId = account.userId;
    }

    const { confirmationCode } = await performDeletion(userId, 'meta-callback');
    const base = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');

    // Exactly the shape Meta expects.
    return NextResponse.json({
      url: `${base}/privacy/deletion-status?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  }

  // ── The user's own erasure request ───────────────────────────────────
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const { confirmationCode, counts } = await performDeletion(userId, 'user-request');

  return NextResponse.json({
    success: true,
    confirmationCode,
    deleted: counts,
    note:
      'Connected accounts and ingested content have been deleted. Access previously ' +
      'granted to this application should also be revoked in each provider’s own settings.',
  });
}

/** Lets a user check a deletion by its confirmation code. */
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'Provide ?code=' }, { status: 400 });

  const db = await getDatabase();
  if (!db) return NextResponse.json({ error: 'Database unavailable.' }, { status: 503 });

  const record = await db.collection('deletion_requests').findOne({ confirmationCode: code });
  if (!record) return NextResponse.json({ status: 'not_found' }, { status: 404 });

  return NextResponse.json({
    status: record.completedAt ? 'completed' : 'pending',
    requestedAt: record.requestedAt,
    completedAt: record.completedAt,
  });
}
