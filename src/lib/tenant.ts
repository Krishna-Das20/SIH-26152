import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SocialPost } from '@/types/intelligence';
import { getAllPosts, getPostsForUser } from '@/lib/store';

/**
 * Tenant resolution for every analytics read.
 *
 * This is the single security boundary of the multi-tenant product. Analytics
 * routes must obtain their corpus from here and nowhere else — a route that
 * calls `getAllPosts()` directly would serve one customer's data to another.
 *
 * Three modes, deliberately explicit:
 *
 *   - **tenant**  — a signed-in user. Returns ONLY posts tagged with their
 *                   `ownerUserId`.
 *   - **demo**    — no session. Returns the synthetic baseline dataset, which
 *                   contains no real person's data.
 *   - **shared**  — single-tenant deployments (the original NTRO analyst tool),
 *                   enabled explicitly with SINGLE_TENANT_MODE=true.
 */

export type TenantMode = 'tenant' | 'demo' | 'shared';

export interface TenantContext {
  mode: TenantMode;
  userId: string | null;
  posts: SocialPost[];
}

/** Single-tenant mode must be opted into; multi-tenant is the safe default. */
function isSingleTenant(): boolean {
  return process.env.SINGLE_TENANT_MODE === 'true';
}

export async function resolveTenant(): Promise<TenantContext> {
  if (isSingleTenant()) {
    return { mode: 'shared', userId: null, posts: await getAllPosts() };
  }

  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id ?? null;

  if (!userId) {
    // Unauthenticated visitors see the synthetic dataset, never real customer
    // data. The demo set is generated locally and contains no real accounts.
    const all = await getAllPosts();
    return { mode: 'demo', userId: null, posts: all.filter((p) => !p.ownerUserId) };
  }

  return { mode: 'tenant', userId, posts: await getPostsForUser(userId) };
}

/**
 * Applies the query filters every analytics route shares.
 * Kept here so the timeline-cutoff and platform semantics cannot drift apart
 * between routes.
 */
export function applyFilters(
  posts: SocialPost[],
  searchParams: URLSearchParams
): SocialPost[] {
  let filtered = posts.filter((p) => !Number.isNaN(new Date(p.timestamp).getTime()));

  const cutoffTime = searchParams.get('cutoffTime');
  if (cutoffTime) {
    const cutoff = new Date(cutoffTime).getTime();
    if (!Number.isNaN(cutoff)) {
      filtered = filtered.filter((p) => new Date(p.timestamp).getTime() <= cutoff);
    }
  }

  const platform = searchParams.get('platform');
  if (platform && platform !== 'all') {
    filtered = filtered.filter((p) => p.platform === platform);
  }

  return filtered;
}

/** Convenience: resolve the tenant and apply the shared filters in one step. */
export async function tenantPosts(req: Request): Promise<TenantContext> {
  const { searchParams } = new URL(req.url);
  const ctx = await resolveTenant();
  return { ...ctx, posts: applyFilters(ctx.posts, searchParams) };
}
