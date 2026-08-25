export interface DemographicInference {
  /** null when no age signal was found. Render as "Unknown", never guess. */
  estimatedAgeBracket: '<18' | '18-24' | '25-34' | '35-50' | '50+' | null;
  /** null when no location entity was found in the text or profile. */
  inferredLocation: string | null;
  /** null when the text is too short or ambiguous to classify. */
  detectedLanguage: string | null;
  interests: string[];
}

const INDIAN_REGIONS = [
  'Delhi NCR', 'Mumbai, Maharashtra', 'Bengaluru, Karnataka', 'Hyderabad, Telangana', 
  'Chennai, Tamil Nadu', 'Kolkata, West Bengal', 'Pune, Maharashtra', 'Ahmedabad, Gujarat', 
  'Jaipur, Rajasthan', 'Lucknow, Uttar Pradesh', 'Chandigarh', 'Bhubaneswar, Odisha',
  'Kerala', 'Indore, Madhya Pradesh'
];

const GLOBAL_REGIONS = [
  'San Francisco, USA', 'New York, USA', 'London, UK', 'Singapore', 'Berlin, Germany', 
  'Toronto, Canada', 'Sydney, Australia', 'Dubai, UAE', 'Tokyo, Japan'
];

const AGE_SLANG_MAP = {
  '<18': ['skibidi', 'rizz', 'no cap', 'fr fr', 'bruh', 'ong', 'gyatt', 'slay', 'deadass', 'bussin'],
  '18-24': ['lmao', 'lowkey', 'highkey', 'tbh', 'idk', 'vibes', 'era', 'lit', 'stan', 'fomo', 'grindset', 'clout'],
  '25-34': ['deployed', 'roi', 'production', 'sprint', 'crypto', 'mortgage', 'stack', 'investing', 'career', 'burnout', 'framework'],
  '35-50': ['policy', 'leadership', 'management', 'governance', 'economy', 'enterprise', 'quarterly', 'infrastructure', 'family'],
  '50+': ['god bless', 'blessings', 'back in my day', 'values', 'tradition', 'national interest', 'citizens', 'heritage']
};

const INTEREST_KEYWORDS: Record<string, string[]> = {
  'Tech & AI': ['ai', 'ml', 'software', 'cloud', 'data', 'coding', 'llm', 'cyber', 'quantum', 'algorithm', 'developer'],
  'Geopolitics & Defense': ['defense', 'military', 'treaty', 'border', 'security', 'geopolitics', 'sanctions', 'diplomacy'],
  'Finance & Economy': ['stocks', 'markets', 'inflation', 'gdp', 'crypto', 'startup', 'venture', 'banking', 'funding'],
  'Policy & Governance': ['government', 'law', 'supreme court', 'parliament', 'reform', 'citizen', 'election', 'minister'],
  'Entertainment & Sports': ['cricket', 'cinema', 'bollywood', 'streaming', 'gaming', 'tournament', 'music', 'album']
};

/**
 * Inactive or Active Demographic Profiler (Component C)
 */
export function inferDemographics(
  bio: string = '',
  postsText: string = '',
  locationHint?: string
): DemographicInference {
  const combined = `${bio} ${postsText}`.toLowerCase();

  // 1. Inferred Location
  // Only ever reports a location actually named in the text or supplied by
  // the platform. The previous implementation randomly sampled a city whenever
  // no match was found, which meant the entire geographic distribution chart
  // was fabricated for the overwhelming majority of posts.
  let inferredLocation: string | null = locationHint || null;
  if (!inferredLocation) {
    for (const reg of [...INDIAN_REGIONS, ...GLOBAL_REGIONS]) {
      const city = reg.split(',')[0].toLowerCase();
      if (combined.includes(city)) {
        inferredLocation = reg;
        break;
      }
    }
  }


  // 2. Language Detection
  // Scripts are unambiguous; Latin-script text is only called English when
  // there is enough of it to be worth asserting.
  let detectedLanguage: string | null = null;
  if (/[\u0900-\u097F]/.test(combined)) {
    detectedLanguage = 'Hindi (Devanagari)';
  } else if (/[\u0980-\u09FF]/.test(combined)) {
    detectedLanguage = 'Bengali';
  } else if (/[\u0B80-\u0BFF]/.test(combined)) {
    detectedLanguage = 'Tamil';
  } else if (/[\u0C00-\u0C7F]/.test(combined)) {
    detectedLanguage = 'Telugu';
  } else if (/\b(bhai|kya|kyun|yaar|nahi|hain|accha|sahi|matlab|dekho|sab|desh)\b/i.test(combined)) {
    detectedLanguage = 'Hinglish (Code-Mixed)';
  } else if (combined.trim().split(/\s+/).length >= 4) {
    detectedLanguage = 'English';
  }

  // 3. Age Bracket Inference
  // Starts from an all-zero prior. The previous version seeded 18-24 at 1 and
  // 25-34 at 2, so every text with no age signal whatsoever was confidently
  // labelled 25-34 -- which is what produced the suspiciously smooth age
  // pyramid. With no matches the bracket is now null.
  const ageScores: Record<string, number> = {
    '<18': 0, '18-24': 0, '25-34': 0, '35-50': 0, '50+': 0,
  };
  let ageEvidence = 0;
  
  for (const [bracket, slangs] of Object.entries(AGE_SLANG_MAP)) {
    for (const slang of slangs) {
      if (combined.includes(slang)) {
        ageScores[bracket] += 1;
        ageEvidence += 1;
      }
    }
  }

  type AgeBracket = '<18' | '18-24' | '25-34' | '35-50' | '50+';
  let estimatedAgeBracket: AgeBracket | null = null;
  if (ageEvidence > 0) {
    let maxAgeScore = 0;
    for (const [bracket, score] of Object.entries(ageScores)) {
      if (score > maxAgeScore) {
        maxAgeScore = score;
        estimatedAgeBracket = bracket as AgeBracket;
      }
    }
  }

  // 4. Inferred Professional Interests
  const detectedInterests: string[] = [];
  for (const [interest, keywords] of Object.entries(INTEREST_KEYWORDS)) {
    for (const kw of keywords) {
      if (combined.includes(kw)) {
        if (!detectedInterests.includes(interest)) {
          detectedInterests.push(interest);
        }
        break;
      }
    }
  }
  // No default interests: an empty list means nothing matched, which is the
  // truthful result. Previously every unmatched author was tagged
  // "Tech & AI, Policy & Governance", inflating both categories.

  return {
    estimatedAgeBracket,
    inferredLocation,
    detectedLanguage,
    interests: detectedInterests
  };
}
