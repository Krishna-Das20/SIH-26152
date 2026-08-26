"""
NLP Analysis Pipeline — Orchestrator.

Wires together every NLP module (preprocessing → language → sentiment
→ emotion → sarcasm → toxicity → embeddings → keywords → topics →
trends → engagement → timeline → threads → summary) into a single
``analyze_batch`` method that produces a complete analysis response.

All ML models are loaded **once** at startup and reused across
every request.
"""

from __future__ import annotations

import logging
from collections import Counter, defaultdict
from datetime import datetime

import numpy as np

from schemas.social import (
    SocialContent,
    ContentAnalysisResult,
    PreprocessingResult,
    LanguageResult,
    SentimentResult,
    EmotionResult,
    SarcasmResult,
    ToxicityResult,
    TopicInfo,
    TrendInfo,
    TimelineBucket,
    EngagementBySentiment,
    ThreadAnalysis,
    EngagementSummary,
    ExecutiveSummary,
    RedditAnalysisResponse,
)

from preprocessing import TextCleaner, LanguageDetector
from sentiment import SentimentAnalyzer
from emotion import EmotionAnalyzer
from sarcasm import SarcasmDetector
from toxicity import ToxicityDetector
from embeddings import EmbeddingEncoder
from topics import TopicExtractor
from trends import TrendDetector

logger = logging.getLogger(__name__)


class NLPAnalysisPipeline:
    """
    End-to-end NLP analysis pipeline.

    Usage::

        pipeline = NLPAnalysisPipeline()
        pipeline.load_models()          # warm up once
        response = pipeline.analyze_batch(posts)
    """

    def __init__(self):
        # Stateless modules
        self.cleaner = TextCleaner()
        self.lang_detector = LanguageDetector()
        self.trend_detector = TrendDetector()

        # Stateful (model-backed) modules
        self.sentiment_analyzer = SentimentAnalyzer()
        self.emotion_analyzer = EmotionAnalyzer()
        self.sarcasm_detector = SarcasmDetector()
        self.toxicity_detector = ToxicityDetector()
        self.embedding_encoder = EmbeddingEncoder()
        self.topic_extractor = TopicExtractor()

    # ── Model Lifecycle ───────────────────────────────────────────

    def load_models(self) -> None:
        """Load all ML models.  Safe to call multiple times."""
        logger.info("Loading all NLP models …")
        self.sentiment_analyzer.load()
        self.emotion_analyzer.load()
        self.sarcasm_detector.load()
        self.toxicity_detector.load()
        self.embedding_encoder.load()
        self.topic_extractor.load()
        logger.info("All NLP models loaded ✓")

    @property
    def models_loaded_count(self) -> int:
        count = 0
        for mod in [
            self.sentiment_analyzer,
            self.emotion_analyzer,
            self.sarcasm_detector,
            self.toxicity_detector,
            self.embedding_encoder,
            self.topic_extractor,
        ]:
            if getattr(mod, "is_loaded", False):
                count += 1
        return count

    # ── Single Item ───────────────────────────────────────────────

    def analyze(self, content: SocialContent) -> ContentAnalysisResult:
        """Analyse a single content item (wraps batch of 1)."""
        response = self.analyze_batch([content])
        if response.results:
            return response.results[0]
        return ContentAnalysisResult(content_id=content.content_id, skipped=True)

    # ── Batch Processing ──────────────────────────────────────────

    def analyze_batch(
        self, items: list[SocialContent]
    ) -> RedditAnalysisResponse:
        """
        Analyse a batch of content items and return a full response
        including per-item results, topics, trends, timeline, threads,
        engagement breakdown, and executive summary.
        """
        if not items:
            return RedditAnalysisResponse(platform="reddit", total_items=0)

        n = len(items)
        platform = items[0].platform or "reddit"

        # ── 1. Separate processable vs skipped items ──────────────
        processable_indices: list[int] = []
        skipped_results: dict[int, ContentAnalysisResult] = {}

        for i, item in enumerate(items):
            if not item.text or not item.text.strip():
                skipped_results[i] = ContentAnalysisResult(
                    content_id=item.content_id,
                    platform=item.platform,
                    content_type=item.content_type,
                    timestamp=item.timestamp,
                    parent_id=item.parent_id,
                    community=item.community,
                    author_id=item.author_id,
                    likes=item.likes or 0,
                    comments=item.comments or 0,
                    shares=item.shares or 0,
                    views=item.views,
                    skipped=True,
                    skip_reason="empty_or_missing_text",
                )
            else:
                processable_indices.append(i)

        if not processable_indices:
            all_results = [skipped_results.get(i, ContentAnalysisResult()) for i in range(n)]
            return RedditAnalysisResponse(
                platform=platform,
                total_items=n,
                results=all_results,
                summary=self._build_summary(all_results, [], [], platform),
            )

        # Gather processable texts
        proc_items = [items[i] for i in processable_indices]
        raw_texts = [item.text or "" for item in proc_items]

        # ── 2. Preprocessing ──────────────────────────────────────
        cleaned = self.cleaner.clean_batch(raw_texts)
        cleaned_texts = [c.cleaned_text for c in cleaned]

        # ── 3. Language Detection ─────────────────────────────────
        lang_results = self.lang_detector.detect_batch(cleaned_texts)

        # ── 4. Sentiment Analysis ─────────────────────────────────
        sentiment_results = self.sentiment_analyzer.analyze_batch(cleaned_texts)

        # ── 5. Emotion Detection ──────────────────────────────────
        emotion_results = self.emotion_analyzer.analyze_batch(cleaned_texts)

        # ── 6. Sarcasm Detection ──────────────────────────────────
        sarcasm_results = self.sarcasm_detector.detect_batch(cleaned_texts)

        # ── 7. Toxicity Detection ─────────────────────────────────
        toxicity_results = self.toxicity_detector.detect_batch(cleaned_texts)

        # ── 8. Embeddings ─────────────────────────────────────────
        embeddings = self.embedding_encoder.encode_batch(cleaned_texts)

        # ── 9. Keyword Extraction ─────────────────────────────────
        keywords_per_item = self.topic_extractor.extract_keywords_batch(cleaned_texts)

        # ── Build per-item results ────────────────────────────────
        proc_results: list[ContentAnalysisResult] = []
        for idx_in_proc, global_idx in enumerate(processable_indices):
            item = items[global_idx]
            c = cleaned[idx_in_proc]
            lang = lang_results[idx_in_proc]
            sent = sentiment_results[idx_in_proc]
            emo = emotion_results[idx_in_proc]
            sarc = sarcasm_results[idx_in_proc]
            tox = toxicity_results[idx_in_proc]
            kws = keywords_per_item[idx_in_proc]

            proc_results.append(
                ContentAnalysisResult(
                    content_id=item.content_id,
                    platform=item.platform,
                    content_type=item.content_type,
                    timestamp=item.timestamp,
                    parent_id=item.parent_id,
                    community=item.community,
                    author_id=item.author_id,
                    preprocessing=PreprocessingResult(
                        original_text=c.original_text,
                        cleaned_text=c.cleaned_text,
                    ),
                    language=LanguageResult(
                        language=lang.language,
                        language_confidence=lang.language_confidence,
                    ),
                    sentiment=SentimentResult(
                        label=sent.label,
                        positive=sent.positive,
                        negative=sent.negative,
                        neutral=sent.neutral,
                        confidence=sent.confidence,
                    ),
                    emotion=EmotionResult(
                        joy=emo.joy,
                        sadness=emo.sadness,
                        anger=emo.anger,
                        fear=emo.fear,
                        surprise=emo.surprise,
                        disgust=emo.disgust,
                        excitement=emo.excitement,
                        love=emo.love,
                        optimism=emo.optimism,
                        curiosity=emo.curiosity,
                        # Carried through explicitly: this conversion enumerates
                        # fields, so a new dimension added to EmotionScore is
                        # silently dropped here unless listed. That is exactly
                        # how disapproval/nervousness arrived as 0.0 while
                        # dominant_emotion correctly reported them.
                        disapproval=emo.disapproval,
                        nervousness=emo.nervousness,
                        dominant_emotion=emo.dominant_emotion,
                    ),
                    sarcasm=SarcasmResult(
                        is_sarcastic=sarc.is_sarcastic,
                        confidence=sarc.confidence,
                        model_available=sarc.model_available,
                    ),
                    toxicity=ToxicityResult(
                        is_toxic=tox.is_toxic,
                        toxicity=tox.toxicity,
                        severe_toxicity=tox.severe_toxicity,
                        insult=tox.insult,
                        threat=tox.threat,
                        obscene=tox.obscene,
                        identity_hate=tox.identity_hate,
                    ),
                    keywords=kws,
                    likes=item.likes or 0,
                    comments=item.comments or 0,
                    shares=item.shares or 0,
                    views=item.views,
                    skipped=False,
                )
            )

        # ── Merge processable + skipped into final order ──────────
        all_results: list[ContentAnalysisResult] = []
        proc_iter = iter(proc_results)
        for i in range(n):
            if i in skipped_results:
                all_results.append(skipped_results[i])
            else:
                all_results.append(next(proc_iter))

        # ── 10. Topic Extraction ──────────────────────────────────
        sentiments_float = [
            r.sentiment.positive - r.sentiment.negative
            for r in proc_results
        ]
        engagements_float = [
            float((r.likes or 0) + (r.comments or 0) + (r.shares or 0))
            for r in proc_results
        ]

        topic_assignments, topic_infos = self.topic_extractor.extract_topics(
            texts=cleaned_texts,
            embeddings=embeddings,
            sentiments=sentiments_float,
            engagements=engagements_float,
        )

        topics_schema = [
            TopicInfo(
                topic_id=t.topic_id,
                topic_name=t.topic_name,
                keywords=t.keywords,
                num_posts=t.num_posts,
                percentage_of_posts=t.percentage_of_posts,
                average_sentiment=t.average_sentiment,
                average_engagement=t.average_engagement,
            )
            for t in topic_infos
        ]

        # ── 11. Trend Detection ───────────────────────────────────
        timestamps_list = [item.timestamp for item in proc_items]
        trend_results = self.trend_detector.detect(
            keywords_per_item=keywords_per_item,
            timestamps=timestamps_list,
            engagements=engagements_float,
            sentiments=sentiments_float,
        )
        trends_schema = [
            TrendInfo(
                topic=t.topic,
                current_mentions=t.current_mentions,
                previous_mentions=t.previous_mentions,
                growth_percentage=t.growth_percentage,
                velocity=t.velocity,
                engagement=t.engagement,
                sentiment=t.sentiment,
                trend_score=t.trend_score,
                status=t.status,
            )
            for t in trend_results
        ]

        # ── 12. Timeline Analysis ─────────────────────────────────
        timeline = self._build_timeline(all_results)

        # ── 13. Thread Analysis ───────────────────────────────────
        threads = self._build_threads(all_results)

        # ── 14. Engagement Analysis ───────────────────────────────
        engagement = self._build_engagement(all_results)

        # ── 15. Executive Summary ─────────────────────────────────
        summary = self._build_summary(all_results, topics_schema, trends_schema, platform)

        return RedditAnalysisResponse(
            platform=platform,
            total_items=n,
            results=all_results,
            topics=topics_schema,
            trends=trends_schema,
            timeline=timeline,
            threads=threads,
            engagement=engagement,
            summary=summary,
        )

    # ══════════════════════════════════════════════════════════════
    #  AGGREGATE BUILDERS
    # ══════════════════════════════════════════════════════════════

    def _build_timeline(self, results: list[ContentAnalysisResult]) -> list[TimelineBucket]:
        """Group sentiment by hour (or day if span > 7 days)."""
        timed = [
            (r.timestamp, r)
            for r in results
            if r.timestamp and not r.skipped
        ]
        if not timed:
            return []

        # Parse timestamps
        parsed: list[tuple[datetime, ContentAnalysisResult]] = []
        for ts, r in timed:
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                parsed.append((dt, r))
            except (ValueError, TypeError):
                continue

        if not parsed:
            return []

        parsed.sort(key=lambda x: x[0])
        span = parsed[-1][0] - parsed[0][0]
        use_day = span.total_seconds() > 7 * 86400

        # Group
        buckets: dict[str, list[ContentAnalysisResult]] = defaultdict(list)
        for dt, r in parsed:
            if use_day:
                key = dt.strftime("%Y-%m-%dT00:00:00Z")
            else:
                key = dt.strftime("%Y-%m-%dT%H:00:00Z")
            buckets[key].append(r)

        timeline: list[TimelineBucket] = []
        for ts_key in sorted(buckets.keys()):
            bucket_items = buckets[ts_key]
            labels = [r.sentiment.label for r in bucket_items]
            total = len(labels)
            pos_pct = labels.count("positive") / total if total else 0.0
            neg_pct = labels.count("negative") / total if total else 0.0
            neu_pct = labels.count("neutral") / total if total else 0.0
            avg_score = np.mean(
                [r.sentiment.positive - r.sentiment.negative for r in bucket_items]
            )
            emotions = Counter(r.emotion.dominant_emotion for r in bucket_items)
            dom_emo = emotions.most_common(1)[0][0] if emotions else "neutral"

            timeline.append(
                TimelineBucket(
                    timestamp=ts_key,
                    positive=round(pos_pct, 4),
                    negative=round(neg_pct, 4),
                    neutral=round(neu_pct, 4),
                    average_sentiment_score=round(float(avg_score), 4),
                    dominant_emotion=dom_emo,
                    post_count=total,
                )
            )

        return timeline

    def _build_threads(self, results: list[ContentAnalysisResult]) -> list[ThreadAnalysis]:
        """Analyse sentiment shifts within threads (parent_id chains)."""
        # Group comments by parent_id
        comments_by_parent: dict[str, list[ContentAnalysisResult]] = defaultdict(list)
        for r in results:
            if r.parent_id and r.content_type == "comment" and not r.skipped:
                comments_by_parent[r.parent_id].append(r)

        threads: list[ThreadAnalysis] = []
        for post_id, comment_list in comments_by_parent.items():
            if len(comment_list) < 2:
                threads.append(
                    ThreadAnalysis(
                        post_id=post_id,
                        comment_count=len(comment_list),
                        sentiment_shift="none",
                        shift_strength=0.0,
                    )
                )
                continue

            # Sort by timestamp
            comment_list.sort(key=lambda c: c.timestamp or "")

            # Sentiment scores over time
            scores = [c.sentiment.positive - c.sentiment.negative for c in comment_list]
            sentiments_over_time = [
                {"timestamp": c.timestamp, "sentiment_score": round(s, 4), "label": c.sentiment.label}
                for c, s in zip(comment_list, scores)
            ]

            # Detect shift: compare first half vs second half
            mid = len(scores) // 2
            early_avg = np.mean(scores[:mid]) if mid > 0 else 0.0
            late_avg = np.mean(scores[mid:])
            shift = float(late_avg - early_avg)

            if shift < -0.3:
                shift_label = "positive_to_negative"
            elif shift > 0.3:
                shift_label = "negative_to_positive"
            else:
                shift_label = "none"

            threads.append(
                ThreadAnalysis(
                    post_id=post_id,
                    comment_count=len(comment_list),
                    sentiment_shift=shift_label,
                    shift_strength=round(abs(shift), 4),
                    sentiments_over_time=sentiments_over_time,
                )
            )

        return threads

    def _build_engagement(self, results: list[ContentAnalysisResult]) -> EngagementSummary:
        """Calculate engagement breakdown by sentiment and emotion."""
        active = [r for r in results if not r.skipped]
        if not active:
            return EngagementSummary()

        total_posts = sum(1 for r in active if r.content_type == "post")
        total_comments = sum(1 for r in active if r.content_type == "comment")
        total_likes = sum(r.likes for r in active)
        total_eng = sum(r.likes + r.comments + r.shares for r in active)
        avg_eng = total_eng / len(active) if active else 0.0

        # By sentiment
        by_sent: dict[str, list[ContentAnalysisResult]] = defaultdict(list)
        for r in active:
            by_sent[r.sentiment.label].append(r)

        engagement_by_sent: list[EngagementBySentiment] = []
        for label in ["positive", "negative", "neutral"]:
            items = by_sent.get(label, [])
            if not items:
                continue
            t_likes = sum(r.likes for r in items)
            t_comments = sum(r.comments for r in items)
            t_total = sum(r.likes + r.comments + r.shares for r in items)
            engagement_by_sent.append(
                EngagementBySentiment(
                    sentiment=label,
                    total_likes=t_likes,
                    total_comments=t_comments,
                    average_engagement=round(t_total / len(items), 2),
                    post_count=len(items),
                )
            )

        # By emotion
        by_emo: dict[str, list[ContentAnalysisResult]] = defaultdict(list)
        for r in active:
            by_emo[r.emotion.dominant_emotion].append(r)

        engagement_by_emo: list[dict] = []
        for emo, items in by_emo.items():
            t_total = sum(r.likes + r.comments + r.shares for r in items)
            engagement_by_emo.append({
                "emotion": emo,
                "post_count": len(items),
                "average_engagement": round(t_total / len(items), 2),
            })

        # Generate insight
        insight = ""
        if len(engagement_by_sent) >= 2:
            sorted_eng = sorted(engagement_by_sent, key=lambda x: x.average_engagement, reverse=True)
            top = sorted_eng[0]
            bot = sorted_eng[-1]
            if top.average_engagement > 0 and bot.average_engagement > 0:
                diff_pct = round(
                    ((top.average_engagement - bot.average_engagement) / bot.average_engagement) * 100, 1
                )
                insight = (
                    f"{top.sentiment.capitalize()} posts received {diff_pct}% higher "
                    f"average engagement than {bot.sentiment} posts."
                )

        return EngagementSummary(
            total_posts=total_posts,
            total_comments=total_comments,
            total_likes=total_likes,
            average_engagement=round(avg_eng, 2),
            by_sentiment=engagement_by_sent,
            by_emotion=engagement_by_emo,
            insight=insight,
        )

    def _build_summary(
        self,
        results: list[ContentAnalysisResult],
        topics: list[TopicInfo],
        trends: list[TrendInfo],
        platform: str,
    ) -> ExecutiveSummary:
        """Build an executive summary from aggregate results."""
        active = [r for r in results if not r.skipped]
        n = len(active)
        if n == 0:
            return ExecutiveSummary()

        total_posts = sum(1 for r in active if r.content_type == "post")
        total_comments = sum(1 for r in active if r.content_type == "comment")

        labels = [r.sentiment.label for r in active]
        pos_pct = round(labels.count("positive") / n * 100, 2)
        neg_pct = round(labels.count("negative") / n * 100, 2)
        neu_pct = round(labels.count("neutral") / n * 100, 2)

        emotions = Counter(r.emotion.dominant_emotion for r in active)
        dom_emo = emotions.most_common(1)[0][0] if emotions else "neutral"

        top_topic = topics[0].topic_name if topics else ""
        rising = ""
        for t in trends:
            if t.status in ("rising", "spike"):
                rising = t.topic
                break

        total_eng = sum(r.likes + r.comments + r.shares for r in active)
        avg_eng = round(total_eng / n, 2) if n else 0.0

        toxic_count = sum(1 for r in active if r.toxicity.is_toxic)
        toxic_pct = round(toxic_count / n * 100, 2) if n else 0.0

        sarcasm_count = sum(1 for r in active if r.sarcasm.is_sarcastic)
        sarcasm_pct = round(sarcasm_count / n * 100, 2) if n else 0.0

        return ExecutiveSummary(
            total_posts=total_posts,
            total_comments=total_comments,
            positive_percentage=pos_pct,
            negative_percentage=neg_pct,
            neutral_percentage=neu_pct,
            dominant_emotion=dom_emo,
            top_topic=top_topic,
            rising_topic=rising,
            average_engagement=avg_eng,
            toxicity_percentage=toxic_pct,
            sarcasm_percentage=sarcasm_pct,
        )
