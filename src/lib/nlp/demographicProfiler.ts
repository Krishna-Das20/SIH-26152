export interface DemographicInference {
  /** null when no age signal was found. Render as "Unknown", never guess. */
  estimatedAgeBracket: '<18' | '18-24' | '25-34' | '35-50' | '50+' | null;
  /** null when no location entity was found in the text or profile. */
  inferredLocation: string | null;
  /** null when the text is too short or ambiguous to classify. */
  detectedLanguage: string | null;
  interests: string[];
}

const REGION_PATTERNS: { name: string; patterns: RegExp[] }[] = [
  // Metro India
  { name: 'Delhi NCR', patterns: [/\b(delhi|new delhi|ncr|noida|gurgaon|gurugram|faridabad|ghaziabad)\b/i] },
  { name: 'Mumbai, Maharashtra', patterns: [/\b(mumbai|bombay|navi mumbai|thane|pune|nagpur|maharashtra)\b/i] },
  { name: 'Bengaluru, Karnataka', patterns: [/\b(bengaluru|bangalore|karnataka|mysuru|mysore)\b/i] },
  { name: 'Hyderabad, Telangana', patterns: [/\b(hyderabad|telangana|secunderabad|warangal)\b/i] },
  { name: 'Chennai, Tamil Nadu', patterns: [/\b(chennai|madras|tamil nadu|coimbatore|madurai)\b/i] },
  { name: 'Kolkata, West Bengal', patterns: [/\b(kolkata|calcutta|west bengal|bengal|howrah|darjeeling)\b/i] },
  { name: 'Bhubaneswar, Odisha', patterns: [/\b(bhubaneswar|bbsr|cuttack|odisha|orissa|puri|rourkela)\b/i] },
  { name: 'Ahmedabad, Gujarat', patterns: [/\b(ahmedabad|gujarat|surat|vadodara|rajkot|gandhinagar)\b/i] },
  { name: 'Jaipur, Rajasthan', patterns: [/\b(jaipur|rajasthan|jodhpur|udaipur|kota)\b/i] },
  { name: 'Lucknow, Uttar Pradesh', patterns: [/\b(lucknow|uttar pradesh|kanpur|varanasi|kashi|agra|prayagraj|allahabad)\b/i] },
  { name: 'Chandigarh / Punjab', patterns: [/\b(chandigarh|punjab|amritsar|ludhiana|jalandhar|mohali)\b/i] },
  { name: 'Kerala', patterns: [/\b(kerala|kochi|cochin|thiruvananthapuram|trivandrum|kozhikode|calicut)\b/i] },
  { name: 'Indore, Madhya Pradesh', patterns: [/\b(indore|madhya pradesh|bhopal|gwalior|jabalpur)\b/i] },
  { name: 'Bihar / Jharkhand', patterns: [/\b(patna|bihar|ranchi|jharkhand|jamshedpur)\b/i] },
  { name: 'Assam / Northeast', patterns: [/\b(assam|guwahati|shillong|manipur|tripura|meghalaya)\b/i] },
  { name: 'Goa', patterns: [/\b(goa|panaji)\b/i] },

  // Global Hubs
  { name: 'San Francisco, USA', patterns: [/\b(san francisco|sf bay|silicon valley|california|los angeles|seattle)\b/i] },
  { name: 'New York, USA', patterns: [/\b(new york|nyc|manhattan|brooklyn|new jersey)\b/i] },
  { name: 'United States', patterns: [/\b(usa|united states|texas|florida|chicago|washington|boston)\b/i] },
  { name: 'London, UK', patterns: [/\b(london|uk|united kingdom|britain|england|manchester)\b/i] },
  { name: 'Toronto, Canada', patterns: [/\b(toronto|canada|ontario|vancouver|montreal)\b/i] },
  { name: 'Berlin, Germany', patterns: [/\b(berlin|germany|munich|frankfurt|deutschland)\b/i] },
  { name: 'Singapore', patterns: [/\b(singapore|sg)\b/i] },
  { name: 'Sydney, Australia', patterns: [/\b(sydney|australia|melbourne|brisbane)\b/i] },
  { name: 'Dubai, UAE', patterns: [/\b(dubai|uae|abu dhabi|emirates)\b/i] },
  { name: 'Tokyo, Japan', patterns: [/\b(tokyo|japan|osaka|kyoto)\b/i] },
];

const AGE_PATTERNS: { bracket: '<18' | '18-24' | '25-34' | '35-50' | '50+'; patterns: RegExp[] }[] = [
  {
    bracket: '<18',
    patterns: [
      /\b(skibidi|rizz|gyatt|no cap|fr fr|bruh|ong|slay|deadass|bussin|sigma)\b/i,
      /\b(class 10|class 12|cbse|icse|board exam|school homework|high school|homework)\b/i,
    ],
  },
  {
    bracket: '18-24',
    patterns: [
      /\b(lmao|lowkey|highkey|tbh|idk|vibes|era|lit|stan|fomo|grindset|clout|reels|party|hangout)\b/i,
      /\b(college|campus|university|hostel|semester|btech|undergrad|fresher|internship|placement)\b/i,
    ],
  },
  {
    bracket: '25-34',
    patterns: [
      /\b(deployed|roi|production|sprint|crypto|mortgage|stack|investing|career|burnout|framework)\b/i,
      /\b(office|job|manager|salary|hike|appraisal|tech lead|senior engineer|wedding|rent|startup|emi|taxes|wfh)\b/i,
    ],
  },
  {
    bracket: '35-50',
    patterns: [
      /\b(policy|leadership|management|governance|economy|enterprise|quarterly|infrastructure|family)\b/i,
      /\b(executive|director|vp|children|kids|school fees|parenting|property|retirement planning)\b/i,
    ],
  },
  {
    bracket: '50+',
    patterns: [
      /\b(god bless|blessings|back in my day|values|tradition|national interest|citizens|heritage)\b/i,
      /\b(retirement|pensioner|senior citizen|elderly|grandson|granddaughter|devotion|scriptures)\b/i,
    ],
  },
];

const INTEREST_PATTERNS: { topic: string; keywords: RegExp[] }[] = [
  {
    topic: 'Tech & AI',
    keywords: [
      /\b(ai|ml|software|cloud|data|coding|llm|cyber|quantum|algorithm|developer|python|javascript|react|nextjs|devvit|api|tech|computer|programming|robot|deep learning|neural)\b/i,
    ],
  },
  {
    topic: 'Geopolitics & Defense',
    keywords: [
      /\b(defense|military|treaty|border|security|geopolitics|sanctions|diplomacy|army|navy|air force|missile|nato|war|international relations|intelligence|sovereignty)\b/i,
    ],
  },
  {
    topic: 'Finance & Economy',
    keywords: [
      /\b(stocks|markets|inflation|gdp|crypto|startup|venture|banking|funding|sensex|nifty|bse|nse|rbi|investment|trading|portfolio|mutual fund|economy|fintech|shares|dividend)\b/i,
    ],
  },
  {
    topic: 'Policy & Governance',
    keywords: [
      /\b(government|law|supreme court|parliament|reform|citizen|election|minister|policy|bill|constitution|public sector|lok sabha|democracy|governance|regulation|judiciary)\b/i,
    ],
  },
  {
    topic: 'Entertainment & Sports',
    keywords: [
      /\b(cricket|cinema|bollywood|hollywood|streaming|gaming|tournament|music|album|movie|netflix|match|ipl|fifa|series|actor|singer|trailer|box office|game)\b/i,
    ],
  },
  {
    topic: 'Health & Lifestyle',
    keywords: [
      /\b(gym|fitness|health|diet|workout|mental health|hospital|doctor|medicine|yoga|wellness|nutrition|exercise|sleep)\b/i,
    ],
  },
  {
    topic: 'Science & Space',
    keywords: [
      /\b(nasa|isro|space|physics|astronomy|science|biology|nature|climate|ecology|planet|telescope|mars|moon|research)\b/i,
    ],
  },
];

/**
 * Demographic Profiler (Component C)
 * Extracts reliable demographic inferences from observed text and profile data.
 */
export function inferDemographics(
  bio: string = '',
  postsText: string = '',
  locationHint?: string
): DemographicInference {
  const combined = `${bio} ${postsText}`.trim();
  const lower = combined.toLowerCase();

  // 1. Inferred Location
  let inferredLocation: string | null = locationHint || null;
  if (!inferredLocation) {
    for (const reg of REGION_PATTERNS) {
      for (const pat of reg.patterns) {
        if (pat.test(lower)) {
          inferredLocation = reg.name;
          break;
        }
      }
      if (inferredLocation) break;
    }
  }

  // 2. Language Detection
  let detectedLanguage: string | null = null;
  if (/[\u0900-\u097F]/.test(combined)) {
    detectedLanguage = 'Hindi (Devanagari)';
  } else if (/[\u0980-\u09FF]/.test(combined)) {
    detectedLanguage = 'Bengali';
  } else if (/[\u0B80-\u0BFF]/.test(combined)) {
    detectedLanguage = 'Tamil';
  } else if (/[\u0C00-\u0C7F]/.test(combined)) {
    detectedLanguage = 'Telugu';
  } else if (/[\u0A80-\u0AFF]/.test(combined)) {
    detectedLanguage = 'Gujarati';
  } else if (/[\u0C80-\u0CFF]/.test(combined)) {
    detectedLanguage = 'Kannada';
  } else if (/[\u0D00-\u0D7F]/.test(combined)) {
    detectedLanguage = 'Malayalam';
  } else if (/\b(bhai|kya|kyun|yaar|nahi|hain|accha|sahi|matlab|dekho|sab|desh|namaste|shukriya|gyms|karega|kya|hai|wala)\b/i.test(lower)) {
    detectedLanguage = 'Hinglish (Code-Mixed)';
  } else if (lower.split(/\s+/).length >= 3) {
    detectedLanguage = 'English';
  }

  // 3. Age Bracket Inference
  const ageScores: Record<string, number> = {
    '<18': 0, '18-24': 0, '25-34': 0, '35-50': 0, '50+': 0,
  };
  let ageEvidence = 0;

  for (const ageGroup of AGE_PATTERNS) {
    for (const pat of ageGroup.patterns) {
      if (pat.test(lower)) {
        ageScores[ageGroup.bracket] += 1;
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

  // 4. Inferred Interests
  const detectedInterests: string[] = [];
  for (const item of INTEREST_PATTERNS) {
    for (const kw of item.keywords) {
      if (kw.test(lower)) {
        detectedInterests.push(item.topic);
        break;
      }
    }
  }

  return {
    estimatedAgeBracket,
    inferredLocation,
    detectedLanguage,
    interests: detectedInterests,
  };
}
