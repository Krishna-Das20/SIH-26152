import { NextResponse } from 'next/server';
import { describeCapabilities } from '@/lib/ingestion/registry';

/**
 * Reports the live status of every platform connector (Component A).
 *
 * This is the honesty surface for ingestion: it states, per platform, whether
 * the connector is implemented, whether the credentials it needs are present,
 * and what it would cost to enable. Nothing here is aspirational — `configured`
 * is computed from the actual environment at request time.
 */
export async function GET() {
  const capabilities = describeCapabilities();

  const tierOrder = { essential: 0, desirable: 1, appreciable: 2 } as const;
  const sorted = [...capabilities].sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);

  const live = sorted.filter((c) => c.configured);
  const blocked = sorted.filter((c) => !c.configured);

  return NextResponse.json({
    // Every platform named in the problem statement has a connector.
    implemented: sorted.length,
    live: live.length,
    platforms: sorted,
    summary: {
      essential: {
        total: sorted.filter((c) => c.tier === 'essential').length,
        live: live.filter((c) => c.tier === 'essential').length,
      },
      desirable: {
        total: sorted.filter((c) => c.tier === 'desirable').length,
        live: live.filter((c) => c.tier === 'desirable').length,
      },
      appreciable: {
        total: sorted.filter((c) => c.tier === 'appreciable').length,
        live: live.filter((c) => c.tier === 'appreciable').length,
      },
    },
    needsCredentials: blocked.map((c) => ({
      platform: c.platform,
      displayName: c.displayName,
      tier: c.tier,
      cost: c.cost,
      missing: c.requiredEnv,
      setupDoc: c.setupDoc,
    })),
  });
}
