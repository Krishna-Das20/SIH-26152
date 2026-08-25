import { NextResponse } from 'next/server';
import { tenantPosts } from '@/lib/tenant';

/**
 * Returns the actual ingested posts, newest first.
 *
 * The live feed previously rendered placeholder objects synthesised from graph
 * nodes -- template text ("Live OSINT node profile for @user"), engagement
 * counts derived as `followerCount * 0.05`, and a hardcoded 0.92 confidence.
 * None of it came from the corpus. This endpoint serves the real posts so the
 * feed shows what was actually collected.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get('limit') || 100), 500);

  // Tenant-scoped: a signed-in user sees only their own posts.
  const { posts, mode } = await tenantPosts(req);

  const sorted = [...posts].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return NextResponse.json({
    // Which corpus this is: 'tenant' (the user's own), 'demo' (synthetic), or
    // 'shared' (single-tenant deployment).
    mode,
    total: sorted.length,
    posts: sorted.slice(0, limit),
    // How many of these carry transformer output vs the lexicon fallback.
    engineBreakdown: {
      ml: sorted.filter((p) => p.sentiment.engine === 'ml').length,
      lexicon: sorted.filter((p) => p.sentiment.engine !== 'ml').length,
    },
  });
}
