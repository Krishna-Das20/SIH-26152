export interface DemographicInference {
  estimatedAgeBracket: '<18' | '18-24' | '25-34' | '35-50' | '50+';
  inferredLocation: string;
  detectedLanguage: string;
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
  let inferredLocation = locationHint || '';
  if (!inferredLocation) {
    for (const reg of [...INDIAN_REGIONS, ...GLOBAL_REGIONS]) {
      const city = reg.split(',')[0].toLowerCase();
      if (combined.includes(city)) {
        inferredLocation = reg;
        break;
      }
    }
  }
  if (!inferredLocation) {
    // Probabilistic sample prioritizing Indian demographics
    const rand = Math.random();
    inferredLocation = rand > 0.35 
      ? INDIAN_REGIONS[Math.floor(Math.random() * INDIAN_REGIONS.length)]
      : GLOBAL_REGIONS[Math.floor(Math.random() * GLOBAL_REGIONS.length)];
  }

  // 2. Language Detection
  let detectedLanguage = 'English';
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
  }

  // 3. Age Bracket Inference
  const ageScores = { '<18': 0, '18-24': 1, '25-34': 2, '35-50': 0.5, '50+': 0.2 };
  
  for (const [bracket, slangs] of Object.entries(AGE_SLANG_MAP)) {
    for (const slang of slangs) {
      if (combined.includes(slang)) {
        ageScores[bracket as keyof typeof ageScores] += 2.5;
      }
    }
  }

  let estimatedAgeBracket: '<18' | '18-24' | '25-34' | '35-50' | '50+' = '25-34';
  let maxAgeScore = -1;
  for (const [bracket, score] of Object.entries(ageScores)) {
    if (score > maxAgeScore) {
      maxAgeScore = score;
      estimatedAgeBracket = bracket as any;
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
  if (detectedInterests.length === 0) {
    detectedInterests.push('Tech & AI', 'Policy & Governance');
  }

  return {
    estimatedAgeBracket,
    inferredLocation,
    detectedLanguage,
    interests: detectedInterests
  };
}
