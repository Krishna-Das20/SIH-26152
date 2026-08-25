"""
Sarcasm Detector using a pretrained DistilRoBERTa model.

Default model: ``mrm8488/distilroberta-finetuned-sarcasm``

If the model fails to download or load, the detector returns a
safe fallback response with ``model_available=False`` — no fake
predictions are generated.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from transformers import AutoModelForSequenceClassification, AutoTokenizer
import torch

from config import SARCASM_MODEL, DEVICE, MAX_TEXT_LENGTH, SARCASM_CONFIDENCE_THRESHOLD

logger = logging.getLogger(__name__)


@dataclass
class SarcasmScore:
    is_sarcastic: bool
    confidence: float
    model_available: bool


class SarcasmDetector:
    """Binary sarcasm classifier with graceful fallback."""

    def __init__(self, model_name: str | None = None, device: str | None = None):
        self.model_name = model_name or SARCASM_MODEL
        self.device = device or DEVICE
        self._model = None
        self._tokenizer = None
        self._loaded = False
        self._available = False
        self._sarcastic_index = 1

    def load(self) -> None:
        if self._loaded:
            return
        try:
            logger.info("Loading sarcasm model: %s → %s", self.model_name, self.device)
            self._tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self._model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
            self._model.to(self.device)
            self._model.eval()

            # Resolve which output index means "sarcastic" from the model's own
            # config rather than assuming index 1. Swapping SARCASM_MODEL for a
            # checkpoint with the opposite label order would otherwise invert
            # every prediction silently.
            id2label = getattr(self._model.config, "id2label", {}) or {}
            self._sarcastic_index = 1
            for idx, label in id2label.items():
                if any(tag in str(label).lower() for tag in ("sarcasm_more", "sarcastic", "label_1")):
                    if "less" not in str(label).lower() and "not" not in str(label).lower():
                        self._sarcastic_index = int(idx)
                        break
            logger.info(
                "Sarcasm labels %s -> sarcastic index %d", id2label, self._sarcastic_index
            )

            self._available = True
            logger.info("Sarcasm model loaded.")
        except Exception as exc:
            logger.warning(
                "Sarcasm model could not be loaded (%s). "
                "Sarcasm detection will return model_available=False.",
                exc,
            )
            self._available = False
        finally:
            self._loaded = True

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def is_available(self) -> bool:
        return self._available

    def detect(self, text: str) -> SarcasmScore:
        return self.detect_batch([text])[0]

    @torch.no_grad()
    def detect_batch(self, texts: list[str]) -> list[SarcasmScore]:
        self.load()

        if not self._available:
            return [
                SarcasmScore(is_sarcastic=False, confidence=0.0, model_available=False)
                for _ in texts
            ]

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

        results: list[SarcasmScore] = []
        for i, prob in enumerate(probs):
            idx = self._sarcastic_index if self._sarcastic_index < len(prob) else len(prob) - 1
            sarcasm_prob = float(prob[idx])

            if not texts[i] or not texts[i].strip():
                results.append(SarcasmScore(is_sarcastic=False, confidence=0.0, model_available=True))
                continue

            results.append(
                SarcasmScore(
                    is_sarcastic=sarcasm_prob >= SARCASM_CONFIDENCE_THRESHOLD,
                    confidence=round(sarcasm_prob, 4),
                    model_available=True,
                )
            )

        return results
