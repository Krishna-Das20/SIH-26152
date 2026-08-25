import { NextResponse } from 'next/server';
import { tenantPosts } from '@/lib/tenant';

export async function GET(req: Request) {

  // Tenant-scoped: a signed-in user sees only their own data.
  const { posts } = await tenantPosts(req);

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

  // Coverage: how many authors we could actually infer each attribute for.
  // Reported alongside the distributions so a reader can tell a real
  // distribution from one built on three data points.
  const coverage = { age: 0, location: 0, language: 0, interests: 0 };

  for (const author of authors) {
    // Age. Unresolved authors are counted as Unknown rather than defaulted to
    // '25-34' -- that default previously absorbed every author with no age
    // signal and manufactured the shape of the age pyramid.
    const age = author.estimatedAgeBracket ?? 'Unknown';
    ageCounts[age] = (ageCounts[age] || 0) + 1;
    if (author.estimatedAgeBracket) coverage.age++;

    // Geo
    const geo = author.inferredLocation ?? 'Unknown';
    geoCounts[geo] = (geoCounts[geo] || 0) + 1;
    if (author.inferredLocation) coverage.location++;

    // Language. Was defaulted to 'English', inflating the English share with
    // every author whose language could not be determined.
    const lang = author.detectedLanguage ?? 'Unknown';
    langCounts[lang] = (langCounts[lang] || 0) + 1;
    if (author.detectedLanguage) coverage.language++;

    if (author.interests && author.interests.length > 0) coverage.interests++;

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
    interestClusters,
    // Share of sampled authors for whom each attribute could actually be
    // inferred. Low coverage means the corresponding chart is built on a
    // small subset and should be read as such.
    coverage: {
      age: Math.round((coverage.age / totalAuthors) * 100),
      location: Math.round((coverage.location / totalAuthors) * 100),
      language: Math.round((coverage.language / totalAuthors) * 100),
      interests: Math.round((coverage.interests / totalAuthors) * 100),
    },
  });
}
