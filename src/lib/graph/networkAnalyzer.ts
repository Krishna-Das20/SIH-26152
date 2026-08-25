import { GraphNode, GraphLink, NetworkTopology, SocialPost, StanceType } from '@/types/intelligence';
import { detectCommunities, modularity, LouvainEdge } from '@/lib/graph/louvain';
import { betweennessCentrality } from '@/lib/graph/betweenness';

/**
 * Link Analysis & Network Topology Engine (Component E).
 *
 * Every edge in the returned graph corresponds to an observed interaction --
 * a reply, a mention, or a quote that exists in the source data. Nothing is
 * synthesised. An earlier revision invented edges to randomly chosen nodes to
 * "simulate spread"; those fabricated edges then fed PageRank and centrality,
 * so the influence ranking was partly noise. If the ingested posts contain no
 * interactions, this now correctly returns an edgeless graph.
 */

const COMMUNITY_PALETTE = ['#00f0ff', '#10b981', '#f59e0b', '#f43f5e', '#a855f7', '#3b82f6', '#ec4899', '#84cc16'];

/** Words too generic to describe what a community is talking about. */
const TOPIC_STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'were', 'what', 'your', 'about', 'they',
  'will', 'been', 'more', 'when', 'which', 'their', 'there', 'would', 'could',
  'should', 'than', 'them', 'then', 'just', 'like', 'over', 'into', 'only',
]);

export function buildNetworkTopology(posts: SocialPost[]): NetworkTopology {
  const nodeMap = new Map<string, GraphNode>();
  const links: GraphLink[] = [];

  // ── 1. Nodes, one per distinct author ──────────────────────────────────
  for (const post of posts) {
    const existing = nodeMap.get(post.author.id);

    if (!existing) {
      nodeMap.set(post.author.id, {
        id: post.author.id,
        label: post.author.displayName || post.author.username,
        username: post.author.username,
        platform: post.platform,
        followerCount: post.author.followerCount,
        centralityScore: 0,
        pageRank: 0,
        betweennessCentrality: 0,
        communityId: -1,
        dominantSentiment: post.sentiment.label,
        dominantEmotion: post.sentiment.nuancedEmotion,
        isKOL: false,
        isBotSuspicious: false,
        postCount: 1,
        inferredLocation: post.author.inferredLocation,
        ageBracket: post.author.estimatedAgeBracket,
      });
    } else {
      existing.postCount += 1;
    }
  }

  const nodes = Array.from(nodeMap.values());
  const usernameIndex = new Map<string, string>();
  for (const n of nodes) usernameIndex.set(n.username.toLowerCase(), n.id);

  // ── 2. Edges from observed interactions only ───────────────────────────
  for (const post of posts) {
    if (
      post.inReplyToAuthorId &&
      nodeMap.has(post.inReplyToAuthorId) &&
      post.inReplyToAuthorId !== post.author.id
    ) {
      links.push({
        source: post.author.id,
        target: post.inReplyToAuthorId,
        type: 'reply',
        weight: 2,
        sentiment: post.sentiment.label,
        timestamp: post.timestamp,
      });
    }

    for (const mentioned of post.mentionedUsernames || []) {
      const targetId = usernameIndex.get(mentioned.toLowerCase());
      if (targetId && targetId !== post.author.id) {
        links.push({
          source: post.author.id,
          target: targetId,
          type: 'mention',
          weight: 1.5,
          sentiment: post.sentiment.label,
          timestamp: post.timestamp,
        });
      }
    }
  }

  // ── 3. Degree bookkeeping ──────────────────────────────────────────────
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  for (const n of nodes) {
    inDegree.set(n.id, 0);
    outDegree.set(n.id, 0);
  }

  const edgeList: { source: string; target: string; weight: number }[] = [];
  for (const link of links) {
    const src = typeof link.source === 'string' ? link.source : link.source.id;
    const tgt = typeof link.target === 'string' ? link.target : link.target.id;
    outDegree.set(src, (outDegree.get(src) || 0) + 1);
    inDegree.set(tgt, (inDegree.get(tgt) || 0) + 1);
    edgeList.push({ source: src, target: tgt, weight: link.weight });
  }

  // Bot heuristic: high posting volume with no inbound engagement at all.
  // Applied after degrees are known rather than mid-ingestion, where postCount
  // was still being accumulated and the test fired on partial counts.
  for (const n of nodes) {
    n.isBotSuspicious = n.postCount > 8 && (inDegree.get(n.id) || 0) === 0;
  }

  // ── 4. PageRank (damped power iteration, with dangling-node handling) ──
  const N = nodes.length;
  if (N > 0) {
    const d = 0.85;
    const incoming = new Map<string, { src: string }[]>();
    for (const n of nodes) incoming.set(n.id, []);
    for (const e of edgeList) incoming.get(e.target)!.push({ src: e.source });

    let rank = new Map<string, number>();
    for (const n of nodes) rank.set(n.id, 1 / N);

    for (let iter = 0; iter < 30; iter++) {
      // Rank held by nodes with no outbound edges is redistributed uniformly,
      // otherwise it leaks out of the system and every score decays.
      let danglingMass = 0;
      for (const n of nodes) {
        if ((outDegree.get(n.id) || 0) === 0) danglingMass += rank.get(n.id)!;
      }

      const next = new Map<string, number>();
      let delta = 0;

      for (const n of nodes) {
        let sum = 0;
        for (const { src } of incoming.get(n.id)!) {
          sum += rank.get(src)! / (outDegree.get(src) || 1);
        }
        const value = (1 - d) / N + d * (sum + danglingMass / N);
        next.set(n.id, value);
        delta += Math.abs(value - rank.get(n.id)!);
      }

      rank = next;
      if (delta < 1e-9) break; // converged
    }

    for (const n of nodes) n.pageRank = Number((rank.get(n.id) || 0).toFixed(6));
  }

  // ── 5. Betweenness centrality (Brandes) ────────────────────────────────
  const betweenness = betweennessCentrality(
    nodes.map((n) => n.id),
    edgeList.map((e) => ({ source: e.source, target: e.target }))
  );
  for (const n of nodes) {
    n.betweennessCentrality = betweenness.get(n.id) || 0;
  }

  // ── 6. Louvain community detection ─────────────────────────────────────
  const louvainEdges: LouvainEdge[] = edgeList.map((e) => ({
    source: e.source,
    target: e.target,
    weight: e.weight,
  }));
  const nodeIds = nodes.map((n) => n.id);
  const assignment = detectCommunities(nodeIds, louvainEdges);
  for (const n of nodes) n.communityId = assignment.get(n.id) ?? 0;

  const graphModularity = modularity(nodeIds, louvainEdges, assignment);

  // ── 7. Influence score ─────────────────────────────────────────────────
  // Blends structural position (PageRank, betweenness, inbound degree) with
  // reach where the platform actually reports it. Reach is simply omitted for
  // platforms that expose no follower count, rather than invented.
  const maxPageRank = Math.max(...nodes.map((n) => n.pageRank), 1e-9);
  const maxBetweenness = Math.max(...nodes.map((n) => n.betweennessCentrality), 1e-9);
  const maxInDegree = Math.max(...nodes.map((n) => inDegree.get(n.id) || 0), 1);
  const maxFollowers = Math.max(...nodes.map((n) => n.followerCount ?? 0), 1);

  for (const n of nodes) {
    const prPart = (n.pageRank / maxPageRank) * 40;
    const btPart = (n.betweennessCentrality / maxBetweenness) * 25;
    const degPart = ((inDegree.get(n.id) || 0) / maxInDegree) * 20;

    // Redistribute the reach weighting into structure when reach is unknown,
    // so nodes on follower-less platforms are not penalised to zero.
    const hasReach = n.followerCount !== null && n.followerCount !== undefined;
    const reachPart = hasReach ? (n.followerCount! / maxFollowers) * 15 : 0;
    const scale = hasReach ? 1 : 100 / 85;

    n.centralityScore = Math.min(Math.round((prPart + btPart + degPart + reachPart) * scale), 100);
  }

  // ── 8. Key Opinion Leaders ─────────────────────────────────────────────
  const ranked = [...nodes].sort((a, b) => b.centralityScore - a.centralityScore);
  const kolCount = Math.min(8, ranked.length);
  for (let i = 0; i < ranked.length; i++) ranked[i].isKOL = i < kolCount;

  // Rank by brokerage specifically, so `betweennessRank` means what it says.
  const byBetweenness = [...nodes].sort((a, b) => b.betweennessCentrality - a.betweennessCentrality);
  const betweennessRanks = new Map<string, number>();
  byBetweenness.forEach((n, i) => betweennessRanks.set(n.id, i + 1));

  const topKOLs = ranked.slice(0, kolCount).map((node) => {
    let dominantStance: StanceType = 'neutral';
    if (node.dominantEmotion === 'anger' || node.dominantEmotion === 'against') {
      dominantStance = 'opposing';
    } else if (node.dominantEmotion === 'supportive' || node.dominantEmotion === 'joy') {
      dominantStance = 'supportive';
    }

    return {
      id: node.id,
      username: node.username,
      displayName: node.label,
      platform: node.platform,
      influenceScore: node.centralityScore,
      reach: node.followerCount,
      betweennessRank: betweennessRanks.get(node.id) || 0,
      dominantStance,
    };
  });

  // ── 9. Community descriptions derived from actual members ──────────────
  const postsByAuthor = new Map<string, SocialPost[]>();
  for (const p of posts) {
    const bucket = postsByAuthor.get(p.author.id);
    if (bucket) bucket.push(p);
    else postsByAuthor.set(p.author.id, [p]);
  }

  const communities = Array.from(new Set(assignment.values()))
    .sort((a, b) => a - b)
    .map((id) => {
      const members = nodes.filter((n) => n.communityId === id);
      const memberPosts = members.flatMap((m) => postsByAuthor.get(m.id) || []);

      // Dominant topic: most frequent hashtag, else most frequent keyword.
      const tagCounts = new Map<string, number>();
      for (const p of memberPosts) {
        for (const tag of p.hashtags || []) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }
      if (tagCounts.size === 0) {
        for (const p of memberPosts) {
          for (const kw of p.sentiment.keywords || []) {
            if (kw.length > 3 && !TOPIC_STOPWORDS.has(kw)) {
              tagCounts.set(kw, (tagCounts.get(kw) || 0) + 1);
            }
          }
        }
      }
      const dominantTopic =
        Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unclassified';

      // Dominant sentiment: majority label across the community's posts.
      const sentimentCounts = new Map<string, number>();
      for (const p of memberPosts) {
        sentimentCounts.set(p.sentiment.label, (sentimentCounts.get(p.sentiment.label) || 0) + 1);
      }
      const dominantSentiment =
        Array.from(sentimentCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

      return {
        id,
        // Named after what the cluster actually discusses. The previous build
        // hardcoded evocative names ("Critical Stance & Skeptics Ring") that
        // had no relationship to the members assigned to them.
        name: `Cluster ${id + 1} — ${dominantTopic}`,
        size: members.length,
        dominantTopic,
        dominantSentiment,
        color: COMMUNITY_PALETTE[id % COMMUNITY_PALETTE.length],
      };
    });

  // ── 10. Diffusion cascade over real reply edges ────────────────────────
  const sortedPosts = [...posts]
    .filter((p) => !Number.isNaN(new Date(p.timestamp).getTime()))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const diffusionSteps: NetworkTopology['diffusionSteps'] = [];
  const activeNodes = new Set<string>();
  const stepCount = 5;
  const stepSize = Math.max(1, Math.ceil(sortedPosts.length / stepCount));

  for (let s = 0; s < stepCount; s++) {
    const chunk = sortedPosts.slice(s * stepSize, (s + 1) * stepSize);
    if (chunk.length === 0) break;

    const newlyInfectedLinks: { source: string; target: string }[] = [];
    for (const p of chunk) {
      activeNodes.add(p.author.id);
      if (p.inReplyToAuthorId && nodeMap.has(p.inReplyToAuthorId)) {
        activeNodes.add(p.inReplyToAuthorId);
        newlyInfectedLinks.push({ source: p.author.id, target: p.inReplyToAuthorId });
      }
    }

    diffusionSteps.push({
      step: s + 1,
      timestamp: chunk[chunk.length - 1].timestamp,
      activeNodeIds: Array.from(activeNodes),
      newlyInfectedLinks,
    });
  }

  return {
    nodes,
    links,
    communities,
    topKOLs,
    diffusionSteps,
    modularity: graphModularity,
  };
}
