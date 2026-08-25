export type PlatformType = 'x' | 'telegram' | 'reddit' | 'youtube' | 'instagram' | 'facebook';

export type StanceType = 'supportive' | 'opposing' | 'neutral';

export type EmotionType = 
  | 'excitement' 
  | 'anxiety' 
  | 'anger' 
  | 'joy' 
  | 'fear' 
  | 'sadness' 
  | 'supportive'
  | 'against'
  | 'neutral';

export interface AuthorProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  platform: PlatformType;
  /**
   * Null when the platform does not expose a follower/subscriber count
   * (e.g. Reddit). Never synthesise a value — downstream influence ranking
   * reads this field and a fabricated number silently corrupts KOL scores.
   */
  followerCount: number | null;
  followingCount?: number;
  postCount?: number;
  verified: boolean;

  // Demographics inferred (Component C).
  // `null` means "could not be inferred from available evidence" and must be
  // rendered as Unknown rather than guessed.
  estimatedAgeBracket: '<18' | '18-24' | '25-34' | '35-50' | '50+' | null;
  inferredLocation: string | null;
  detectedLanguage: string | null;
  interests: string[];
  
  // Network attributes (Component E)
  isKOL?: boolean;
  isBotSuspicious?: boolean;
  pageRankScore?: number;
  betweennessScore?: number;
  communityId?: number;
}

export interface SentimentAnalysis {
  score: number; // -1.0 to 1.0
  label: 'positive' | 'negative' | 'neutral';
  nuancedEmotion: EmotionType;
  sarcasmScore: number; // 0.0 to 1.0 (1.0 = highly sarcastic)
  stance: StanceType;
  /** Model probability for the winning label. Never a random value. */
  confidence: number;
  keywords: string[];
  /**
   * Which engine produced this analysis. Surfaced in the UI so an analyst can
   * tell a transformer prediction from the regex fallback.
   */
  engine?: 'ml' | 'lexicon';
}

export interface SocialPost {
  id: string;
  platform: PlatformType;
  author: AuthorProfile;
  content: string;
  timestamp: string; // ISO-8601
  url?: string;
  
  // Interactions / Link Analysis
  likes: number;
  shares: number;
  replies: number;
  views?: number;
  
  // Parent/Thread links
  inReplyToPostId?: string;
  inReplyToAuthorId?: string;
  mentionedUsernames?: string[];
  hashtags: string[];
  
  // NLP analysis
  sentiment: SentimentAnalysis;
}

export interface GraphNode {
  id: string;
  label: string;
  username: string;
  platform: PlatformType;
  followerCount: number | null;
  centralityScore: number; // 0 to 100
  pageRank: number;
  /** Brandes betweenness, normalised to [0,1]. */
  betweennessCentrality: number;
  /** Louvain community index. -1 until clustering has run. */
  communityId: number;
  dominantSentiment: 'positive' | 'negative' | 'neutral';
  dominantEmotion: EmotionType;
  isKOL: boolean;
  isBotSuspicious: boolean;
  postCount: number;
  inferredLocation: string | null;
  ageBracket: string | null;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'retweet' | 'reply' | 'mention' | 'quote' | 'spread';
  weight: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  timestamp: string;
  isDiffusionPath?: boolean;
}

export interface NetworkTopology {
  nodes: GraphNode[];
  links: GraphLink[];
  communities: {
    id: number;
    name: string;
    size: number;
    dominantTopic: string;
    dominantSentiment: string;
    color: string;
  }[];
  topKOLs: {
    id: string;
    username: string;
    displayName: string;
    platform: PlatformType;
    influenceScore: number;
    reach: number | null;
    betweennessRank: number;
    dominantStance: StanceType;
  }[];
  diffusionSteps?: {
    step: number;
    timestamp: string;
    activeNodeIds: string[];
    newlyInfectedLinks: { source: string; target: string }[];
  }[];
  /**
   * Newman-Girvan modularity of the Louvain partition. Above ~0.3 indicates
   * genuine community structure; near 0 means the clustering is not meaningful
   * and should not be presented as such.
   */
  modularity?: number;
}

export interface EmotionMetrics {
  joy: number;
  excitement: number;
  anxiety: number;
  anger: number;
  fear: number;
  sadness: number;
  neutral: number;
  sarcasmIndex: number;
  overallSentimentScore: number;
  stanceBreakdown: {
    supportive: number;
    opposing: number;
    neutral: number;
  };
}

export interface DemographicMetrics {
  ageGroups: { bracket: string; percentage: number; count: number }[];
  geographicDistribution: { region: string; count: number; percentage: number; coordinates?: [number, number] }[];
  languages: { language: string; count: number; percentage: number }[];
  interestClusters: { topic: string; affinityScore: number }[];
}

export interface TrendTopic {
  id: string;
  keyword: string;
  category: string;
  postCount: number;
  growthRate: number; // percentage surge
  sentimentScore: number;
  dominantEmotion: EmotionType;
  isSpike: boolean;
  /** Rolling z-score of the latest bucket vs its own history. */
  zScore?: number;
  firstDetectedAt: string;
  peakTime: string;
  platforms: PlatformType[];
}

export interface TimelineDataPoint {
  timestamp: string;
  postVolume: number;
  sentimentScore: number;
  sarcasmCount: number;
  anxietyCount: number;
  excitementCount: number;
  angerCount: number;
  supportiveCount: number;
  opposingCount: number;
}
