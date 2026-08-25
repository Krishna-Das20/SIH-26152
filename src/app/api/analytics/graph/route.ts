import { NextResponse } from 'next/server';
import { getAllPosts } from '@/lib/store';
import { buildNetworkTopology } from '@/lib/graph/networkAnalyzer';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cutoffTime = searchParams.get('cutoffTime');
  const platform = searchParams.get('platform');

  let posts = await getAllPosts();

  if (cutoffTime) {
    const cutoffDate = new Date(cutoffTime).getTime();
    posts = posts.filter(p => new Date(p.timestamp).getTime() <= cutoffDate);
  }
  if (platform && platform !== 'all') {
    posts = posts.filter(p => p.platform === platform);
  }

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
