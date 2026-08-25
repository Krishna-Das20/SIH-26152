"""Tests for the emotion detection module."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from emotion.analyzer import EmotionAnalyzer


@pytest.fixture(scope="module")
def analyzer():
    a = EmotionAnalyzer()
    a.load()
    return a


def test_joy_detection(analyzer):
    result = analyzer.analyze("I'm so happy and grateful for everything today! Life is wonderful! 😊")
    assert result.joy > 0.1
    assert result.dominant_emotion in ("joy", "optimism", "love", "excitement")


def test_anger_detection(analyzer):
    result = analyzer.analyze("I'm furious about this corrupt decision. This is outrageous and unacceptable!")
    assert result.anger > 0.1


def test_sadness_detection(analyzer):
    result = analyzer.analyze("I'm heartbroken about the loss. This is devastating and I can't stop crying.")
    assert result.sadness > 0.1


def test_fear_detection(analyzer):
    result = analyzer.analyze("I'm terrified of what might happen. This situation is frightening and dangerous.")
    assert result.fear > 0.05


def test_empty_text(analyzer):
    result = analyzer.analyze("")
    assert result.dominant_emotion == "neutral"


def test_batch_analysis(analyzer):
    texts = [
        "I love this so much!",
        "This makes me angry!",
        "",
    ]
    results = analyzer.analyze_batch(texts)
    assert len(results) == 3
    assert results[2].dominant_emotion == "neutral"


def test_dominant_emotion_is_string(analyzer):
    result = analyzer.analyze("What a surprise! I didn't expect this at all!")
    assert isinstance(result.dominant_emotion, str)
    assert len(result.dominant_emotion) > 0
