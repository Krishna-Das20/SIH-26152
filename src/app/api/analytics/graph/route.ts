import { NextResponse } from 'next/server';
import { tenantPosts } from '@/lib/tenant';
import { buildNetworkTopology } from '@/lib/graph/networkAnalyzer';

export async function GET(req: Request) {

  // Tenant-scoped: a signed-in user sees only their own data.
  const { posts } = await tenantPosts(req);

  const topology = buildNetworkTopology(posts);

  return NextResponse.json({
    topology,
    meta: {
      totalNodes: topology.nodes.length,
      totalLinks: topology.links.length,
      communitiesCount: topology.communities.length,
      topKOLsCount: topology.topKOLs.length
    }
  });
}
