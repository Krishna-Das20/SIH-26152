import { NextRequest, NextResponse } from 'next/server';
import { getYoutubeQuotaTelemetry, syncLiveYoutube } from '@/lib/ingestion/youtube';

export const dynamic = 'force-dynamic';

/**
 * GET /api/youtube/sync
 * Returns quota telemetry for YouTube Data API v3 (10,000 units/day)
 */
export async function GET() {
  const telemetry = getYoutubeQuotaTelemetry();
  return NextResponse.json({
    status: 'ok',
    telemetry,
  });
}

/**
 * POST /api/youtube/sync
 * Body: { target: string, limit?: number, apiKey?: string }
 * Fetches real comments, scores sentiments & emotions, and merges into intelligence store
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const target = (body.target || 'dQw4w9WgXcQ').trim();
    const limit = Math.min(Number(body.limit) || 25, 100);

    if (body.apiKey && typeof body.apiKey === 'string' && body.apiKey.trim().length > 10) {
      const key = body.apiKey.trim();
      process.env.YOUTUBE_API_KEY = key;
      try {
        const fs = await import('fs');
        const path = await import('path');
        const envPath = path.resolve(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
          let content = fs.readFileSync(envPath, 'utf8');
          if (content.includes('YOUTUBE_API_KEY=')) {
            content = content.replace(/YOUTUBE_API_KEY=.*/g, `YOUTUBE_API_KEY=${key}`);
          } else {
            content += `\nYOUTUBE_API_KEY=${key}\n`;
          }
          fs.writeFileSync(envPath, content, 'utf8');
        }
      } catch (e) {
        console.warn('Could not persist key to .env:', e);
      }
    }

    const result = await syncLiveYoutube(target, limit);

    return NextResponse.json({
      success: result.success,
      count: result.count,
      target,
      telemetry: result.telemetry,
      error: result.error,
      postsSample: result.posts.slice(0, 3),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Failed to sync YouTube comments',
        telemetry: getYoutubeQuotaTelemetry(),
      },
      { status: 500 }
    );
  }
}
