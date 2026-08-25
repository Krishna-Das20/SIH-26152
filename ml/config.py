"""
Central configuration for the NLP Analysis Pipeline.

All model names, hyperparameters, device selection, and thresholds
are defined here so they can be changed without touching module code.
"""

import os
import torch
from dotenv import load_dotenv

load_dotenv()

# ── Device Selection ──────────────────────────────────────────────
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# ── Model Registry ────────────────────────────────────────────────
# Change model names here to swap models without editing module code.

SENTIMENT_MODEL = os.getenv(
    "SENTIMENT_MODEL",
    "cardiffnlp/twitter-roberta-base-sentiment-latest",
)

EMOTION_MODEL = os.getenv(
    "EMOTION_MODEL",
    "SamLowe/roberta-base-go_emotions",
)

# Sarcasm model selection, measured rather than assumed:
#
#   mrm8488/distilroberta-finetuned-sarcasm  -- DOES NOT EXIST on the Hub. The
#       original configuration 404'd on every load, so sarcasm detection
#       silently reported model_available=False for every request.
#   helinivan/{english,multilingual}-sarcasm-detector -- load fine, but are
#       trained on news headlines. On conversational text they output ~0.01 for
#       sarcastic and non-sarcastic alike; no discrimination.
#   jkhan447/sarcasm-detection-RoBerta-base-CR -- scored 0.999 sarcastic on the
#       plainly sincere "I am genuinely happy about this result". Unusable.
#   hallisky/sarcasm-classifier-gpt4-data -- SELECTED. Decisive on sarcastic
#       text (0.999+) with no false positives on the sincere probes, and it
#       ships a real id2label (sarcasm_less / sarcasm_more).
SARCASM_MODEL = os.getenv(
    "SARCASM_MODEL",
    "hallisky/sarcasm-classifier-gpt4-data",
)

TOXICITY_MODEL = os.getenv(
    "TOXICITY_MODEL",
    "unitary/toxic-bert",
)

EMBEDDING_MODEL = os.getenv(
    "EMBEDDING_MODEL",
    "all-MiniLM-L6-v2",
)

# ── Batch / Performance ──────────────────────────────────────────
MAX_BATCH_SIZE = int(os.getenv("MAX_BATCH_SIZE", "64"))
MAX_TEXT_LENGTH = int(os.getenv("MAX_TEXT_LENGTH", "512"))

# ── Thresholds ────────────────────────────────────────────────────
LANGUAGE_CONFIDENCE_THRESHOLD = float(
    os.getenv("LANGUAGE_CONFIDENCE_THRESHOLD", "0.70")
)
SARCASM_CONFIDENCE_THRESHOLD = float(
    os.getenv("SARCASM_CONFIDENCE_THRESHOLD", "0.50")
)
TOXICITY_THRESHOLD = float(os.getenv("TOXICITY_THRESHOLD", "0.50"))

# ── Topic Extraction ─────────────────────────────────────────────
MIN_TOPIC_SIZE = int(os.getenv("MIN_TOPIC_SIZE", "3"))
TOP_N_KEYWORDS = int(os.getenv("TOP_N_KEYWORDS", "10"))

# ── Trend Detection ──────────────────────────────────────────────
TREND_WEIGHTS = {
    "frequency_growth": 0.40,
    "mention_velocity": 0.25,
    "engagement_growth": 0.20,
    "consistency": 0.15,
}

# ── API ───────────────────────────────────────────────────────────
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,https://sih-26152.vercel.app",
).split(",")

# ── Logging ───────────────────────────────────────────────────────
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
