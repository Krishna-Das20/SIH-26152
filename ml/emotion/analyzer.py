"""
Emotion Analyzer using a pretrained GoEmotions transformer.

Default model: ``SamLowe/roberta-base-go_emotions``
— 28 emotion labels from the Google GoEmotions dataset, mapped to
the 6 core emotions (joy, sadness, anger, fear, surprise, disgust)
plus extended emotions (excitement, love, optimism, curiosity).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from transformers import AutoModelForSequenceClassification, AutoTokenizer, AutoConfig
import torch
import numpy as np

from config import EMOTION_MODEL, DEVICE, MAX_TEXT_LENGTH

logger = logging.getLogger(__name__)

# GoEmotions → our schema mapping
# The model outputs 28 labels; we aggregate them into our target set.
_EMOTION_AGGREGATION: dict[str, list[str]] = {
    "joy":        ["joy", "amusement", "gratitude", "pride", "relief"],
    "sadness":    ["sadness", "grief", "disappointment", "remorse"],
    "anger":      ["anger", "annoyance", "disapproval"],
    "fear":       ["fear", "nervousness"],
    "surprise":   ["surprise", "realization", "confusion"],
    "disgust":    ["disgust"],
    "excitement": ["excitement", "desire", "admiration"],
    "love":       ["love", "caring"],
    "optimism":   ["optimism", "approval"],
    "curiosity":  ["curiosity"],
}


@dataclass
class EmotionScore:
    joy: float = 0.0
    sadness: float = 0.0
    anger: float = 0.0
    fear: float = 0.0
    surprise: float = 0.0
    disgust: float = 0.0
    excitement: float = 0.0
    love: float = 0.0
    optimism: float = 0.0
    curiosity: float = 0.0
    dominant_emotion: str = "neutral"


class EmotionAnalyzer:
    """Multi-label emotion classifier."""

    def __init__(self, model_name: str | None = None, device: str | None = None):
        self.model_name = model_name or EMOTION_MODEL
        self.device = device or DEVICE
        self._model = None
        self._tokenizer = None
        self._id2label: dict[int, str] = {}
        self._loaded = False

    def load(self) -> None:
        if self._loaded:
            return
        logger.info("Loading emotion model: %s → %s", self.model_name, self.device)
        self._tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        self._model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
        self._model.to(self.device)
        self._model.eval()

        config = AutoConfig.from_pretrained(self.model_name)
        if hasattr(config, "id2label") and config.id2label:
            self._id2label = {int(k): v.lower() for k, v in config.id2label.items()}
        else:
            # Fallback — generate generic labels
            n = self._model.config.num_labels
            self._id2label = {i: f"emotion_{i}" for i in range(n)}

        self._loaded = True
        logger.info(
            "Emotion model loaded (%d labels: %s).",
            len(self._id2label),
            ", ".join(list(self._id2label.values())[:6]) + "…",
        )

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def analyze(self, text: str) -> EmotionScore:
        return self.analyze_batch([text])[0]

    @torch.no_grad()
    def analyze_batch(self, texts: list[str]) -> list[EmotionScore]:
        self.load()

        safe_texts = [t if t and t.strip() else "." for t in texts]

        encodings = self._tokenizer(
            safe_texts,
            padding=True,
            truncation=True,
            max_length=MAX_TEXT_LENGTH,
            return_tensors="pt",
        ).to(self.device)

        outputs = self._model(**encodings)
        # GoEmotions is multi-label → sigmoid, not softmax
        probs = torch.sigmoid(outputs.logits).cpu().numpy()

        results: list[EmotionScore] = []
        for idx, prob in enumerate(probs):
            # Build raw label scores
            raw: dict[str, float] = {}
            for j, score in enumerate(prob):
                label = self._id2label.get(j, f"label_{j}")
                raw[label] = float(score)

            # Aggregate into our target emotions
            aggregated = self._aggregate(raw)

            # Handle empty input
            if not texts[idx] or not texts[idx].strip():
                results.append(EmotionScore(dominant_emotion="neutral"))
                continue

            results.append(aggregated)

        return results

    # ── Private ───────────────────────────────────────────────────

    def _aggregate(self, raw: dict[str, float]) -> EmotionScore:
        """Map 28 GoEmotions labels → our 10-emotion schema."""
        agg: dict[str, float] = {}
        for target_emotion, source_labels in _EMOTION_AGGREGATION.items():
            values = [raw.get(lbl, 0.0) for lbl in source_labels]
            agg[target_emotion] = round(max(values) if values else 0.0, 4)

        # Determine dominant
        if not agg or all(v < 0.05 for v in agg.values()):
            dominant = "neutral"
        else:
            dominant = max(agg, key=agg.get)  # type: ignore[arg-type]

        return EmotionScore(
            joy=agg.get("joy", 0.0),
            sadness=agg.get("sadness", 0.0),
            anger=agg.get("anger", 0.0),
            fear=agg.get("fear", 0.0),
            surprise=agg.get("surprise", 0.0),
            disgust=agg.get("disgust", 0.0),
            excitement=agg.get("excitement", 0.0),
            love=agg.get("love", 0.0),
            optimism=agg.get("optimism", 0.0),
            curiosity=agg.get("curiosity", 0.0),
            dominant_emotion=dominant,
        )
