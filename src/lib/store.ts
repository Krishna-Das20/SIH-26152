import { SocialPost } from '@/types/intelligence';
import { generateFullIntelligenceDataset } from '@/lib/demoData';
import { getDatabase } from '@/lib/mongodb';

// In-memory runtime state for instant response and Vercel serverless lifecycle
let globalPostsCache: SocialPost[] = generateFullIntelligenceDataset();

export async function getAllPosts(): Promise<SocialPost[]> {
  const db = await getDatabase();
  if (db) {
    try {
      const posts = await db.collection<SocialPost>('posts').find({}).sort({ timestamp: 1 }).toArray();
      if (posts.length > 0) {
        return posts;
      }
    } catch (e) {
      console.warn('Could not read from MongoDB Atlas, using memory cache:', e);
    }
  }
  return globalPostsCache;
}

export async function addPosts(newPosts: SocialPost[]): Promise<void> {
  // Prepend or merge
  const existingIds = new Set(globalPostsCache.map(p => p.id));
  const uniqueNew = newPosts.filter(p => !existingIds.has(p.id));
  globalPostsCache = [...uniqueNew, ...globalPostsCache].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const db = await getDatabase();
  if (db && uniqueNew.length > 0) {
    try {
      await db.collection('posts').insertMany(uniqueNew as any);
    } catch (e) {
      console.warn('Failed to persist to MongoDB Atlas:', e);
    }
  }
}

export function resetDataset(): SocialPost[] {
  globalPostsCache = generateFullIntelligenceDataset();
  return globalPostsCache;
}
