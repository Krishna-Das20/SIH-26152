import { EmotionType, SentimentAnalysis, StanceType } from '@/types/intelligence';
import trainedModel from '../models/trained_skynet_nlp.json';

// ── Trained Weights & Lexicons ─────────────────────────────────────────────
const TRAINED_WEIGHTS: Record<string, number> = trainedModel?.sentiment_weights || {};
const IDF_WEIGHTS: Record<string, number> = trainedModel?.top_idf_weights || {};

// Negation triggers with 3-token forward window
const NEGATION_WORDS = new Set([
  'not', 'never', 'no', 'without', 'hardly', 'scarcely', 'barely', 'cannot', 'cant',
  "can't", "don't", 'dont', "doesn't", 'doesnt', "didn't", 'didnt', "won't", 'wont',
  "wouldn't", 'wouldnt', "shouldn't", 'shouldnt', "couldn't", 'couldnt', "isn't", 'isnt',
  "aren't", 'arent', "wasn't", 'wasnt', "weren't", 'werent', 'neither', 'nor', 'none'
]);

// Intensifiers & Dampeners
const BOOSTERS = new Set([
  'very', 'extremely', 'insanely', 'massively', 'deeply', 'critical', 'super',
  'totally', 'absolutely', 'unreal', 'huge', 'vital', 'historic', 'highly',
  'overwhelmingly', 'immensely', 'exceptionally', 'incredibly'
]);

const DAMPENERS = new Set([
  'slightly', 'somewhat', 'barely', 'a bit', 'marginally', 'partially',
  'scarcely', 'hardly', 'mildly', 'kind of', 'sort of'
]);

// Adversarial Sarcasm & Irony Patterns
const SARCASM_MARKERS: RegExp[] = [
  /oh (great|wonderful|fantastic|brilliant|genius|lovely|perfect)\b/i,
  /yeah right\b/i,
  /sure thing\b/i,
  /what a surprise\b/i,
  /as if\b/i,
  /totally not\b/i,
  /thanks a lot for nothing\b/i,
  /slow claps?\b/i,
  /wow just wow\b/i,
  /best idea ever\b/i,
  /clown show\b/i,
  /masterclass in (failure|incompetence|disaster)\b/i,
  /love how (they|it|we)\b/i,
  /pure comedy\b/i,
  /what could possibly go wrong\b/i,
  /ironic/i,
  /🙄|😏|😒|👏|🙃|🤡|💀|🤦/
];

// Nuanced Emotion Lexicons with Domain Salience
const EMOTION_PATTERNS: Record<EmotionType, { positiveWords: string[]; regexes: RegExp[] }> = {
  excitement: {
    positiveWords: [
      'revolutionary', 'breakthrough', 'insane', 'hyped', 'amazing', 'huge', 'unreal',
      'historic', 'thrilled', 'game-changing', 'banger', 'explosive', 'spectacular',
      'leveled up', 'next-gen', 'exponential', 'masterpiece', 'paradigms', 'supercharged',
      'benchmark', 'monumental', 'dominating', 'breakthroughs'
    ],
    regexes: [/can'?t wait/i, /let'?s go+/i, /mind[- ]blown/i, /game changer/i, /🚀|🔥|⚡|🎉|💯|🤩|📈/]
  },
  anxiety: {
    positiveWords: [
      'worried', 'concerned', 'crisis', 'threat', 'collapse', 'danger', 'panic',
      'nervous', 'uncertain', 'vulnerable', 'risk', 'warning', 'breach', 'scared',
      'unstable', 'vulnerability', 'shaky', 'bubble', 'catastrophic', 'critical',
      'precarious', 'backdoor', 'compromised', 'fragile', 'turbulence'
    ],
    regexes: [/what if/i, /afraid of/i, /losing control/i, /is this safe/i, /red flag/i, /😨|😰|⚠️|🚨|😟|📉/]
  },
  anger: {
    positiveWords: [
      'outrage', 'furious', 'scam', 'corrupt', 'pathetic', 'disaster', 'boycott',
      'fraud', 'shameful', 'liars', 'horrible', 'trash', 'idiotic', 'unacceptable',
      'criminal', 'disgrace', 'exploit', 'clowns', 'rigged', 'stealing', 'predatory',
      'greed', 'backlash', 'lawsuit', 'subpoena', 'negligence'
    ],
    regexes: [/shut down/i, /held accountable/i, /sick and tired/i, /fed up/i, /🤬|😡|😤|❌|👎|🖕/]
  },
  joy: {
    positiveWords: [
      'proud', 'happy', 'grateful', 'blessed', 'congrats', 'celebrating', 'win',
      'love', 'wholesome', 'support', 'peaceful', 'beautiful', 'delighted', 'triumph',
      'flawless', 'victory', 'adored', 'admirable', 'cherished', 'honor'
    ],
    regexes: [/proud of/i, /so happy/i, /well deserved/i, /shout out/i, /❤️|🙌|✨|😊|🥳|💖/]
  },
  fear: {
    positiveWords: [
      'terror', 'catastrophe', 'dread', 'nightmare', 'deadly', 'horrifying', 'paralyzed',
      'threatened', 'invasion', 'doomsday', 'annihilation', 'lethal', 'weaponized',
      'apocalyptic', 'cyberattack', 'blackout', 'fatal', 'destructive'
    ],
    regexes: [/stay safe/i, /fear for/i, /worst case/i, /life or death/i, /😱|☠️|☣️|🧟/]
  },
  sadness: {
    positiveWords: [
      'tragic', 'heartbroken', 'devastating', 'loss', 'grief', 'regret', 'mourn',
      'depressing', 'unfortunate', 'disappointed', 'failed', 'hopeless', 'sorrow',
      'heartbreaking', 'defeat', 'lost', 'abandoned', 'demolished'
    ],
    regexes: [/rip\b/i, /miss them/i, /so sad/i, /heart goes out/i, /gonna cry/i, /💔|😢|😭|🥀/]
  },
  supportive: {
    positiveWords: [
      'support', 'agree', 'endorse', 'backed', 'solidarity', 'standing with',
      'bravo', 'commendable', 'fully backing', 'aligned', 'approved', 'championing',
      'legit', 'verified', 'advocating', 'sponsor', 'trustworthy', 'reliable'
    ],
    regexes: [/i support/i, /well done/i, /standing with/i, /in favor of/i, /100% agree/i, /👍|💪|🤝|🛡️/]
  },
  against: {
    positiveWords: [
      'against', 'oppose', 'reject', 'condemn', 'cancel', 'resist', 'counter',
      'denounce', 'defund', 'disprove', 'protest', 'banned', 'veto', 'refuse',
      'boycotting', 'opponents', 'criticized', 'repel'
    ],
    regexes: [/i oppose/i, /down with/i, /stand against/i, /say no to/i, /stop the/i, /🚫|⛔|🛑/]
  },
  neutral: {
    positiveWords: [
      'report', 'update', 'announced', 'stated', 'according', 'analysis', 'data',
      'metrics', 'official', 'confirmed', 'documentation', 'release', 'timeline',
      'specification', 'benchmark', 'summary', 'published', 'noted'
    ],
    regexes: [/press release/i, /as per/i, /sources say/i, /official statement/i]
  }
};

/**
 * SKYNET Neural OSINT Sentiment, Sarcasm & Affective Inference Engine
 * Incorporates trained machine learning weights from 10,096 corpus.
 */
export function analyzeSentimentAndEmotion(text: string): SentimentAnalysis {
  if (!text || text.trim().length === 0) {
    return {
      score: 0,
      label: 'neutral',
      nuancedEmotion: 'neutral',
      sarcasmScore: 0,
      stance: 'neutral',
      confidence: 0.2,
      keywords: [],
      engine: 'ml'
    };
  }

  const rawText = text;
  const cleanText = text.toLowerCase();
  const tokens = cleanText.split(/\s+/).map((w) => w.replace(/[^a-z0-9#@_-]/g, '')).filter(Boolean);

  // ── 1. ADVERSARIAL SARCASM & SUBVERSION DETECTION ────────────────────────
  let sarcasmScore = 0.05;
  for (const pattern of SARCASM_MARKERS) {
    if (pattern.test(rawText)) {
      sarcasmScore += 0.32;
    }
  }

  // Quotation marks irony check e.g. "expert" advice, "secure" system
  if (/["'][a-zA-Z\s]{3,20}["']/.test(rawText) && /(fail|disaster|joke|scam|broken)/i.test(rawText)) {
    sarcasmScore += 0.30;
  }

  // Hyperbolic punctuation e.g. "Really?!?!?" or "Great idea...."
  if (/[!?]{2,}/.test(rawText) || /\.{3,}/.test(rawText)) {
    sarcasmScore += 0.12;
  }

  sarcasmScore = Math.min(Math.max(sarcasmScore, 0.02), 0.98);

  // ── 2. VALENCE & EMOTION SCORING WITH NEGATION SCOPE ─────────────────────
  const emotionScores: Record<EmotionType, number> = {
    excitement: 0,
    anxiety: 0,
    anger: 0,
    joy: 0,
    fear: 0,
    sadness: 0,
    supportive: 0,
    against: 0,
    neutral: 0.1
  };

  let netValenceSum = 0;
  let valenceWeightCount = 0;

  // Sliding window with negation & booster tracking
  let negationWindow = 0;
  let activeMultiplier = 1.0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Check for contrastive conjunctions e.g. "but", "however" -> reset and boost second clause
    if (['but', 'however', 'although', 'yet', 'nevertheless'].includes(token)) {
      activeMultiplier = 1.8;
      negationWindow = 0;
      continue;
    }

    // Check for negation trigger
    if (NEGATION_WORDS.has(token)) {
      negationWindow = 3;
      continue;
    }

    // Check for booster / dampener
    if (BOOSTERS.has(token)) {
      activeMultiplier = 1.6;
      continue;
    }
    if (DAMPENERS.has(token)) {
      activeMultiplier = 0.6;
      continue;
    }

    const isNegated = negationWindow > 0;
    if (negationWindow > 0) negationWindow--;

    // 2a. Check Trained Model Lexicon Weights
    if (token in TRAINED_WEIGHTS) {
      let weight = TRAINED_WEIGHTS[token] * activeMultiplier;
      if (isNegated) weight = -weight * 0.85;

      netValenceSum += weight;
      valenceWeightCount++;

      if (weight > 0.3) {
        emotionScores.joy += weight * 0.8;
        emotionScores.supportive += weight * 0.9;
      } else if (weight < -0.3) {
        emotionScores.anger += Math.abs(weight) * 0.8;
        emotionScores.against += Math.abs(weight) * 0.9;
      }
    }

    // 2b. Check Emotion Patterns
    for (const [emotion, patterns] of Object.entries(EMOTION_PATTERNS) as [EmotionType, { positiveWords: string[]; regexes: RegExp[] }][]) {
      if (patterns.positiveWords.includes(token)) {
        let delta = 1.6 * activeMultiplier;
        if (isNegated) {
          // Invert: e.g. "not happy" -> sadness/anger; "not worried" -> relief/neutral
          if (emotion === 'joy' || emotion === 'excitement' || emotion === 'supportive') {
            emotionScores.sadness += delta * 0.7;
            emotionScores.against += delta * 0.7;
          } else {
            emotionScores.neutral += delta * 0.5;
          }
        } else {
          emotionScores[emotion] += delta;
        }
      }
    }

    // Reset multiplier decay
    activeMultiplier = Math.max(1.0, activeMultiplier * 0.85);
  }

  // Regex pattern matching over raw text
  for (const [emotion, patterns] of Object.entries(EMOTION_PATTERNS) as [EmotionType, { positiveWords: string[]; regexes: RegExp[] }][]) {
    for (const regex of patterns.regexes) {
      if (regex.test(rawText)) {
        emotionScores[emotion] += 2.2;
      }
    }
  }

  // Sarcasm Modulation: If sarcasm is high, flip joy/excitement into anger/against
  if (sarcasmScore > 0.55) {
    const invertedJoy = emotionScores.joy;
    emotionScores.anger += invertedJoy * 1.5 + sarcasmScore * 2.0;
    emotionScores.against += emotionScores.supportive * 1.2;
    emotionScores.joy = Math.max(0, emotionScores.joy - invertedJoy * 0.8);
    emotionScores.supportive = Math.max(0, emotionScores.supportive - 1.0);
    netValenceSum -= sarcasmScore * 3.0;
  }

  // Find dominant emotion
  let dominantEmotion: EmotionType = 'neutral';
  let maxEmotionScore = -1;
  for (const [emotion, score] of Object.entries(emotionScores) as [EmotionType, number][]) {
    if (score > maxEmotionScore) {
      maxEmotionScore = score;
      dominantEmotion = emotion;
    }
  }

  // ── 3. COMPOSITE POLARITY (-1.0 to +1.0) ──────────────────────────────────
  const positiveMass = emotionScores.joy + emotionScores.excitement + emotionScores.supportive;
  const negativeMass = emotionScores.anger + emotionScores.anxiety + emotionScores.fear + emotionScores.sadness + emotionScores.against + (sarcasmScore * 1.8);
  
  let score = 0;
  if (positiveMass + negativeMass > 0) {
    const rawRatio = (positiveMass - negativeMass) / (positiveMass + negativeMass);
    const trainedMod = valenceWeightCount > 0 ? netValenceSum / (valenceWeightCount * 2) : 0;
    score = (rawRatio * 0.65) + (trainedMod * 0.35);
  }
  score = Number(Math.min(Math.max(score, -1.0), 1.0).toFixed(2));

  // ── 4. STANCE INFERENCE (SUPPORTIVE vs OPPOSING vs NEUTRAL) ───────────────
  let stance: StanceType = 'neutral';
  if (emotionScores.supportive > emotionScores.against + 0.5) {
    stance = 'supportive';
  } else if (emotionScores.against > emotionScores.supportive + 0.5) {
    stance = 'opposing';
  } else if (score > 0.22) {
    stance = 'supportive';
  } else if (score < -0.22) {
    stance = 'opposing';
  }

  // ── 5. TF-IDF KEYWORD EXTRACTION ──────────────────────────────────────────
  const keywords = tokens
    .filter((w) => w.length >= 3 && !['this', 'that', 'with', 'from', 'have', 'were', 'what', 'your', 'about', 'they', 'will'].includes(w))
    .sort((a, b) => (IDF_WEIGHTS[b] || 1.0) - (IDF_WEIGHTS[a] || 1.0))
    .slice(0, 5);

  const confidence = computeConfidence(emotionScores, dominantEmotion, maxEmotionScore, valenceWeightCount);

  return {
    score,
    label: score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral',
    nuancedEmotion: dominantEmotion,
    sarcasmScore: Number(sarcasmScore.toFixed(2)),
    stance,
    confidence,
    keywords,
    engine: 'ml'
  };
}

function computeConfidence(
  scores: Record<EmotionType, number>,
  winner: EmotionType,
  winnerScore: number,
  trainedHits: number
): number {
  const values = Object.entries(scores)
    .filter(([emotion]) => emotion !== winner)
    .map(([, value]) => value);

  const runnerUp = values.length > 0 ? Math.max(...values) : 0;
  const total = Object.values(scores).reduce((a, b) => a + b, 0);

  if (total <= 0.15 && trainedHits === 0) return 0.25;

  const margin = winnerScore > 0 ? (winnerScore - runnerUp) / winnerScore : 0;
  const evidenceSaturation = Math.min((total + trainedHits) / 8, 1.0);

  const conf = 0.35 + 0.35 * margin + 0.30 * evidenceSaturation;
  return Number(Math.min(Math.max(conf, 0.2), 0.98).toFixed(2));
}
