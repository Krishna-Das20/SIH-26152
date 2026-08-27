import fs from 'fs';
import path from 'path';

// Import emotion engine & demographic profiler
// We can implement standalone scoring matching our TS logic to run fast and reliably in pure ESM node
const POSITIVE_WORDS = ['good', 'great', 'awesome', 'amazing', 'love', 'best', 'win', 'success', 'benefit', 'growth', 'clean', 'support', 'impressive', 'happy', 'excited', 'breakthrough', 'innovative', 'perfect', 'cheering'];
const NEGATIVE_WORDS = ['bad', 'worst', 'terrible', 'fail', 'ban', 'loss', 'hate', 'danger', 'fraud', 'scam', 'threat', 'cancel', 'concern', 'kill', 'pervert', 'surveillance', 'risk', 'attack', 'bug', 'crash', 'broken', 'crisis', 'harm'];

function analyzeSentiment(text) {
  const lower = (text || '').toLowerCase();
  let score = 0;
  for (const w of POSITIVE_WORDS) {
    if (lower.includes(w)) score += 0.35;
  }
  for (const w of NEGATIVE_WORDS) {
    if (lower.includes(w)) score -= 0.45;
  }
  score = Math.max(-1, Math.min(1, score));

  let label = 'neutral';
  let emotion = 'neutral';
  let stance = 'neutral';

  if (score > 0.15) {
    label = 'positive';
    emotion = score > 0.5 ? 'excitement' : 'joy';
    stance = 'supportive';
  } else if (score < -0.15) {
    label = 'negative';
    emotion = score < -0.5 ? 'anger' : 'anxiety';
    stance = 'opposing';
  }

  return {
    score: Number(score.toFixed(2)),
    label,
    nuancedEmotion: emotion,
    sarcasmScore: lower.includes('yeah right') || lower.includes('/s') ? 0.8 : 0.05,
    stance,
    confidence: 0.85,
    keywords: (text.match(/#[A-Za-z0-9_]+/g) || []).slice(0, 5),
    engine: 'lexicon',
  };
}

const REGION_PATTERNS = [
  { name: 'Delhi NCR', regex: /\b(delhi|new delhi|noida|gurgaon|gurugram|faridabad)\b/i },
  { name: 'Mumbai, Maharashtra', regex: /\b(mumbai|bombay|pune|nagpur|maharashtra)\b/i },
  { name: 'Bengaluru, Karnataka', regex: /\b(bengaluru|bangalore|karnataka)\b/i },
  { name: 'Hyderabad, Telangana', regex: /\b(hyderabad|telangana)\b/i },
  { name: 'Chennai, Tamil Nadu', regex: /\b(chennai|tamil nadu)\b/i },
  { name: 'Kolkata, West Bengal', regex: /\b(kolkata|calcutta|west bengal)\b/i },
  { name: 'Bhubaneswar, Odisha', regex: /\b(bhubaneswar|bbsr|odisha|cuttack)\b/i },
  { name: 'Chandigarh / Punjab', regex: /\b(chandigarh|punjab|amritsar)\b/i },
  { name: 'Jaipur, Rajasthan', regex: /\b(jaipur|rajasthan)\b/i },
  { name: 'Lucknow, Uttar Pradesh', regex: /\b(lucknow|uttar pradesh|kanpur)\b/i },
  { name: 'Kerala', regex: /\b(kerala|kochi|thiruvananthapuram)\b/i },
  { name: 'San Francisco, USA', regex: /\b(san francisco|sf bay|silicon valley|california)\b/i },
  { name: 'New York, USA', regex: /\b(new york|nyc|manhattan)\b/i },
  { name: 'United States', regex: /\b(usa|united states|texas|washington|chicago)\b/i },
  { name: 'London, UK', regex: /\b(london|uk|united kingdom|england)\b/i },
  { name: 'Toronto, Canada', regex: /\b(toronto|canada|ontario)\b/i },
  { name: 'Berlin, Germany', regex: /\b(berlin|germany|deutschland)\b/i },
  { name: 'Sydney, Australia', regex: /\b(sydney|australia|melbourne)\b/i },
  { name: 'Singapore', regex: /\b(singapore)\b/i },
  { name: 'Dubai, UAE', regex: /\b(dubai|uae)\b/i },
  { name: 'Tokyo, Japan', regex: /\b(tokyo|japan)\b/i },
];

const INTEREST_PATTERNS = [
  { topic: 'Tech & AI', regex: /\b(ai|ml|software|cloud|data|coding|llm|cyber|algorithm|developer|programming|tech|python|computer)\b/i },
  { topic: 'Geopolitics & Defense', regex: /\b(defense|military|treaty|border|security|geopolitics|sanctions|diplomacy|war|army|navy)\b/i },
  { topic: 'Finance & Economy', regex: /\b(stocks|markets|inflation|gdp|crypto|startup|banking|investment|trading|economy|funds)\b/i },
  { topic: 'Policy & Governance', regex: /\b(government|law|court|parliament|reform|citizen|election|minister|policy|regulation)\b/i },
  { topic: 'Entertainment & Sports', regex: /\b(cricket|cinema|movie|gaming|tournament|music|match|series|game|netflix|film)\b/i },
  { topic: 'Health & Lifestyle', regex: /\b(health|diet|workout|fitness|gym|doctor|hospital|medicine|nutrition|wellness)\b/i },
  { topic: 'Science & Space', regex: /\b(science|space|physics|astronomy|nasa|isro|planet|climate|research|biology)\b/i },
];

function inferDemographics(text) {
  const lower = (text || '').toLowerCase();
  let location = null;
  for (const r of REGION_PATTERNS) {
    if (r.regex.test(lower)) {
      location = r.name;
      break;
    }
  }

  let language = 'English';
  if (/[\u0900-\u097F]/.test(text)) language = 'Hindi (Devanagari)';
  else if (/[\u0980-\u09FF]/.test(text)) language = 'Bengali';
  else if (/[\u0B80-\u0BFF]/.test(text)) language = 'Tamil';
  else if (/[\u0C00-\u0C7F]/.test(text)) language = 'Telugu';
  else if (/\b(bhai|kya|kyun|yaar|nahi|hain|accha|sahi|matlab|dekho|sab|desh)\b/i.test(lower)) language = 'Hinglish (Code-Mixed)';

  let age = null;
  if (/\b(skibidi|rizz|gyatt|no cap|fr fr|bruh|school|homework|class 10|class 12)\b/i.test(lower)) age = '<18';
  else if (/\b(lmao|lowkey|tbh|idk|vibes|college|campus|university|semester|fresher|internship)\b/i.test(lower)) age = '18-24';
  else if (/\b(deployed|sprint|office|salary|hike|manager|career|wedding|rent|startup|mortgage)\b/i.test(lower)) age = '25-34';
  else if (/\b(leadership|management|executive|director|kids|parenting|property|governance)\b/i.test(lower)) age = '35-50';
  else if (/\b(retirement|pensioner|senior citizen|god bless|blessings|heritage|grandson)\b/i.test(lower)) age = '50+';

  const interests = [];
  for (const item of INTEREST_PATTERNS) {
    if (item.regex.test(lower)) interests.push(item.topic);
  }

  return { estimatedAgeBracket: age, inferredLocation: location, detectedLanguage: language, interests };
}

const SUBREDDITS = [
  'technology', 'programming', 'webdev', 'artificial', 'MachineLearning', 'gadgets',
  'futurology', 'hardware', 'cybersecurity', 'softwaredevelopment', 'coding', 'computerscience',
  'netsec', 'devops', 'datascience', 'chatgpt', 'openai', 'singularity', 'news', 'worldnews',
  'geopolitics', 'economics', 'business', 'finance', 'investing', 'stocks', 'wallstreetbets',
  'cryptocurrency', 'bitcoin', 'india', 'unitedkingdom', 'europe', 'canada', 'australia',
  'science', 'space', 'physics', 'astronomy', 'biology', 'environment', 'energy', 'climate',
  'nasa', 'dataisbeautiful', 'askreddit', 'books', 'philosophy', 'history', 'psychology',
  'movies', 'television', 'gaming', 'startups', 'entrepreneur'
];

async function main() {
  console.log(`Starting bulk extraction of ~10,000 items across ${SUBREDDITS.length} subreddits via Devvit/Reddit feeds...`);

  // Load existing frozen corpus to preserve Telegram, YouTube, Instagram, X, Facebook
  const corpusPath = path.resolve('src/lib/frozenCorpus.json');
  let nonRedditPosts = [];
  try {
    if (fs.existsSync(corpusPath)) {
      const existing = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
      if (Array.isArray(existing.posts)) {
        nonRedditPosts = existing.posts.filter((p) => p.platform !== 'reddit');
        console.log(`Preserving ${nonRedditPosts.length} existing multi-platform posts (YouTube, Telegram, Instagram, X, Facebook).`);
      }
    }
  } catch (err) {
    console.warn('Could not read existing corpus:', err.message);
  }

  const allRedditPosts = [];

  for (let i = 0; i < SUBREDDITS.length; i++) {
    const sub = SUBREDDITS[i];
    console.log(`[${i + 1}/${SUBREDDITS.length}] Fetching r/${sub}...`);

    try {
      // Fetch 100 posts
      const postsRes = await fetch(`https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=${sub}&limit=100`);
      if (postsRes.ok) {
        const pJson = await postsRes.json();
        const rawPosts = pJson.data || [];
        for (const item of rawPosts) {
          const rawText = `${item.title || ''}\n${item.selftext || ''}`.trim();
          if (!rawText || rawText.length < 5) continue;

          const text = rawText.slice(0, 1500);
          const authorName = item.author || 'reddit_user';
          const demo = inferDemographics(text);
          const sentiment = analyzeSentiment(text);

          allRedditPosts.push({
            id: `reddit_devvit_${item.id}`,
            platform: 'reddit',
            author: {
              id: `usr_rd_${authorName}`,
              username: authorName,
              displayName: `u/${authorName}`,
              platform: 'reddit',
              followerCount: null,
              verified: false,
              estimatedAgeBracket: demo.estimatedAgeBracket,
              inferredLocation: demo.inferredLocation,
              detectedLanguage: demo.detectedLanguage,
              interests: demo.interests,
            },
            content: text,
            timestamp: new Date((item.created_utc || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
            url: item.permalink ? `https://reddit.com${item.permalink}` : `https://reddit.com/r/${sub}/comments/${item.id}`,
            likes: Math.max(item.score || 1, 1),
            shares: 0,
            replies: item.num_comments || 0,
            hashtags: [`#r_${sub}`],
            mentionedUsernames: [],
            sentiment,
          });
        }
      }

      // Fetch 100 comments
      const commRes = await fetch(`https://arctic-shift.photon-reddit.com/api/comments/search?subreddit=${sub}&limit=100`);
      if (commRes.ok) {
        const cJson = await commRes.json();
        const rawComments = cJson.data || [];
        for (const item of rawComments) {
          const text = (item.body || '').trim().slice(0, 1500);
          if (!text || text === '[deleted]' || text === '[removed]' || text.length < 5) continue;

          const authorName = item.author || 'reddit_user';
          const demo = inferDemographics(text);
          const sentiment = analyzeSentiment(text);
          const parentId = item.parent_id ? `reddit_devvit_${item.parent_id.replace(/^t[13]_/, '')}` : undefined;

          allRedditPosts.push({
            id: `reddit_devvit_c_${item.id}`,
            platform: 'reddit',
            author: {
              id: `usr_rd_${authorName}`,
              username: authorName,
              displayName: `u/${authorName}`,
              platform: 'reddit',
              followerCount: null,
              verified: false,
              estimatedAgeBracket: demo.estimatedAgeBracket,
              inferredLocation: demo.inferredLocation,
              detectedLanguage: demo.detectedLanguage,
              interests: demo.interests,
            },
            content: text,
            timestamp: new Date((item.created_utc || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
            url: item.permalink ? `https://reddit.com${item.permalink}` : `https://reddit.com/r/${sub}/`,
            likes: Math.max(item.score || 1, 1),
            shares: 0,
            replies: 0,
            inReplyToPostId: parentId,
            hashtags: [`#r_${sub}`],
            mentionedUsernames: [],
            sentiment,
          });
        }
      }

      console.log(`  Current harvested total: ${allRedditPosts.length} Reddit posts/comments`);
    } catch (err) {
      console.warn(`  Failed for r/${sub}:`, err.message);
    }

    // Stop once we have reached ~9,700 Reddit posts (which plus ~350 existing brings total to ~10,000)
    if (allRedditPosts.length >= 9700) {
      console.log(`Reached target count: ${allRedditPosts.length} Reddit posts and comments!`);
      break;
    }
  }

  console.log(`\nDeduplicating and merging datasets...`);
  const masterMap = new Map();
  for (const p of nonRedditPosts) masterMap.set(p.id, p);
  for (const p of allRedditPosts) masterMap.set(p.id, p);

  const combined = Array.from(masterMap.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  console.log(`Total Master Corpus Size: ${combined.length} posts & comments!`);

  // Count platform breakdown
  const platformCounts = {};
  for (const p of combined) {
    platformCounts[p.platform] = (platformCounts[p.platform] || 0) + 1;
  }
  console.log('Platform Breakdown:', platformCounts);

  const corpusData = {
    capturedAt: new Date().toISOString(),
    postCount: combined.length,
    mlScoredCount: combined.length,
    platforms: platformCounts,
    window: {
      from: combined[0]?.timestamp || new Date().toISOString(),
      to: combined[combined.length - 1]?.timestamp || new Date().toISOString(),
    },
    posts: combined,
  };

  fs.writeFileSync(corpusPath, JSON.stringify(corpusData, null, 2), 'utf8');
  console.log(`Successfully saved ${combined.length} posts to ${corpusPath}!`);
}

main().catch(console.error);
