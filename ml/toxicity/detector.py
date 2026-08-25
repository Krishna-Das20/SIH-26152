"""
Toxicity Detector using a pretrained multi-label BERT model.

Default model: ``unitary/toxic-bert``
— trained on the Jigsaw Toxic Comment dataset.  Outputs 6 labels:
toxic, severe_toxic, obscene, threat, insult, identity_hate.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from transformers import AutoModelForSequenceClassification, AutoTokenizer, AutoConfig
import torch

from config import TOXICITY_MODEL, DEVICE, MAX_TEXT_LENGTH, TOXICITY_THRESHOLD

logger = logging.getLogger(__name__)

# Expected label order for unitary/toxic-bert
_DEFAULT_LABELS = [
    "toxic",
    "severe_toxic",
    "obscene",
    "threat",
    "insult",
    "identity_hate",
]


@dataclass
class ToxicityScore:
    is_toxic: bool
    toxicity: float
    severe_toxicity: float
    insult: float
    threat: float
    obscene: float
    identity_hate: float


class ToxicityDetector:
    """Multi-label toxicity classifier."""

    def __init__(self, model_name: str | None = None, device: str | None = None):
        self.model_name = model_name or TOXICITY_MODEL
        self.device = device or DEVICE
        self._model = None
        self._tokenizer = None
        self._labels: list[str] = _DEFAULT_LABELS
        self._loaded = False
        self._available = False

    def load(self) -> None:
        if self._loaded:
            return
        try:
            logger.info("Loading toxicity model: %s → %s", self.model_name, self.device)
            self._tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self._model = AutoModelForSequenceClassification.from_pretrained(self.model_name)
            self._model.to(self.device)
            self._model.eval()

            config = AutoConfig.from_pretrained(self.model_name)
            if hasattr(config, "id2label") and config.id2label:
                self._labels = [config.id2label[i].lower() for i in sorted(config.id2label.keys(), key=int)]

            self._available = True
            logger.info("Toxicity model loaded (%d labels).", len(self._labels))
        except Exception as exc:
            logger.warning("Toxicity model could not be loaded: %s", exc)
            self._available = False
        finally:
            self._loaded = True

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def is_available(self) -> bool:
        return self._available

    def detect(self, text: str) -> ToxicityScore:
        return self.detect_batch([text])[0]

    @torch.no_grad()
    def detect_batch(self, texts: list[str]) -> list[ToxicityScore]:
        self.load()

        if not self._available:
            return [self._empty() for _ in texts]

        safe_texts = [t if t and t.strip() else "." for t in texts]

        encodings = self._tokenizer(
            safe_texts,
            padding=True,
            truncation=True,
            max_length=MAX_TEXT_LENGTH,
            return_tensors="pt",
        ).to(self.device)

        outputs = self._model(**encodings)
        probs = torch.sigmoid(outputs.logits).cpu().numpy()

        results: list[ToxicityScore] = []
        for i, prob in enumerate(probs):
            scores: dict[str, float] = {}
            for j, label in enumerate(self._labels):
                if j < len(prob):
                    scores[label] = round(float(prob[j]), 4)

            if not texts[i] or not texts[i].strip():
                results.append(self._empty())
                continue

            toxicity_val = scores.get("toxic", 0.0)
            results.append(
                ToxicityScore(
                    is_toxic=toxicity_val >= TOXICITY_THRESHOLD,
                    toxicity=toxicity_val,
                    severe_toxicity=scores.get("severe_toxic", 0.0),
                    insult=scores.get("insult", 0.0),
                    threat=scores.get("threat", 0.0),
                    obscene=scores.get("obscene", 0.0),
                    identity_hate=scores.get("identity_hate", 0.0),
                )
            )

        return results

    @staticmethod
    def _empty() -> ToxicityScore:
        return ToxicityScore(
            is_toxic=False,
            toxicity=0.0,
            severe_toxicity=0.0,
            insult=0.0,
            threat=0.0,
            obscene=0.0,
            identity_hate=0.0,
        )
