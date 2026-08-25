"""
Trend Detector — tracks keyword/topic frequency changes over time.

Implements a composite trend score:

    trend_score =
        frequency_growth   × 0.40
      + mention_velocity   × 0.25
      + engagement_growth  × 0.20
      + consistency        × 0.15

All component values are normalised to [0, 100] before the weighted
sum so the final trend_score is also on a 0–100 scale.
"""

from __future__ import annotations

import logging
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone

from config import TREND_WEIGHTS

logger = logging.getLogger(__name__)


@dataclass
class TrendResult:
    topic: str = ""
    current_mentions: int = 0
    previous_mentions: int = 0
    growth_percentage: float = 0.0
    velocity: float = 0.0
    engagement: float = 0.0
    sentiment: float = 0.0
    trend_score: float = 0.0
    status: str = "stable"  # rising | stable | declining | spike


class TrendDetector:
    """Detect trending keywords/topics from a time-annotated dataset."""

    def detect(
        self,
        keywords_per_item: list[list[str]],
        timestamps: list[str | None],
        engagements: list[float],
        sentiments: list[float],
    ) -> list[TrendResult]:
        """
        Detect trends from per-item keywords, timestamps, engagement,
        and sentiment values.

        The time axis is split at the *median* timestamp to create a
        'previous' and 'current' window.
        """
        n = len(keywords_per_item)
        if n == 0:
            return []

        # Parse timestamps
        parsed_times = self._parse_timestamps(timestamps)
        if not parsed_times:
            # If no valid timestamps, treat everything as 'current'
            return self._single_window(keywords_per_item, engagements, sentiments)

        # Split into previous / current at median
        valid_pairs = [(i, t) for i, t in enumerate(parsed_times) if t is not None]
        if len(valid_pairs) < 2:
            return self._single_window(keywords_per_item, engagements, sentiments)

        valid_pairs.sort(key=lambda x: x[1])
        mid = len(valid_pairs) // 2
        prev_indices = {i for i, _ in valid_pairs[:mid]}
        curr_indices = {i for i, _ in valid_pairs[mid:]}

        # Count keywords in each window
        prev_counts: Counter[str] = Counter()
        curr_counts: Counter[str] = Counter()
        curr_engagement: dict[str, list[float]] = defaultdict(list)
        curr_sentiment: dict[str, list[float]] = defaultdict(list)

        for i, kws in enumerate(keywords_per_item):
            for kw in kws:
                kw_lower = kw.lower().strip()
                if not kw_lower:
                    continue
                if i in prev_indices:
                    prev_counts[kw_lower] += 1
                if i in curr_indices:
                    curr_counts[kw_lower] += 1
                    curr_engagement[kw_lower].append(engagements[i] if i < len(engagements) else 0.0)
                    curr_sentiment[kw_lower].append(sentiments[i] if i < len(sentiments) else 0.0)

        # All unique keywords
        all_keywords = set(prev_counts.keys()) | set(curr_counts.keys())
        if not all_keywords:
            return []

        # Calculate raw metrics for each keyword
        raw_results: list[dict] = []
        for kw in all_keywords:
            prev = prev_counts.get(kw, 0)
            curr = curr_counts.get(kw, 0)
            growth = ((curr - prev) / max(prev, 1)) * 100
            eng_values = curr_engagement.get(kw, [0.0])
            sent_values = curr_sentiment.get(kw, [0.0])

            raw_results.append({
                "topic": kw,
                "current_mentions": curr,
                "previous_mentions": prev,
                "growth_percentage": growth,
                "engagement": sum(eng_values),
                "avg_engagement": sum(eng_values) / max(len(eng_values), 1),
                "sentiment": sum(sent_values) / max(len(sent_values), 1),
            })

        # Calculate velocity (mentions per time unit in current window)
        curr_time_range = self._time_range_hours(
            [parsed_times[i] for i, _ in valid_pairs[mid:] if parsed_times[i] is not None]
        )
        for r in raw_results:
            r["velocity"] = r["current_mentions"] / max(curr_time_range, 1.0)

        # Normalise & compute trend score
        trends = self._score_trends(raw_results)

        # Sort by trend_score descending, return top 20
        trends.sort(key=lambda t: t.trend_score, reverse=True)
        return trends[:20]

    # ── Scoring ───────────────────────────────────────────────────

    def _score_trends(self, raw: list[dict]) -> list[TrendResult]:
        """Normalise metrics and compute composite trend score."""
        if not raw:
            return []

        # Extract component arrays for min-max normalisation
        growths = [r["growth_percentage"] for r in raw]
        velocities = [r["velocity"] for r in raw]
        engagements = [r["engagement"] for r in raw]

        def _norm(values: list[float]) -> list[float]:
            lo, hi = min(values), max(values)
            rng = hi - lo
            if rng == 0:
                return [50.0] * len(values)
            return [((v - lo) / rng) * 100 for v in values]

        n_growth = _norm(growths)
        n_velocity = _norm(velocities)
        n_engagement = _norm(engagements)

        w = TREND_WEIGHTS
        results: list[TrendResult] = []

        for i, r in enumerate(raw):
            # Consistency: keyword appeared in both windows → higher score
            consistency = 100.0 if r["previous_mentions"] > 0 and r["current_mentions"] > 0 else 30.0

            score = (
                n_growth[i] * w["frequency_growth"]
                + n_velocity[i] * w["mention_velocity"]
                + n_engagement[i] * w["engagement_growth"]
                + consistency * w["consistency"]
            )

            # Determine status
            gp = r["growth_percentage"]
            if gp > 200:
                status = "spike"
            elif gp > 50:
                status = "rising"
            elif gp < -30:
                status = "declining"
            else:
                status = "stable"

            results.append(
                TrendResult(
                    topic=r["topic"],
                    current_mentions=r["current_mentions"],
                    previous_mentions=r["previous_mentions"],
                    growth_percentage=round(r["growth_percentage"], 2),
                    velocity=round(r["velocity"], 4),
                    engagement=round(r["engagement"], 2),
                    sentiment=round(r["sentiment"], 4),
                    trend_score=round(score, 2),
                    status=status,
                )
            )

        return results

    # ── Helpers ───────────────────────────────────────────────────

    def _single_window(
        self,
        keywords_per_item: list[list[str]],
        engagements: list[float],
        sentiments: list[float],
    ) -> list[TrendResult]:
        """When timestamps are missing, just rank by frequency."""
        counter: Counter[str] = Counter()
        eng_map: dict[str, list[float]] = defaultdict(list)
        sent_map: dict[str, list[float]] = defaultdict(list)

        for i, kws in enumerate(keywords_per_item):
            for kw in kws:
                kw_lower = kw.lower().strip()
                if kw_lower:
                    counter[kw_lower] += 1
                    eng_map[kw_lower].append(engagements[i] if i < len(engagements) else 0.0)
                    sent_map[kw_lower].append(sentiments[i] if i < len(sentiments) else 0.0)

        results: list[TrendResult] = []
        for kw, count in counter.most_common(20):
            eng_vals = eng_map[kw]
            sent_vals = sent_map[kw]
            results.append(
                TrendResult(
                    topic=kw,
                    current_mentions=count,
                    previous_mentions=0,
                    growth_percentage=0.0,
                    velocity=0.0,
                    engagement=round(sum(eng_vals), 2),
                    sentiment=round(sum(sent_vals) / max(len(sent_vals), 1), 4),
                    trend_score=float(count),
                    status="stable",
                )
            )
        return results

    @staticmethod
    def _parse_timestamps(timestamps: list[str | None]) -> list[datetime | None]:
        parsed: list[datetime | None] = []
        for ts in timestamps:
            if not ts:
                parsed.append(None)
                continue
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                parsed.append(dt)
            except (ValueError, TypeError):
                parsed.append(None)
        return parsed

    @staticmethod
    def _time_range_hours(dts: list[datetime]) -> float:
        if len(dts) < 2:
            return 1.0
        dts_sorted = sorted(dts)
        delta = dts_sorted[-1] - dts_sorted[0]
        hours = delta.total_seconds() / 3600
        return max(hours, 0.01)
