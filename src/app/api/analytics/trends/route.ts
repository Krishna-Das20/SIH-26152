import { NextResponse } from 'next/server';
import { getAllPosts } from '@/lib/store';
import { TrendTopic, EmotionType, PlatformType, SocialPost } from '@/types/intelligence';

/**
 * Real-Time Trend & Topic Detection (Component D).
 *
 * Spike detection is a genuine rolling z-score over per-bucket keyword counts:
 * a keyword is flagged when its most recent bucket sits more than
 * `Z_THRESHOLD` standard deviations above its own historical mean. Growth rate
 * is measured between the trailing and leading halves of the window.
 *
 * The previous implementation reported `Math.round(150 + Math.random() * 200)`
 * as the growth rate for anything it flagged, so the headline percentage on
 * every trend card was a random number.
 */

/**
 * Target number of buckets. The bucket WIDTH is derived from the observed time
 * span rather than fixed, because a fixed hourly bucket over a multi-month
 * corpus produces thousands of empty buckets, which drives every standard
 * deviation to ~0 and makes the z-scores meaningless.
 */
const TARGET_BUCKETS = 36;
const MIN_BUCKET_MS = 5 * 60 * 1000;      // never finer than 5 minutes
const MAX_BUCKET_MS = 24 * 60 * 60 * 1000; // never coarser than a day

/** How many trailing buckets count as "now" when testing for a spike. */
const RECENT_WINDOW = 3;
const MIN_BUCKETS_FOR_ZSCORE = 5;
const Z_THRESHOLD = 2.0;
const MIN_MENTIONS_TO_REPORT = 2;

interface KeywordSeries {
  counts: Map<number, number>; // bucket index -> mentions
  sentimentSum: number;
  total: number;
  emotions: Map<EmotionType, number>;
  platforms: Set<PlatformType>;
  firstSeen: string;
  peakBucket: number;
  peakCount: number;
}

/**
 * Hashtags plus inline #tags, keeping the keyword space interpretable.
 *
 * Purely numeric tags are dropped: they are never a meaningful topic, and they
 * are the signature of an HTML entity that survived decoding (`&#036;` reads as
 * "#036"). Filtering here is defence in depth -- the scraper decodes entities,
 * but a future connector may not.
 */
function extractKeywords(post: SocialPost): string[] {
  const inline = post.content.match(/#[a-zA-Z0-9_]+/g) || [];
  return Array.from(new Set([...(post.hashtags || []), ...inline])).filter((tag) => {
    const body = tag.replace(/^#/, '');
    return body.length > 0 && !/^\d+$/.test(body);
  });
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[], mu: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((acc, v) => acc + (v - mu) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cutoffTime = searchParams.get('cutoffTime');
  const platform = searchParams.get('platform');

  let posts = await getAllPosts();

  // Drop items whose timestamp cannot be parsed rather than letting NaN
  // propagate silently through the bucketing arithmetic.
  posts = posts.filter((p) => !Number.isNaN(new Date(p.timestamp).getTime()));

  if (cutoffTime) {
    const cutoffDate = new Date(cutoffTime).getTime();
    if (!Number.isNaN(cutoffDate)) {
      posts = posts.filter((p) => new Date(p.timestamp).getTime() <= cutoffDate);
    }
  }
  if (platform && platform !== 'all') {
    posts = posts.filter((p) => p.platform === platform);
  }

  if (posts.length === 0) {
    return NextResponse.json({
      activeTrendsCount: 0,
      spikingTrends: [],
      trends: [],
      method: { bucketSizeMinutes: 0, zThreshold: Z_THRESHOLD, bucketCount: 0 },
    });
  }

  // ── Bucket the timeline into fixed-width intervals ──────────────────────
  const times = posts.map((p) => new Date(p.timestamp).getTime());
  const t0 = Math.min(...times);
  const tN = Math.max(...times);
  const span = Math.max(tN - t0 + 1, 1);

  const BUCKET_MS = Math.min(
    MAX_BUCKET_MS,
    Math.max(MIN_BUCKET_MS, Math.ceil(span / TARGET_BUCKETS))
  );
  const bucketCount = Math.max(1, Math.ceil(span / BUCKET_MS));

  const series = new Map<string, KeywordSeries>();

  for (const post of posts) {
    const bucket = Math.floor((new Date(post.timestamp).getTime() - t0) / BUCKET_MS);

    for (const kw of extractKeywords(post)) {
      let entry = series.get(kw);
      if (!entry) {
        entry = {
          counts: new Map(),
          sentimentSum: 0,
          total: 0,
          emotions: new Map(),
          platforms: new Set(),
          firstSeen: post.timestamp,
          peakBucket: bucket,
          peakCount: 0,
        };
        series.set(kw, entry);
      }

      const next = (entry.counts.get(bucket) || 0) + 1;
      entry.counts.set(bucket, next);
      if (next > entry.peakCount) {
        entry.peakCount = next;
        entry.peakBucket = bucket;
      }

      entry.total += 1;
      entry.sentimentSum += post.sentiment.score;
      entry.platforms.add(post.platform);

      const em = post.sentiment.nuancedEmotion;
      entry.emotions.set(em, (entry.emotions.get(em) || 0) + 1);

      if (new Date(post.timestamp).getTime() < new Date(entry.firstSeen).getTime()) {
        entry.firstSeen = post.timestamp;
      }
    }
  }

  // ── Score each keyword ──────────────────────────────────────────────────
  const trends: TrendTopic[] = [];

  for (const [keyword, data] of series) {
    if (data.total < MIN_MENTIONS_TO_REPORT) continue;

    // Dense per-bucket count vector (absent buckets are genuine zeros).
    const counts: number[] = [];
    for (let b = 0; b < bucketCount; b++) counts.push(data.counts.get(b) || 0);

    // Compare the trailing RECENT_WINDOW buckets against everything before
    // them. Testing only the single last bucket meant a keyword that surged an
    // hour ago but is quiet right now scored a huge z against a near-zero
    // sigma while its `current` was 0 -- reporting z=20 and spike=false at the
    // same time, which is nonsense.
    const windowSize = Math.min(RECENT_WINDOW, Math.max(1, counts.length - 1));
    const recent = counts.slice(-windowSize);
    const history = counts.slice(0, -windowSize);
    const current = Math.max(...recent);

    let zScore = 0;
    if (history.length >= MIN_BUCKETS_FOR_ZSCORE) {
      const mu = mean(history);
      const sigma = stdDev(history, mu);
      if (sigma > 0) {
        zScore = (current - mu) / sigma;
      } else if (current > mu) {
        // A perfectly flat history has no variance to divide by. Fall back to
        // the raw jump so a first-ever burst is still detectable, but do not
        // manufacture an unbounded score.
        zScore = Math.min(current - mu, Z_THRESHOLD * 2);
      }
    }

    // Both conditions describe the same claim: unusually high *and* actually
    // active now. They can no longer contradict each other.
    const isSpike = zScore >= Z_THRESHOLD && current >= MIN_MENTIONS_TO_REPORT;

    // Growth: trailing half vs leading half of the observed window.
    const half = Math.max(1, Math.floor(counts.length / 2));
    const earlier = counts.slice(0, half).reduce((a, b) => a + b, 0);
    const later = counts.slice(half).reduce((a, b) => a + b, 0);
    const growthRate =
      earlier > 0
        ? Math.round(((later - earlier) / earlier) * 100)
        : later > 0
        ? 100
        : 0;

    let dominantEmotion: EmotionType = 'neutral';
    let maxEm = 0;
    for (const [emotion, count] of data.emotions) {
      if (count > maxEm) {
        maxEm = count;
        dominantEmotion = emotion;
      }
    }

    const lower = keyword.toLowerCase();
    const category =
      /ai|tech|cyber|quantum|data/.test(lower) ? 'Technology'
      : /security|intel|defen|border|threat/.test(lower) ? 'National Security'
      : /econom|market|financ|invest|crypto/.test(lower) ? 'Finance'
      : /policy|govern|election|parliament/.test(lower) ? 'Policy & Governance'
      : 'General Discourse';

    trends.push({
      id: `trend_${keyword.replace(/[^a-zA-Z0-9]/g, '_')}`,
      keyword,
      category,
      postCount: data.total,
      growthRate,
      sentimentScore: Number((data.sentimentSum / data.total).toFixed(2)),
      dominantEmotion,
      isSpike,
      zScore: Number(zScore.toFixed(2)),
      firstDetectedAt: data.firstSeen,
      peakTime: new Date(t0 + data.peakBucket * BUCKET_MS).toISOString(),
      platforms: Array.from(data.platforms),
    });
  }

  // Rank by statistical significance first, then raw volume.
  trends.sort((a, b) => {
    if (a.isSpike !== b.isSpike) return a.isSpike ? -1 : 1;
    if ((b.zScore ?? 0) !== (a.zScore ?? 0)) return (b.zScore ?? 0) - (a.zScore ?? 0);
    return b.postCount - a.postCount;
  });

  return NextResponse.json({
    activeTrendsCount: trends.length,
    spikingTrends: trends.filter((t) => t.isSpike),
    trends: trends.slice(0, 12),
    // Surfaced so the detection method is auditable rather than a black box.
    method: {
      bucketSizeMinutes: Math.round(BUCKET_MS / 60000),
      zThreshold: Z_THRESHOLD,
      recentWindowBuckets: RECENT_WINDOW,
      bucketCount,
      windowStart: new Date(t0).toISOString(),
      windowEnd: new Date(tN).toISOString(),
    },
  });
}
