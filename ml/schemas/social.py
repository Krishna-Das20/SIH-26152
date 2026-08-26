"""
Pydantic schemas for the NLP Analysis Pipeline.

These models define the input/output contracts between the Next.js
frontend and the Python ML service.  Designed to be platform-agnostic
so the same schemas work for Reddit, X, Instagram, YouTube, etc.
"""

from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════════
#  INPUT SCHEMAS
# ═══════════════════════════════════════════════════════════════════

class SocialContent(BaseModel):
    """
    Normalized social-media content object.

    This is the *input* the pipeline receives from any platform
    connector (Reddit, X, YouTube …).  Fields are optional where a
    platform may not provide them.
    """

    platform: str = "reddit"
    content_id: str = ""
    author_id: Optional[str] = None
    text: Optional[str] = None
    timestamp: Optional[str] = None
    content_type: str = "post"  # "post" | "comment"
    likes: Optional[int] = 0
    comments: Optional[int] = 0
    shares: Optional[int] = 0
    views: Optional[int] = None
    parent_id: Optional[str] = None
    community: Optional[str] = None
    url: Optional[str] = None

    class Config:
        extra = "allow"  # tolerate unknown fields from connectors


class RedditAnalysisRequest(BaseModel):
    """POST /analyze/reddit  —  request body."""

    posts: list[SocialContent]


class BatchAnalysisRequest(BaseModel):
    """POST /analyze/batch  —  request body."""

    items: list[SocialContent]


# ═══════════════════════════════════════════════════════════════════
#  OUTPUT SCHEMAS  (per-item results)
# ═══════════════════════════════════════════════════════════════════

class PreprocessingResult(BaseModel):
    original_text: str = ""
    cleaned_text: str = ""


class LanguageResult(BaseModel):
    language: str = "unknown"
    language_confidence: float = 0.0


class SentimentResult(BaseModel):
    label: str = "neutral"
    positive: float = 0.0
    negative: float = 0.0
    neutral: float = 1.0
    confidence: float = 0.0


class EmotionResult(BaseModel):
    joy: float = 0.0
    sadness: float = 0.0
    anger: float = 0.0
    fear: float = 0.0
    surprise: float = 0.0
    disgust: float = 0.0
    # optional extended emotions
    excitement: float = 0.0
    love: float = 0.0
    optimism: float = 0.0
    curiosity: float = 0.0
    # Kept distinct from anger/fear so the consumer can express the problem
    # statement's "against" and "anxiety" dimensions.
    disapproval: float = 0.0
    nervousness: float = 0.0
    dominant_emotion: str = "neutral"


class SarcasmResult(BaseModel):
    is_sarcastic: bool = False
    confidence: float = 0.0
    model_available: bool = True


class ToxicityResult(BaseModel):
    is_toxic: bool = False
    toxicity: float = 0.0
    severe_toxicity: float = 0.0
    insult: float = 0.0
    threat: float = 0.0
    obscene: float = 0.0
    identity_hate: float = 0.0


class ContentAnalysisResult(BaseModel):
    """Full analysis result for a single piece of content."""

    content_id: str = ""
    platform: str = "reddit"
    content_type: str = "post"
    timestamp: Optional[str] = None
    parent_id: Optional[str] = None
    community: Optional[str] = None
    author_id: Optional[str] = None

    preprocessing: PreprocessingResult = Field(default_factory=PreprocessingResult)
    language: LanguageResult = Field(default_factory=LanguageResult)
    sentiment: SentimentResult = Field(default_factory=SentimentResult)
    emotion: EmotionResult = Field(default_factory=EmotionResult)
    sarcasm: SarcasmResult = Field(default_factory=SarcasmResult)
    toxicity: ToxicityResult = Field(default_factory=ToxicityResult)
    keywords: list[str] = Field(default_factory=list)

    # engagement metadata (pass-through from input)
    likes: int = 0
    comments: int = 0
    shares: int = 0
    views: Optional[int] = None

    # flags
    skipped: bool = False
    skip_reason: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════
#  AGGREGATE / BATCH SCHEMAS
# ═══════════════════════════════════════════════════════════════════

class TopicInfo(BaseModel):
    topic_id: int = -1
    topic_name: str = ""
    keywords: list[str] = Field(default_factory=list)
    num_posts: int = 0
    percentage_of_posts: float = 0.0
    average_sentiment: float = 0.0
    average_engagement: float = 0.0


class TrendInfo(BaseModel):
    topic: str = ""
    current_mentions: int = 0
    previous_mentions: int = 0
    growth_percentage: float = 0.0
    velocity: float = 0.0
    engagement: float = 0.0
    sentiment: float = 0.0
    trend_score: float = 0.0
    status: str = "stable"  # rising | stable | declining | spike


class TimelineBucket(BaseModel):
    timestamp: str = ""
    positive: float = 0.0
    negative: float = 0.0
    neutral: float = 0.0
    average_sentiment_score: float = 0.0
    dominant_emotion: str = "neutral"
    post_count: int = 0


class EngagementBySentiment(BaseModel):
    sentiment: str = ""
    total_likes: int = 0
    total_comments: int = 0
    average_engagement: float = 0.0
    post_count: int = 0


class ThreadAnalysis(BaseModel):
    post_id: str = ""
    comment_count: int = 0
    sentiment_shift: str = "none"  # positive_to_negative | negative_to_positive | none
    shift_strength: float = 0.0
    sentiments_over_time: list[dict[str, Any]] = Field(default_factory=list)


class EngagementSummary(BaseModel):
    total_posts: int = 0
    total_comments: int = 0
    total_likes: int = 0
    average_engagement: float = 0.0
    by_sentiment: list[EngagementBySentiment] = Field(default_factory=list)
    by_emotion: list[dict[str, Any]] = Field(default_factory=list)
    insight: str = ""


class ExecutiveSummary(BaseModel):
    total_posts: int = 0
    total_comments: int = 0
    positive_percentage: float = 0.0
    negative_percentage: float = 0.0
    neutral_percentage: float = 0.0
    dominant_emotion: str = "neutral"
    top_topic: str = ""
    rising_topic: str = ""
    average_engagement: float = 0.0
    toxicity_percentage: float = 0.0
    sarcasm_percentage: float = 0.0


class RedditAnalysisResponse(BaseModel):
    """POST /analyze/reddit  —  response body."""

    platform: str = "reddit"
    total_items: int = 0
    results: list[ContentAnalysisResult] = Field(default_factory=list)
    topics: list[TopicInfo] = Field(default_factory=list)
    trends: list[TrendInfo] = Field(default_factory=list)
    timeline: list[TimelineBucket] = Field(default_factory=list)
    threads: list[ThreadAnalysis] = Field(default_factory=list)
    engagement: EngagementSummary = Field(default_factory=EngagementSummary)
    summary: ExecutiveSummary = Field(default_factory=ExecutiveSummary)


class HealthResponse(BaseModel):
    status: str = "ok"
    device: str = "cpu"
    models_loaded: int = 0


class ModelsResponse(BaseModel):
    sentiment: str = ""
    emotion: str = ""
    sarcasm: str = ""
    toxicity: str = ""
    embeddings: str = ""
    device: str = "cpu"


# ═══════════════════════════════════════════════════════════════════
#  EMBEDDING SCHEMAS
# ═══════════════════════════════════════════════════════════════════

class EmbeddingRequest(BaseModel):
    """POST /embeddings  —  request body."""

    texts: list[str] = Field(
        ...,
        min_length=1,
        description="List of texts to generate embeddings for.",
    )


class EmbeddingResponse(BaseModel):
    """POST /embeddings  —  response body."""

    embeddings: list[list[float]] = Field(default_factory=list)
    model: str = ""
    dimension: int = 0
