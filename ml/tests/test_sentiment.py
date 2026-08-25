"""Tests for the sentiment analysis module."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from sentiment.analyzer import SentimentAnalyzer


@pytest.fixture(scope="module")
def analyzer():
    a = SentimentAnalyzer()
    a.load()
    return a


def test_positive_sentiment(analyzer):
    result = analyzer.analyze("I love this product! It's absolutely amazing and works perfectly.")
    assert result.label == "positive"
    assert result.positive > result.negative
    assert result.confidence > 0.5


def test_negative_sentiment(analyzer):
    result = analyzer.analyze("This is terrible. Worst experience ever. Total waste of money.")
    assert result.label == "negative"
    assert result.negative > result.positive
    assert result.confidence > 0.5


def test_neutral_sentiment(analyzer):
    result = analyzer.analyze("The meeting is scheduled for 3 PM tomorrow in conference room B.")
    assert result.label == "neutral"


def test_empty_text(analyzer):
    result = analyzer.analyze("")
    assert result.label == "neutral"
    assert result.neutral == 1.0


def test_batch_analysis(analyzer):
    texts = [
        "I love this!",
        "I hate this!",
        "The weather report says rain tomorrow.",
    ]
    results = analyzer.analyze_batch(texts)
    assert len(results) == 3
    assert results[0].label == "positive"
    assert results[1].label == "negative"


def test_scores_sum_to_one(analyzer):
    result = analyzer.analyze("This is a great product with some minor issues.")
    total = result.positive + result.negative + result.neutral
    assert abs(total - 1.0) < 0.01
