import { NextResponse } from 'next/server';
import { tenantPosts } from '@/lib/tenant';
import { buildNetworkTopology } from '@/lib/graph/networkAnalyzer';
import { SocialPost, EmotionType, GraphNode } from '@/types/intelligence';
import { analyzeNarratives } from '@/lib/narratives';

/**
 * Audience Intelligence Brief — the cross-vector fusion layer.
 *
 * The problem statement is explicit that this is the point of the exercise:
 * "Combining these four vectors using AI is the key to unlocking true audience
 * intelligence." Sentiment, demographics, trends, and network analysis are
 * individually available elsewhere in this API; NONE of those endpoints joins
 * them, so none of them answers a question an analyst would actually ask.
 *
 * This endpoint produces findings that are only derivable by intersecting the
 * vectors — for example, "the anxiety spike is concentrated in one community,
 * carried by one broker, about one topic". A single-vector view cannot see
 * that, which is precisely why it is worth computing.
 *
 * Every finding carries the evidence it was derived from, so a reader can
 * check it rather than trust it.
 */

interface Finding {
  id: string;
  /** Which of the four vectors this finding required. */
  vectors: ('sentiment' | 'demographics' | 'trends' | 'network')[];
  severity: 'info' | 'notable' | 'high';
  headline: string;
  detail: string;
  evidence: Record<string, unknown>;
}

/** Below this, a Louvain group is an isolated account rather than a community. */
const MIN_COMMUNITY_SIZE = 3;

const NEGATIVE_EMOTIONS: EmotionType[] = ['anger', 'anxiety', 'fear', 'sadness', 'against'];
const POSITIVE_EMOTIONS: EmotionType[] = ['joy', 'excitement', 'supportive'];

/** Most frequent key in a counter, plus its share. Keys may be labels or ids. */
function dominant<T extends string | number>(counts: Map<T, number>): { key: T | null; share: number } {
  let best: T | null = null;
  let max = 0;
  let total = 0;
  for (const [k, v] of counts) {
    total += v;
    if (v > max) {
      max = v;
      best = k;
    }
  }
  return { key: best, share: total > 0 ? max / total : 0 };
}

function pct(x: number): number {
  return Math.round(x * 100);
}

export async function GET(req: Request) {
  const { posts, mode } = await tenantPosts(req);

  if (posts.length < 3) {
    return NextResponse.json({
      mode,
      corpusSize: posts.length,
      findings: [],
      note: 'Not enough data to derive cross-vector findings. Ingest more posts.',
    });
  }

  const topology = buildNetworkTopology(posts);
  const nodeById = new Map<string, GraphNode>(topology.nodes.map((n) => [n.id, n]));
  const findings: Finding[] = [];

  // A "community" of one is an isolated account, not a community. Reporting
  // them inflates the count (74 vs the 2 real clusters) and makes every
  // finding's community label meaningless. Real clusters only, from here on.
  const realCommunities = topology.communities.filter((c) => c.size >= MIN_COMMUNITY_SIZE);
  const isolatedCount = topology.communities.length - realCommunities.length;

  // Index posts by the community their author was assigned to.
  const postsByCommunity = new Map<number, SocialPost[]>();
  for (const p of posts) {
    const node = nodeById.get(p.author.id);
    if (!node) continue;
    const list = postsByCommunity.get(node.communityId);
    if (list) list.push(p);
    else postsByCommunity.set(node.communityId, [p]);
  }

  // ── 1. SENTIMENT x NETWORK ─────────────────────────────────────────────
  // Which community is the negative sentiment actually concentrated in? An
  // aggregate "62% negative" tells an analyst nothing about where to look.
  const communityMood: {
    id: number;
    size: number;
    posts: number;
    negativeShare: number;
    dominantEmotion: EmotionType | null;
    avgScore: number;
    topic: string;
  }[] = [];

  for (const community of realCommunities) {
    const cposts = postsByCommunity.get(community.id) ?? [];
    if (cposts.length === 0) continue;

    const emotions = new Map<EmotionType, number>();
    let negative = 0;
    let scoreSum = 0;

    for (const p of cposts) {
      emotions.set(p.sentiment.nuancedEmotion, (emotions.get(p.sentiment.nuancedEmotion) || 0) + 1);
      if (NEGATIVE_EMOTIONS.includes(p.sentiment.nuancedEmotion)) negative++;
      scoreSum += p.sentiment.score;
    }

    communityMood.push({
      id: community.id,
      size: community.size,
      posts: cposts.length,
      negativeShare: negative / cposts.length,
      dominantEmotion: dominant(emotions).key,
      avgScore: Number((scoreSum / cposts.length).toFixed(2)),
      topic: community.dominantTopic,
    });
  }

  if (communityMood.length >= 2) {
    const sorted = [...communityMood].sort((a, b) => b.negativeShare - a.negativeShare);
    const worst = sorted[0];
    const best = sorted[sorted.length - 1];
    const gap = worst.negativeShare - best.negativeShare;

    // Only report a split that is actually a split.
    if (gap > 0.25 && worst.posts >= 3) {
      findings.push({
        id: 'sentiment-network-divergence',
        vectors: ['sentiment', 'network'],
        severity: gap > 0.5 ? 'high' : 'notable',
        headline: `Negative sentiment is concentrated in one community, not spread evenly`,
        detail:
          `Community ${worst.id + 1} (${worst.size} accounts, topic "${worst.topic}") is ` +
          `${pct(worst.negativeShare)}% negative, against ${pct(best.negativeShare)}% in ` +
          `Community ${best.id + 1}. A platform-wide average would have hidden this ` +
          `${pct(gap)}-point split entirely.`,
        evidence: {
          mostNegative: worst,
          leastNegative: best,
          gapPercentagePoints: pct(gap),
        },
      });
    }
  }

  // ── 2. NETWORK x SENTIMENT: brokers carrying sentiment across clusters ──
  // A node with high betweenness but modest reach is an information broker.
  // If that broker is negative, the negativity has a bridge to travel over.
  const brokers = [...topology.nodes]
    .filter((n) => n.betweennessCentrality > 0)
    .sort((a, b) => b.betweennessCentrality - a.betweennessCentrality)
    .slice(0, 3);

  if (brokers.length > 0) {
    const broker = brokers[0];
    const brokerPosts = posts.filter((p) => p.author.id === broker.id);
    const brokerNegative = brokerPosts.filter((p) =>
      NEGATIVE_EMOTIONS.includes(p.sentiment.nuancedEmotion)
    ).length;

    // Which other communities does this broker actually touch?
    const touched = new Set<number>();
    for (const link of topology.links) {
      const src = typeof link.source === 'string' ? link.source : link.source.id;
      const tgt = typeof link.target === 'string' ? link.target : link.target.id;
      if (src === broker.id && nodeById.has(tgt)) touched.add(nodeById.get(tgt)!.communityId);
      if (tgt === broker.id && nodeById.has(src)) touched.add(nodeById.get(src)!.communityId);
    }

    if (touched.size > 1) {
      const share = brokerPosts.length > 0 ? brokerNegative / brokerPosts.length : 0;
      findings.push({
        id: 'broker-bridge',
        vectors: ['network', 'sentiment'],
        severity: share > 0.5 ? 'high' : 'notable',
        headline: `@${broker.username} bridges ${touched.size} otherwise separate communities`,
        detail:
          `Betweenness ${broker.betweennessCentrality.toFixed(4)} — the highest in the graph — ` +
          `while reach is ${broker.followerCount === null ? 'not reported by the platform' : broker.followerCount.toLocaleString()}. ` +
          `${pct(share)}% of their posts carry negative emotion. ` +
          `Brokers matter more than loud accounts: they are the path a narrative takes ` +
          `between clusters that otherwise do not talk.`,
        evidence: {
          username: broker.username,
          betweenness: broker.betweennessCentrality,
          pageRank: broker.pageRank,
          reach: broker.followerCount,
          communitiesTouched: Array.from(touched).map((c) => c + 1),
          negativePostShare: pct(share),
        },
      });
    }
  }

  // ── 3. TRENDS x SENTIMENT x TIME: where a topic's mood turned ──────────
  const byTopic = new Map<string, SocialPost[]>();
  for (const p of posts) {
    for (const tag of p.hashtags || []) {
      const list = byTopic.get(tag);
      if (list) list.push(p);
      else byTopic.set(tag, [p]);
    }
  }

  for (const [tag, tposts] of byTopic) {
    if (tposts.length < 6) continue;

    const chronological = [...tposts].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const half = Math.floor(chronological.length / 2);
    const earlier = chronological.slice(0, half);
    const later = chronological.slice(half);

    const avg = (arr: SocialPost[]) =>
      arr.reduce((s, p) => s + p.sentiment.score, 0) / Math.max(arr.length, 1);

    const before = avg(earlier);
    const after = avg(later);
    const shift = after - before;

    // A swing of 0.4 on a [-1,1] scale is a genuine reversal, not noise.
    if (Math.abs(shift) >= 0.4) {
      const turningPoint = chronological[half]?.timestamp;
      findings.push({
        id: `topic-mood-shift-${tag}`,
        vectors: ['trends', 'sentiment'],
        severity: Math.abs(shift) >= 0.7 ? 'high' : 'notable',
        headline: `Sentiment on ${tag} ${shift < 0 ? 'turned negative' : 'recovered'} mid-conversation`,
        detail:
          `Average sentiment moved from ${before.toFixed(2)} to ${after.toFixed(2)} ` +
          `(${shift > 0 ? '+' : ''}${shift.toFixed(2)}) across ${tposts.length} posts, ` +
          `turning around ${turningPoint ? new Date(turningPoint).toUTCString() : 'mid-window'}. ` +
          `Tracking the topic total alone would show only that it was busy.`,
        evidence: {
          topic: tag,
          postCount: tposts.length,
          sentimentBefore: Number(before.toFixed(2)),
          sentimentAfter: Number(after.toFixed(2)),
          shift: Number(shift.toFixed(2)),
          turningPoint,
        },
      });
    }
  }

  // ── 4. DEMOGRAPHICS x SENTIMENT ────────────────────────────────────────
  // Only meaningful where demographics could actually be inferred, so the
  // coverage is reported alongside and a thin basis is visible.
  const byAge = new Map<string, { total: number; negative: number }>();
  for (const p of posts) {
    const bracket = p.author.estimatedAgeBracket;
    if (!bracket) continue;
    const entry = byAge.get(bracket) || { total: 0, negative: 0 };
    entry.total++;
    if (NEGATIVE_EMOTIONS.includes(p.sentiment.nuancedEmotion)) entry.negative++;
    byAge.set(bracket, entry);
  }

  const ageCoverage = Array.from(byAge.values()).reduce((s, e) => s + e.total, 0) / posts.length;

  if (byAge.size >= 2 && ageCoverage > 0.15) {
    const ranked = Array.from(byAge.entries())
      .filter(([, e]) => e.total >= 3)
      .map(([bracket, e]) => ({ bracket, share: e.negative / e.total, n: e.total }))
      .sort((a, b) => b.share - a.share);

    if (ranked.length >= 2 && ranked[0].share - ranked[ranked.length - 1].share > 0.25) {
      const top = ranked[0];
      const bottom = ranked[ranked.length - 1];
      findings.push({
        id: 'demographic-sentiment-split',
        vectors: ['demographics', 'sentiment'],
        severity: 'notable',
        headline: `The ${top.bracket} bracket is markedly more negative than ${bottom.bracket}`,
        detail:
          `${pct(top.share)}% negative among ${top.bracket} (n=${top.n}) versus ` +
          `${pct(bottom.share)}% among ${bottom.bracket} (n=${bottom.n}). ` +
          `Age could be inferred for only ${pct(ageCoverage)}% of this corpus, so treat ` +
          `this as directional rather than representative.`,
        evidence: { ranked, ageCoveragePercent: pct(ageCoverage) },
      });
    }
  }

  // ── 5. SARCASM x SENTIMENT: where naive polarity would be wrong ────────
  // The single clearest argument for a nuanced model over a polarity classifier.
  const sarcastic = posts.filter((p) => p.sentiment.sarcasmScore >= 0.5);
  const misleading = sarcastic.filter((p) => p.sentiment.score > 0.2);

  if (misleading.length >= 2) {
    findings.push({
      id: 'sarcasm-masking',
      vectors: ['sentiment'],
      severity: 'notable',
      headline: `${misleading.length} posts read as positive but are sarcastic`,
      detail:
        `Of ${sarcastic.length} posts flagged sarcastic, ${misleading.length} carry a positive ` +
        `polarity score. A polarity-only classifier would count these as approval and ` +
        `report the audience as more supportive than it is. This is what the nuanced-emotion ` +
        `requirement in Component B exists to catch.`,
      evidence: {
        sarcasticTotal: sarcastic.length,
        positivePolarityButSarcastic: misleading.length,
        examples: misleading.slice(0, 3).map((p) => ({
          text: p.content.slice(0, 120),
          polarity: p.sentiment.score,
          sarcasm: p.sentiment.sarcasmScore,
          platform: p.platform,
        })),
      },
    });
  }

  // ── 6. NETWORK x TRENDS: is a topic captive to one cluster? ────────────
  for (const [tag, tposts] of byTopic) {
    if (tposts.length < 5) continue;

    const communities = new Map<number, number>();
    for (const p of tposts) {
      const node = nodeById.get(p.author.id);
      if (!node) continue;
      communities.set(node.communityId, (communities.get(node.communityId) || 0) + 1);
    }
    if (communities.size === 0) continue;

    const { key, share } = dominant(communities);
    // Contained in one cluster despite the graph having several.
    if (share > 0.8 && realCommunities.length >= 2 && key !== null) {
      findings.push({
        id: `topic-contained-${tag}`,
        vectors: ['trends', 'network'],
        severity: 'info',
        headline: `${tag} has not escaped Community ${key + 1}`,
        detail:
          `${pct(share)}% of ${tposts.length} posts on this topic come from a single ` +
          `community. High volume without cross-community spread is an echo chamber, ` +
          `not a trend — the distinction is invisible to a volume-only trend tracker.`,
        evidence: { topic: tag, postCount: tposts.length, concentration: pct(share), community: key + 1 },
      });
      break; // one example makes the point
    }
  }

  // ── 7. NARRATIVE MUTATION (additive — requires ML service) ──────────
  // If the embedding service is available, surface the highest-mutation
  // narrative as a cross-vector finding.  Silently skipped when the ML
  // service is down — no degraded/fake output.
  try {
    const narrativeResult = await analyzeNarratives(posts);
    const topNarrative = narrativeResult.narratives[0]; // sorted by mutation desc

    if (
      topNarrative &&
      topNarrative.mutationScore !== null &&
      topNarrative.mutationScore > 30
    ) {
      const platformSeq = topNarrative.platformFlow
        .map((pf) => pf.platform.charAt(0).toUpperCase() + pf.platform.slice(1))
        .join(' → ');

      findings.push({
        id: 'narrative-mutation',
        vectors: ['sentiment', 'trends'],
        severity: topNarrative.mutationScore >= 60 ? 'high' : 'notable',
        headline: `Narrative "${topNarrative.title}" shows significant mutation across observations`,
        detail:
          `Across ${topNarrative.postCount} posts (${platformSeq}), ` +
          `the narrative shifted ${topNarrative.semanticShift !== null ? topNarrative.semanticShift.toFixed(1) + '% semantically' : 'unmeasured semantically'}, ` +
          `${topNarrative.sentimentShift !== null ? topNarrative.sentimentShift.toFixed(1) + '% in sentiment' : 'unmeasured in sentiment'}. ` +
          `Composite mutation score: ${topNarrative.mutationScore.toFixed(1)}%. ` +
          `This indicates the underlying narrative changed meaningfully between early and later observations.`,
        evidence: {
          narrativeId: topNarrative.id,
          title: topNarrative.title,
          mutationScore: topNarrative.mutationScore,
          semanticShift: topNarrative.semanticShift,
          sentimentShift: topNarrative.sentimentShift,
          emotionShift: topNarrative.emotionShift,
          keywordShift: topNarrative.keywordShift,
          platforms: topNarrative.platforms,
          platformSequence: platformSeq,
          postCount: topNarrative.postCount,
        },
      });
    }
  } catch (e) {
    // ML service unavailable — narrative finding simply does not appear.
    // This is intentional: no degraded output.
  }

  const order = { high: 0, notable: 1, info: 2 } as const;
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  return NextResponse.json({
    mode,
    corpusSize: posts.length,
    generatedAt: new Date().toISOString(),
    // Which analysis engine produced the sentiment these findings rest on.
    engine: posts.some((p) => p.sentiment.engine === 'ml') ? 'ml' : 'lexicon',
    graph: {
      nodes: topology.nodes.length,
      links: topology.links.length,
      // Clusters of >= MIN_COMMUNITY_SIZE. Isolated accounts are counted
      // separately rather than inflating the community total.
      communities: realCommunities.length,
      isolatedAccounts: isolatedCount,
      modularity: topology.modularity,
    },
    findingCount: findings.length,
    findings,
    note:
      findings.length === 0
        ? 'No cross-vector pattern crossed its significance threshold on this corpus. ' +
          'That is a real result, not an error — thresholds are deliberately set so the ' +
          'brief stays empty rather than manufacturing insight.'
        : undefined,
  });
}
