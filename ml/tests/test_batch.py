"""Tests for batch processing and sample data."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import json
import pytest
from fastapi.testclient import TestClient
from main import app


client = TestClient(app)

SAMPLE_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "sample_reddit.json")


@pytest.fixture(scope="module")
def sample_data():
    with open(SAMPLE_DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    # Filter out the _comment field
    return [item for item in data if isinstance(item, dict) and "content_id" in item]


def test_sample_data_loads(sample_data):
    """Verify sample data file is valid and has expected records."""
    assert len(sample_data) >= 20
    for item in sample_data:
        assert "platform" in item
        assert "content_id" in item


def test_full_sample_pipeline(sample_data):
    """Run the full sample dataset through the pipeline."""
    payload = {"posts": sample_data}
    response = client.post("/analyze/reddit", json=payload)
    assert response.status_code == 200
    data = response.json()

    # Basic structure
    assert data["platform"] == "reddit"
    assert data["total_items"] == len(sample_data)
    assert len(data["results"]) == len(sample_data)

    # Verify results contain analysis (non-skipped items)
    analysed = [r for r in data["results"] if not r["skipped"]]
    assert len(analysed) > 0

    for r in analysed:
        assert "sentiment" in r
        assert r["sentiment"]["label"] in ("positive", "negative", "neutral")
        assert "emotion" in r
        assert "dominant_emotion" in r["emotion"]
        assert "sarcasm" in r
        assert "toxicity" in r
        assert "keywords" in r

    # Verify aggregate sections exist
    assert "topics" in data
    assert "trends" in data
    assert "timeline" in data
    assert "summary" in data
    assert "engagement" in data

    # Summary sanity
    summary = data["summary"]
    total_pct = summary["positive_percentage"] + summary["negative_percentage"] + summary["neutral_percentage"]
    assert 99.0 <= total_pct <= 101.0  # should sum to ~100%


def test_skipped_items_in_sample(sample_data):
    """Verify empty/deleted texts are handled gracefully."""
    payload = {"posts": sample_data}
    response = client.post("/analyze/reddit", json=payload)
    data = response.json()

    skipped = [r for r in data["results"] if r["skipped"]]
    # We have at least one empty text in the sample data
    assert len(skipped) >= 1

    for r in skipped:
        assert r["skip_reason"] is not None


def test_thread_analysis_present(sample_data):
    """Verify thread analysis works for posts with comments."""
    payload = {"posts": sample_data}
    response = client.post("/analyze/reddit", json=payload)
    data = response.json()

    threads = data.get("threads", [])
    # We have several comments with parent_id in the sample data
    assert len(threads) >= 1

    for t in threads:
        assert "post_id" in t
        assert "comment_count" in t
        assert "sentiment_shift" in t


def test_engagement_insight(sample_data):
    """Verify engagement analysis produces valid stats."""
    payload = {"posts": sample_data}
    response = client.post("/analyze/reddit", json=payload)
    data = response.json()

    engagement = data.get("engagement", {})
    assert engagement["total_posts"] > 0
    assert engagement["average_engagement"] > 0
    assert len(engagement["by_sentiment"]) > 0
