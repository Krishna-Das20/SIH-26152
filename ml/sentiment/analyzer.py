"""
Sentiment Analyzer using a pretrained HuggingFace transformer.

Default model: ``cardiffnlp/twitter-roberta-base-sentiment-latest``
— a RoBERTa model fine-tuned on ~124 M tweets with 3-class output
(negative / neutral / positive).

Models are loaded **once** at startup and reused across all requests.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from transformers import AutoModelForSequenceClassification, AutoTokenizer, AutoConfig
import torch
import numpy as np

from config import SENTIMENT_MODEL, DEVICE, MAX_TEXT_LENGTH

logger = logging.getLogger(__name__)


@dataclass
class SentimentScore:
    label: str          # positive | negative | neutral
    positive: float
    negative: float
    neutral: float
    confidence: float


class SentimentAnalyzer:
    """Three-class sentiment classifier."""

    # Label mapping for cardiffnlp models
    _LABEL_MAP = {0: "negative", 1: "neutral", 2: "positive"}

    def __init__(self, model_name: str | None = None, device: str | None = None):
        self.model_name = model_name or SENTIMENT_MODEL
        self.device = device or DEVICE
        self._model = None
        self._tokenizer = None
        self._loaded = False

    # ── Lazy Loading ──────────────────────────────────────────────

    def load(self) -> None:
        """Load model and tokenizer.  Safe to call multiple times."""
        if self._loaded:
            return
        logger.info("Loading sentiment model: %s → %s", self.model_name, self.device)
        self._tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        self._model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
        self._model.to(self.device)
        self._model.eval()

        # Try to read id2label from model config for flexibility
        config = AutoConfig.from_pretrained(self.model_name)
        if hasattr(config, "id2label") and config.id2label:
            self._LABEL_MAP = {int(k): v.lower() for k, v in config.id2label.items()}

        self._loaded = True
        logger.info("Sentiment model loaded (%d labels).", len(self._LABEL_MAP))

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    # ── Inference ─────────────────────────────────────────────────

    def analyze(self, text: str) -> SentimentScore:
        """Analyze a single text and return sentiment scores."""
        results = self.analyze_batch([text])
        return results[0]

    @torch.no_grad()
    def analyze_batch(self, texts: list[str]) -> list[SentimentScore]:
        """Analyze a batch of texts.  Models must be loaded first."""
        self.load()

        # Filter out empty texts — produce neutral placeholders
        safe_texts = [t if t and t.strip() else "." for t in texts]

        encodings = self._tokenizer(
            safe_texts,
            padding=True,
            truncation=True,
            max_length=MAX_TEXT_LENGTH,
            return_tensors="pt",
        ).to(self.device)

        outputs = self._model(**encodings)
        probs = torch.softmax(outputs.logits, dim=-1).cpu().numpy()

        results: list[SentimentScore] = []
        for i, prob in enumerate(probs):
            # Build a score dict keyed by label name
            scores = {self._LABEL_MAP.get(j, f"label_{j}"): float(prob[j]) for j in range(len(prob))}

            pos = scores.get("positive", 0.0)
            neg = scores.get("negative", 0.0)
            neu = scores.get("neutral", 0.0)

            # Determine label
            label = max(scores, key=scores.get)  # type: ignore[arg-type]
            confidence = max(pos, neg, neu)

            # If the original text was empty, force neutral
            if not texts[i] or not texts[i].strip():
                label, pos, neg, neu, confidence = "neutral", 0.0, 0.0, 1.0, 1.0

            results.append(
                SentimentScore(
                    label=label,
                    positive=round(pos, 4),
                    negative=round(neg, 4),
                    neutral=round(neu, 4),
                    confidence=round(confidence, 4),
                )
            )

        return results
