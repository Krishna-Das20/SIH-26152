import { SocialPost } from '@/types/intelligence';
import { analyzeSentimentAndEmotion } from '@/lib/nlp/emotionEngine';

/**
 * Baseline simulation dataset. This is explicitly synthetic seed data used so
 * the dashboard has something to render before any live ingestion has run --
 * it is NOT analysis output, and the UI labels it as demo data.
 *
 * Values come from a deterministic hash rather than a random generator, so two
 * runs of the same demo produce identical numbers. A demo whose KPI cards
 * change on every refresh is not a demo anyone can rehearse.
 */
const DEMO_DATE = process.env.DEMO_DATE || '2026-08-25';

/** Deterministic [0,1) value from an index and a salt. */
function rand(index: number, salt: number): number {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const RAW_MOCK_SEEDS = [
  // 1. Tech & AI Breakthrough Narrative (KOL Origin)
  {
    id: 'post_x_101',
    platform: 'x' as const,
    author: {
      id: 'usr_ai_guru',
      username: 'tech_visionary',
      displayName: 'Dr. Aarav Sharma',
      bio: 'AI & Quantum Systems Researcher | Advisor to Tech Taskforces | Ex-IISc',
      platform: 'x' as const,
      followerCount: 84500,
      verified: true,
      estimatedAgeBracket: '35-50' as const,
      inferredLocation: 'Bengaluru, Karnataka',
      detectedLanguage: 'English',
      interests: ['Tech & AI', 'Policy & Governance']
    },
    content: 'Huge milestone for Indian computing! Our national AI cluster just outperformed standard open-weight benchmarks with 40% less energy consumption. The future of sovereign intelligence is here. 🚀🇮🇳 #ArtificialIntelligence #IndiaTech #Breakthrough',
    timestamp: '2026-08-25T02:00:00.000Z',
    likes: 4200,
    shares: 890,
    replies: 230,
    hashtags: ['#ArtificialIntelligence', '#IndiaTech', '#Breakthrough']
  },
  {
    id: 'post_x_102',
    platform: 'x' as const,
    author: {
      id: 'usr_skeptic_01',
      username: 'cyber_skeptic',
      displayName: 'Karan Mehra',
      bio: 'Senior Security Analyst | PenTester | Privacy Advocate',
      platform: 'x' as const,
      followerCount: 19200,
      verified: false,
      estimatedAgeBracket: '25-34' as const,
      inferredLocation: 'Delhi NCR',
      detectedLanguage: 'English',
      interests: ['Tech & AI', 'Geopolitics & Defense']
    },
    content: '@tech_visionary Oh wonderful! Another benchmark triumph. But what about open accessibility and data encryption audits? Without independent red-teaming, this is just corporate PR. Slow claps. 🙄 #DataSecurity #AIAudit',
    timestamp: '2026-08-25T02:30:00.000Z',
    likes: 310,
    shares: 45,
    replies: 88,
    inReplyToPostId: 'post_x_101',
    inReplyToAuthorId: 'usr_ai_guru',
    mentionedUsernames: ['tech_visionary'],
    hashtags: ['#DataSecurity', '#AIAudit']
  },
  {
    id: 'post_tg_201',
    platform: 'telegram' as const,
    author: {
      id: 'usr_tg_intel',
      username: 'BharatTechWatch',
      displayName: 'Bharat Tech Watch Broadcast',
      bio: 'Curated technology briefings and defense cyber intelligence updates.',
      platform: 'telegram' as const,
      followerCount: 52000,
      verified: true,
      estimatedAgeBracket: '25-34' as const,
      inferredLocation: 'Hyderabad, Telangana',
      detectedLanguage: 'English',
      interests: ['Tech & AI', 'Geopolitics & Defense']
    },
    content: '🚨 INTEL UPDATE: High volume of discussions detected across global nodes regarding India’s new sovereign AI compute clusters. Multiple foreign research consortiums requesting partnership terms.',
    timestamp: '2026-08-25T03:15:00.000Z',
    likes: 1240,
    shares: 410,
    replies: 95,
    hashtags: ['#Intel', '#IndiaAI']
  },
  {
    id: 'post_rd_301',
    platform: 'reddit' as const,
    author: {
      id: 'usr_rd_dev',
      username: 'code_ninja_99',
      displayName: 'u/code_ninja_99',
      bio: 'Fullstack & ML Engineer | Open Source Contributor',
      platform: 'reddit' as const,
      followerCount: 2400,
      verified: false,
      estimatedAgeBracket: '18-24' as const,
      inferredLocation: 'Pune, Maharashtra',
      detectedLanguage: 'Hinglish (Code-Mixed)',
      interests: ['Tech & AI']
    },
    content: 'Bhai genuinely impressed with the new indigenous AI benchmarks. Tested the model weights locally on an RTX 4090 and inference latency is lowkey insane! Kya sahi kaam kiya hai team ne. 🙌 #DevVibes #OpenSource',
    timestamp: '2026-08-25T04:00:00.000Z',
    likes: 620,
    shares: 80,
    replies: 140,
    hashtags: ['#DevVibes', '#OpenSource']
  },
  {
    id: 'post_yt_401',
    platform: 'youtube' as const,
    author: {
      id: 'usr_yt_creator',
      username: 'FutureTechChronicles',
      displayName: 'Future Tech Chronicles',
      bio: 'In-depth documentary producer explaining the next frontier of computation.',
      platform: 'youtube' as const,
      followerCount: 142000,
      verified: true,
      estimatedAgeBracket: '35-50' as const,
      inferredLocation: 'Mumbai, Maharashtra',
      detectedLanguage: 'English',
      interests: ['Tech & AI', 'Finance & Economy']
    },
    content: 'Top comment analysis on our documentary: 78% of viewers express excitement regarding homegrown neural infrastructure, while 22% raise concerns over chip semiconductor supply chains. Detailed breakdown dropping tonight!',
    timestamp: '2026-08-25T05:20:00.000Z',
    likes: 3100,
    shares: 210,
    replies: 340,
    hashtags: ['#FutureTech', '#Semiconductors']
  },
  {
    id: 'post_x_103',
    platform: 'x' as const,
    author: {
      id: 'usr_finance_whiz',
      username: 'dalal_street_bull',
      displayName: 'Vikram Singhania',
      bio: 'Macro Investor | Tech Equities | Board Member',
      platform: 'x' as const,
      followerCount: 61000,
      verified: true,
      estimatedAgeBracket: '35-50' as const,
      inferredLocation: 'Mumbai, Maharashtra',
      detectedLanguage: 'English',
      interests: ['Finance & Economy', 'Tech & AI']
    },
    content: 'Capital allocation shifting rapidly towards semiconductor design firms in India. Foreign Institutional Investors poured $420M into domestic AI infrastructure this quarter alone. High growth ahead! 📈💰 #Economy #Investing',
    timestamp: '2026-08-25T06:10:00.000Z',
    likes: 1850,
    shares: 320,
    replies: 110,
    hashtags: ['#Economy', '#Investing']
  },
  {
    id: 'post_x_104',
    platform: 'x' as const,
    author: {
      id: 'usr_student_02',
      username: 'ananya_codes',
      displayName: 'Ananya Roy',
      bio: 'CS Student @ IIT Kharagpur | Competitive Programmer | Hackathon Enthusiast',
      platform: 'x' as const,
      followerCount: 4200,
      verified: false,
      estimatedAgeBracket: '18-24' as const,
      inferredLocation: 'Kolkata, West Bengal',
      detectedLanguage: 'English',
      interests: ['Tech & AI']
    },
    content: 'Replying to @tech_visionary Building our hackathon prototype on top of the national API endpoints! The latency is under 45ms. Let’s go! 🚀 #SIH2026 #Hackathon',
    timestamp: '2026-08-25T07:00:00.000Z',
    likes: 140,
    shares: 12,
    replies: 18,
    inReplyToPostId: 'post_x_101',
    inReplyToAuthorId: 'usr_ai_guru',
    mentionedUsernames: ['tech_visionary'],
    hashtags: ['#SIH2026', '#Hackathon']
  },
  {
    id: 'post_tg_202',
    platform: 'telegram' as const,
    author: {
      id: 'usr_bot_farm_01',
      username: 'FastPromoBot99',
      displayName: 'Crypto Deals Daily',
      bio: 'Automated signal alert bot.',
      platform: 'telegram' as const,
      followerCount: 12,
      verified: false,
      estimatedAgeBracket: '<18' as const,
      inferredLocation: 'Global / Proxy',
      detectedLanguage: 'English',
      interests: ['Finance & Economy']
    },
    content: 'CLICK HERE TO WIN FREE TOKENS FAST PUMP 100X OPPORTUNITY CLICK NOW 🔥🔥🔥',
    timestamp: '2026-08-25T07:15:00.000Z',
    likes: 2,
    shares: 0,
    replies: 0,
    hashtags: ['#Crypto', '#Spam']
  },
  {
    id: 'post_fb_501',
    platform: 'facebook' as const,
    author: {
      id: 'usr_community_lead',
      username: 'tech_india_community',
      displayName: 'Digital India Community Forum',
      bio: 'Empowering tier-2 & tier-3 innovators across India.',
      platform: 'facebook' as const,
      followerCount: 38000,
      verified: false,
      estimatedAgeBracket: '35-50' as const,
      inferredLocation: 'Lucknow, Uttar Pradesh',
      detectedLanguage: 'Hindi (Devanagari)',
      interests: ['Policy & Governance', 'Tech & AI']
    },
    content: 'भारत सरकार द्वारा शुरू की गई राष्ट्रीय एआई पहल से हमारे युवाओं के लिए नए अवसर खुल रहे हैं। सभी विद्यार्थी इसमें अवश्य भाग लें। जय हिन्द! 🇮🇳',
    timestamp: '2026-08-25T08:00:00.000Z',
    likes: 890,
    shares: 160,
    replies: 54,
    hashtags: ['#DigitalIndia', '#AI']
  },
  {
    id: 'post_ig_601',
    platform: 'instagram' as const,
    author: {
      id: 'usr_ig_design',
      username: 'cyber_visuals',
      displayName: 'CyberVisuals Studio',
      bio: 'UI/UX & 3D Spatial Graphics Designer | Bengaluru',
      platform: 'instagram' as const,
      followerCount: 22400,
      verified: false,
      estimatedAgeBracket: '18-24' as const,
      inferredLocation: 'Bengaluru, Karnataka',
      detectedLanguage: 'English',
      interests: ['Entertainment & Sports', 'Tech & AI']
    },
    content: 'Created this 3D conceptual map of information diffusion and neural pathways for modern cyber analytics. What do you guys think? Swipe for breakdown! 🎨✨ #Design #Visuals',
    timestamp: '2026-08-25T08:45:00.000Z',
    likes: 2100,
    shares: 95,
    replies: 120,
    hashtags: ['#Design', '#Visuals']
  }
];

// Generate an extended 60-item chronological historical timeline
export function generateFullIntelligenceDataset(): SocialPost[] {
  const basePosts: SocialPost[] = RAW_MOCK_SEEDS.map((seed) => ({
    ...seed,
    sentiment: analyzeSentimentAndEmotion(seed.content)
  }));

  // Create additional synthesized posts distributed across the 24-hour timeline
  const topics = ['#ArtificialIntelligence', '#DataSecurity', '#Geopolitics', '#Economy', '#NationalSecurity', '#SIH2026'];
  const cities = ['Delhi NCR', 'Mumbai, Maharashtra', 'Bengaluru, Karnataka', 'Hyderabad, Telangana', 'Chennai, Tamil Nadu', 'Kolkata, West Bengal', 'Chandigarh', 'Jaipur, Rajasthan'];
  const platforms: SocialPost['platform'][] = ['x', 'telegram', 'reddit', 'youtube', 'instagram', 'facebook'];

  for (let i = 1; i <= 50; i++) {
    // `Math.floor((i / 50) * 24)` reached 24 at i=50, producing the invalid
    // timestamp "T24:40:00Z". new Date() returns Invalid Date for that, so the
    // post was silently dropped by every downstream timeline filter.
    const hour = Math.min(23, Math.floor(((i - 1) / 50) * 24));
    const minute = (i * 7) % 60; // deterministic, so demo runs are reproducible
    const timeStr = `${DEMO_DATE}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
    const chosenTopic = topics[i % topics.length];
    const city = cities[i % cities.length];
    const platform = platforms[i % platforms.length];

    const contentTemplates = [
      `Analyzing the latest trend curves for ${chosenTopic}. Sentiment is leaning heavily towards optimism across regional networks.`,
      `Is anyone else worried about misinformation cascades surrounding ${chosenTopic}? We need stricter attribution protocols immediately! ⚠️`,
      `Yeah right, because ${chosenTopic} is magically going to solve every single logistical problem overnight. Classic overhype! 🙄`,
      `Huge momentum building around ${chosenTopic}! Community participation is up 300% week-over-week. Incredible progress. 🔥🚀`,
      `Joint committee report published on ${chosenTopic}. Highlights key security benchmarks and cross-border digital governance standards.`
    ];

    const content = contentTemplates[i % contentTemplates.length];
    const sentiment = analyzeSentimentAndEmotion(content);

    basePosts.push({
      id: `post_gen_${i}`,
      platform,
      author: {
        id: `usr_gen_${i % 15}`,
        username: `analyst_node_${i % 15}`,
        displayName: `Intelligence Node #${i % 15}`,
        bio: `Specialized observer tracking ${chosenTopic} across decentralized media.`,
        platform,
        followerCount: Math.floor(rand(i, 1) * 35000 + 500),
        verified: (i % 5 === 0),
        estimatedAgeBracket: i % 3 === 0 ? '18-24' : i % 2 === 0 ? '25-34' : '35-50',
        inferredLocation: city,
        detectedLanguage: i % 4 === 0 ? 'Hinglish (Code-Mixed)' : 'English',
        interests: ['Tech & AI', 'Policy & Governance']
      },
      content,
      timestamp: timeStr,
      likes: Math.floor(rand(i, 2) * 1500 + 20),
      shares: Math.floor(rand(i, 3) * 250 + 5),
      replies: Math.floor(rand(i, 4) * 80 + 2),
      inReplyToAuthorId: (i % 3 === 0) ? 'usr_ai_guru' : undefined,
      hashtags: [chosenTopic, '#Intel'] as string[],
      sentiment
    });
  }

  return basePosts.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}
