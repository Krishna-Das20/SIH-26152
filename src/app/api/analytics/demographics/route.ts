import { NextResponse } from 'next/server';
import { getAllPosts } from '@/lib/store';

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

  // Aggregate unique authors
  const authorMap = new Map<string, any>();
  for (const post of posts) {
    if (!authorMap.has(post.author.id)) {
      authorMap.set(post.author.id, post.author);
    }
  }
  const authors = Array.from(authorMap.values());
  const totalAuthors = Math.max(authors.length, 1);

  // 1. Age Bracket Distribution
  const ageCounts: Record<string, number> = { '<18': 0, '18-24': 0, '25-34': 0, '35-50': 0, '50+': 0 };
  // 2. Geographic Distribution
  const geoCounts: Record<string, number> = {};
  // 3. Language Distribution
  const langCounts: Record<string, number> = {};
  // 4. Interests
  const interestCounts: Record<string, number> = {};

  for (const author of authors) {
    // Age
    const age = author.estimatedAgeBracket || '25-34';
    ageCounts[age] = (ageCounts[age] || 0) + 1;

    // Geo
    const geo = author.inferredLocation || 'Unknown';
    geoCounts[geo] = (geoCounts[geo] || 0) + 1;

    // Language
    const lang = author.detectedLanguage || 'English';
    langCounts[lang] = (langCounts[lang] || 0) + 1;

    // Interests
    if (author.interests && Array.isArray(author.interests)) {
      for (const interest of author.interests) {
        interestCounts[interest] = (interestCounts[interest] || 0) + 1;
      }
    }
  }

  const ageGroups = Object.entries(ageCounts).map(([bracket, count]) => ({
    bracket,
    count,
    percentage: Math.round((count / totalAuthors) * 100)
  }));

  const geographicDistribution = Object.entries(geoCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([region, count]) => ({
      region,
      count,
      percentage: Math.round((count / totalAuthors) * 100)
    }));

  const languages = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([language, count]) => ({
      language,
      count,
      percentage: Math.round((count / totalAuthors) * 100)
    }));

  const interestClusters = Object.entries(interestCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => ({
      topic,
      affinityScore: Math.round((count / totalAuthors) * 100)
    }));

  return NextResponse.json({
    totalAudienceSampled: totalAuthors,
    ageGroups,
    geographicDistribution,
    languages,
    interestClusters
  });
}
