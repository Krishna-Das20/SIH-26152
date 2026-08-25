"""
Topic Extractor using BERTopic + KeyBERT fallback.

BERTopic requires a minimum number of documents to cluster.  When
the dataset is too small, we gracefully fall back to KeyBERT-based
keyword grouping so the user always gets *some* topic information.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from collections import Counter

import numpy as np
from keybert import KeyBERT

from config import MIN_TOPIC_SIZE, TOP_N_KEYWORDS

logger = logging.getLogger(__name__)

# BERTopic is heavy — import lazily so startup isn't blocked if
# the user only ever processes small datasets.
_bertopic_available = False
try:
    from bertopic import BERTopic
    _bertopic_available = True
except ImportError:
    logger.warning("BERTopic not installed; will use KeyBERT fallback only.")


@dataclass
class TopicResult:
    topic_id: int = -1
    topic_name: str = ""
    keywords: list[str] = field(default_factory=list)
    num_posts: int = 0
    percentage_of_posts: float = 0.0
    average_sentiment: float = 0.0
    average_engagement: float = 0.0


class TopicExtractor:
    """
    Extract topics from a collection of texts + their embeddings.

    Uses BERTopic when the dataset is large enough, otherwise falls
    back to KeyBERT keyword extraction.
    """

    _MIN_DOCS_FOR_BERTOPIC = 10  # need at least this many docs

    def __init__(self):
        self._keybert: KeyBERT | None = None
        self._loaded = False

    def load(self) -> None:
        if self._loaded:
            return
        logger.info("Initializing KeyBERT for keyword/topic extraction.")
        self._keybert = KeyBERT("all-MiniLM-L6-v2")
        self._loaded = True

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    # ── Public API ────────────────────────────────────────────────

    def extract_keywords(self, text: str, top_n: int | None = None) -> list[str]:
        """Extract keywords from a single text."""
        self.load()
        top_n = top_n or TOP_N_KEYWORDS
        if not text or not text.strip():
            return []
        try:
            kws = self._keybert.extract_keywords(  # type: ignore[union-attr]
                text,
                keyphrase_ngram_range=(1, 2),
                stop_words="english",
                top_n=top_n,
                use_mmr=True,
                diversity=0.5,
            )
            return [kw for kw, _ in kws]
        except Exception as exc:
            logger.warning("Keyword extraction failed: %s", exc)
            return []

    def extract_keywords_batch(
        self, texts: list[str], top_n: int | None = None
    ) -> list[list[str]]:
        """Extract keywords for a list of texts."""
        return [self.extract_keywords(t, top_n) for t in texts]

    def extract_topics(
        self,
        texts: list[str],
        embeddings: np.ndarray | None = None,
        sentiments: list[float] | None = None,
        engagements: list[float] | None = None,
    ) -> tuple[list[int], list[TopicResult]]:
        """
        Extract topics from *texts*.

        Returns:
            (topic_assignments, topic_infos)
            - topic_assignments: per-document topic id (len == len(texts))
            - topic_infos: list of TopicResult objects
        """
        n = len(texts)
        sentiments = sentiments or [0.0] * n
        engagements = engagements or [0.0] * n

        # Attempt BERTopic
        if _bertopic_available and n >= self._MIN_DOCS_FOR_BERTOPIC:
            try:
                return self._bertopic_extract(texts, embeddings, sentiments, engagements)
            except Exception as exc:
                logger.warning("BERTopic failed (%s), falling back to KeyBERT.", exc)

        # Fallback: keyword-based pseudo-topics
        return self._keybert_fallback(texts, sentiments, engagements)

    # ── BERTopic path ─────────────────────────────────────────────

    def _bertopic_extract(
        self,
        texts: list[str],
        embeddings: np.ndarray | None,
        sentiments: list[float],
        engagements: list[float],
    ) -> tuple[list[int], list[TopicResult]]:
        from bertopic import BERTopic
        from sklearn.cluster import KMeans
        from hdbscan import HDBSCAN

        n = len(texts)

        # Use a more lenient clustering for small datasets
        min_cluster = max(2, min(MIN_TOPIC_SIZE, n // 5))

        hdbscan_model = HDBSCAN(
            min_cluster_size=min_cluster,
            min_samples=1,
            metric="euclidean",
            prediction_data=True,
        )

        model = BERTopic(
            hdbscan_model=hdbscan_model,
            calculate_probabilities=False,
            verbose=False,
        )

        if embeddings is not None:
            topics, _ = model.fit_transform(texts, embeddings=embeddings)
        else:
            topics, _ = model.fit_transform(texts)

        topic_info = model.get_topic_info()
        topic_results: list[TopicResult] = []

        for _, row in topic_info.iterrows():
            tid = int(row["Topic"])
            if tid == -1:
                continue  # outlier cluster
            name = str(row.get("Name", f"Topic_{tid}"))
            # Get top words for this topic
            topic_words = model.get_topic(tid)
            kws = [w for w, _ in topic_words[:TOP_N_KEYWORDS]] if topic_words else []

            # Calculate aggregate stats
            indices = [i for i, t in enumerate(topics) if t == tid]
            count = len(indices)
            avg_sent = float(np.mean([sentiments[i] for i in indices])) if indices else 0.0
            avg_eng = float(np.mean([engagements[i] for i in indices])) if indices else 0.0

            topic_results.append(
                TopicResult(
                    topic_id=tid,
                    topic_name=", ".join(kws[:3]) if kws else name,
                    keywords=kws,
                    num_posts=count,
                    percentage_of_posts=round(count / n * 100, 2) if n else 0.0,
                    average_sentiment=round(avg_sent, 4),
                    average_engagement=round(avg_eng, 2),
                )
            )

        return list(topics), topic_results

    # ── KeyBERT fallback ──────────────────────────────────────────

    def _keybert_fallback(
        self,
        texts: list[str],
        sentiments: list[float],
        engagements: list[float],
    ) -> tuple[list[int], list[TopicResult]]:
        """Create pseudo-topics by grouping the most frequent keywords."""
        self.load()
        n = len(texts)

        # Gather all keywords
        all_kws: list[str] = []
        per_doc_kws: list[list[str]] = []
        for t in texts:
            kws = self.extract_keywords(t, top_n=5)
            per_doc_kws.append(kws)
            all_kws.extend(kws)

        if not all_kws:
            return [-1] * n, []

        # Find the top keyword clusters
        counter = Counter(all_kws)
        top_keywords = [kw for kw, _ in counter.most_common(5)]

        # Assign each document to the first matching top keyword
        topic_assignments: list[int] = []
        for doc_kws in per_doc_kws:
            assigned = -1
            for i, top_kw in enumerate(top_keywords):
                if top_kw in doc_kws:
                    assigned = i
                    break
            topic_assignments.append(assigned)

        # Build topic results
        topic_results: list[TopicResult] = []
        for tid, kw in enumerate(top_keywords):
            indices = [i for i, t in enumerate(topic_assignments) if t == tid]
            count = len(indices)
            avg_sent = float(np.mean([sentiments[i] for i in indices])) if indices else 0.0
            avg_eng = float(np.mean([engagements[i] for i in indices])) if indices else 0.0
            topic_results.append(
                TopicResult(
                    topic_id=tid,
                    topic_name=kw,
                    keywords=[kw],
                    num_posts=count,
                    percentage_of_posts=round(count / n * 100, 2) if n else 0.0,
                    average_sentiment=round(avg_sent, 4),
                    average_engagement=round(avg_eng, 2),
                )
            )

        return topic_assignments, topic_results
