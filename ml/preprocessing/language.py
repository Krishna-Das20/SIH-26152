"""
Language detection for social-media text.

Uses ``langdetect`` with a deterministic seed for reproducibility.
Short texts and texts with low detection confidence are marked as
``"unknown"``.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from langdetect import detect_langs, LangDetectException
from langdetect import DetectorFactory

# Make langdetect deterministic
DetectorFactory.seed = 0

logger = logging.getLogger(__name__)

_MIN_CHARS_FOR_DETECTION = 8


@dataclass
class LanguageInfo:
    language: str
    language_confidence: float


class LanguageDetector:
    """Lightweight language detector.  No model to load."""

    def __init__(self, confidence_threshold: float = 0.70):
        self.confidence_threshold = confidence_threshold

    def detect(self, text: str | None) -> LanguageInfo:
        """Detect the language of *text*."""
        if not text or len(text.strip()) < _MIN_CHARS_FOR_DETECTION:
            return LanguageInfo(language="unknown", language_confidence=0.0)

        try:
            results = detect_langs(text)
            if not results:
                return LanguageInfo(language="unknown", language_confidence=0.0)

            top = results[0]
            lang = top.lang
            conf = round(top.prob, 4)

            if conf < self.confidence_threshold:
                return LanguageInfo(language="unknown", language_confidence=conf)

            return LanguageInfo(language=lang, language_confidence=conf)

        except LangDetectException:
            return LanguageInfo(language="unknown", language_confidence=0.0)
        except Exception as exc:
            logger.warning("Language detection error: %s", exc)
            return LanguageInfo(language="unknown", language_confidence=0.0)

    def detect_batch(self, texts: list[str | None]) -> list[LanguageInfo]:
        return [self.detect(t) for t in texts]
