"""
Embedding Encoder using Sentence-Transformers.

Default model: ``all-MiniLM-L6-v2`` (384-dim embeddings, ~80 MB).

Generates embeddings for use in:
  • topic clustering (BERTopic / HDBSCAN)
  • semantic similarity / duplicate detection
  • trend analysis
  • future cross-platform comparison

Embeddings are **never** sent to the frontend.
"""

from __future__ import annotations

import logging

import numpy as np
from sentence_transformers import SentenceTransformer

from config import EMBEDDING_MODEL, DEVICE

logger = logging.getLogger(__name__)


class EmbeddingEncoder:
    """Reusable sentence-embedding encoder."""

    def __init__(self, model_name: str | None = None, device: str | None = None):
        self.model_name = model_name or EMBEDDING_MODEL
        self.device = device or DEVICE
        self._model: SentenceTransformer | None = None
        self._loaded = False

    def load(self) -> None:
        if self._loaded:
            return
        logger.info("Loading embedding model: %s → %s", self.model_name, self.device)
        self._model = SentenceTransformer(self.model_name, device=self.device)
        self._loaded = True
        logger.info(
            "Embedding model loaded (dim=%d).",
            self._model.get_sentence_embedding_dimension(),
        )

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    @property
    def dimension(self) -> int:
        self.load()
        return self._model.get_sentence_embedding_dimension()  # type: ignore[union-attr]

    def encode(self, text: str) -> np.ndarray:
        """Encode a single text into a dense vector."""
        return self.encode_batch([text])[0]

    def encode_batch(
        self,
        texts: list[str],
        batch_size: int = 64,
        show_progress: bool = False,
    ) -> np.ndarray:
        """Encode a list of texts.  Returns shape ``(N, dim)``."""
        self.load()
        safe_texts = [t if t and t.strip() else "." for t in texts]
        embeddings = self._model.encode(  # type: ignore[union-attr]
            safe_texts,
            batch_size=batch_size,
            show_progress_bar=show_progress,
            convert_to_numpy=True,
        )
        return embeddings  # type: ignore[return-value]
