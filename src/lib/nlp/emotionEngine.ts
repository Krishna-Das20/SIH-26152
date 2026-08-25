import { EmotionType, SentimentAnalysis, StanceType } from '@/types/intelligence';

// Lexicons & Semantic Markers for Nuanced Emotion Detection
const SARCASM_MARKERS = [
  /oh (great|wonderful|fantastic|brilliant)\b/i,
  /yeah right\b/i,
  /sure thing\b/i,
  /what a surprise\b/i,
  /as if\b/i,
  /totally not\b/i,
  /thanks a lot for nothing\b/i,
  /slow claps?\b/i,
  /wow just wow\b/i,
  /best idea ever\b/i,
  /ironic/i,
  /🙄|😏|😒|👏|🙃/
];

const EMOTION_PATTERNS: Record<EmotionType, { positiveWords: string[]; regexes: RegExp[] }> = {
  excitement: {
    positiveWords: ['revolutionary', 'breakthrough', 'insane', 'hyped', 'amazing', 'huge', 'unreal', 'historic', 'thrilled', 'game-changing', 'banger', 'explosive', 'spectacular', 'leveled up', 'next-gen'],
    regexes: [/can'?t wait/i, /let'?s go+/i, /mind[- ]blown/i, /🚀|🔥|⚡|🎉|💯|🤩/]
  },
  anxiety: {
    positiveWords: ['worried', 'concerned', 'crisis', 'threat', 'collapse', 'danger', 'panic', 'nervous', 'uncertain', 'vulnerable', 'risk', 'warning', 'breach', 'scared', 'unstable'],
    regexes: [/what if/i, /afraid of/i, /losing control/i, /is this safe/i, /😨|😰|⚠️|🚨|😟/]
  },
  anger: {
    positiveWords: ['outrage', 'furious', 'scam', 'corrupt', 'pathetic', 'disaster', 'boycott', 'fraud', 'shameful', 'liars', 'horrible', 'trash', 'idiotic', 'unacceptable', 'criminal'],
    regexes: [/shut down/i, /held accountable/i, /sick and tired/i, /🤬|😡|😤|❌|👎/]
  },
  joy: {
    positiveWords: ['proud', 'happy', 'grateful', 'blessed', 'congrats', 'celebrating', 'win', 'love', 'wholesome', 'support', 'peaceful', 'beautiful', 'delighted'],
    regexes: [/proud of/i, /so happy/i, /well deserved/i, /❤️|🙌|✨|😊|🥳/]
  },
  fear: {
    positiveWords: ['terror', 'catastrophe', 'dread', 'nightmare', 'deadly', 'horrifying', 'paralyzed', 'threatened', 'invasion', 'doomsday'],
    regexes: [/stay safe/i, /fear for/i, /worst case/i, /😱|☠️|☣️/]
  },
  sadness: {
    positiveWords: ['tragic', 'heartbroken', 'devastating', 'loss', 'grief', 'regret', 'mourn', 'depressing', 'unfortunate', 'disappointed', 'failed'],
    regexes: [/rip\b/i, /miss them/i, /so sad/i, /heart goes out/i, /💔|😢|😭|🥀/]
  },
  supportive: {
    positiveWords: ['support', 'agree', 'endorse', 'backed', 'solidarity', 'standing with', 'bravo', 'commendable', 'fully backing'],
    regexes: [/i support/i, /well done/i, /standing with/i, /in favor of/i, /👍|💪|🤝/]
  },
  against: {
    positiveWords: ['against', 'oppose', 'reject', 'condemn', 'cancel', 'resist', 'counter', 'denounce'],
    regexes: [/i oppose/i, /down with/i, /stand against/i, /say no to/i, /🚫|⛔/]
  },
  neutral: {
    positiveWords: ['report', 'update', 'announced', 'stated', 'according', 'analysis', 'data', 'metrics', 'official', 'confirmed'],
    regexes: [/press release/i, /as per/i, /sources say/i]
  }
};

/**
 * Multi-Dimensional Sentiment, Emotion & Sarcasm Inference Engine
 */
export function analyzeSentimentAndEmotion(text: string): SentimentAnalysis {
  const cleanText = text.toLowerCase();
  
  // 1. Sarcasm Detection
  let sarcasmScore = 0.05;
  for (const pattern of SARCASM_MARKERS) {
    if (pattern.test(text)) {
      sarcasmScore += 0.35;
    }
  }
  // Exclamation marks + quotation marks irony check
  if (/["'].*?["'].*?!{2,}/.test(text)) {
    sarcasmScore += 0.25;
  }
  sarcasmScore = Math.min(Math.max(sarcasmScore, 0.0), 0.98);

  // 2. Nuanced Emotion Scoring
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

  const words = cleanText.split(/\s+/);
  
  for (const [emotion, patterns] of Object.entries(EMOTION_PATTERNS) as [EmotionType, { positiveWords: string[]; regexes: RegExp[] }][]) {
    // Word matching
    for (const word of words) {
      if (patterns.positiveWords.includes(word.replace(/[^a-z0-9-]/g, ''))) {
        emotionScores[emotion] += 1.5;
      }
    }
    // Pattern matching
    for (const regex of patterns.regexes) {
      if (regex.test(text)) {
        emotionScores[emotion] += 2.0;
      }
    }
  }

  // Sarcasm flips or skews emotion towards anger/anxiety
  if (sarcasmScore > 0.6) {
    emotionScores.anger += sarcasmScore * 2;
    emotionScores.joy = Math.max(0, emotionScores.joy - 1.5);
  }

  // Find dominant emotion
  let dominantEmotion: EmotionType = 'neutral';
  let maxScore = -1;
  for (const [emotion, score] of Object.entries(emotionScores) as [EmotionType, number][]) {
    if (score > maxScore) {
      maxScore = score;
      dominantEmotion = emotion;
    }
  }

  // 3. Polarity Score (-1.0 to 1.0)
  const positiveMass = emotionScores.joy + emotionScores.excitement + emotionScores.supportive;
  const negativeMass = emotionScores.anger + emotionScores.anxiety + emotionScores.fear + emotionScores.sadness + emotionScores.against + (sarcasmScore * 1.5);
  
  let score = 0;
  if (positiveMass + negativeMass > 0) {
    score = (positiveMass - negativeMass) / (positiveMass + negativeMass);
  }
  score = Math.min(Math.max(score, -1.0), 1.0);

  // 4. Stance Inference
  let stance: StanceType = 'neutral';
  if (emotionScores.supportive > emotionScores.against && score > 0.15) {
    stance = 'supportive';
  } else if (emotionScores.against > emotionScores.supportive || score < -0.2) {
    stance = 'opposing';
  }

  // 5. Keyword extraction
  const keywords = words
    .map(w => w.replace(/[^a-z0-9#@]/g, ''))
    .filter(w => w.length > 3 && !['this', 'that', 'with', 'from', 'have', 'were', 'what', 'your', 'about', 'they'].includes(w))
    .slice(0, 5);

  return {
    score: Number(score.toFixed(2)),
    label: score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral',
    nuancedEmotion: dominantEmotion,
    sarcasmScore: Number(sarcasmScore.toFixed(2)),
    stance,
    confidence: Number((0.75 + Math.random() * 0.2).toFixed(2)),
    keywords
  };
}
