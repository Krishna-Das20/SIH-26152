"""Tests for the FastAPI endpoints."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import json
import pytest
from fastapi.testclient import TestClient
from main import app


client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "device" in data


def test_models_endpoint():
    response = client.get("/models")
    assert response.status_code == 200
    data = response.json()
    assert "sentiment" in data
    assert "emotion" in data
    assert "device" in data


def test_analyze_single():
    payload = {
        "platform": "reddit",
        "content_id": "test_001",
        "text": "This is a great day! I love everything about it.",
        "timestamp": "2026-08-25T10:00:00Z",
        "content_type": "post",
        "likes": 50,
        "comments": 10,
    }
    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["content_id"] == "test_001"
    assert "sentiment" in data
    assert "emotion" in data
    assert data["skipped"] is False


def test_analyze_single_empty_text():
    payload = {
        "platform": "reddit",
        "content_id": "test_empty",
        "text": "",
        "content_type": "post",
    }
    response = client.post("/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["skipped"] is True


def test_analyze_reddit_batch():
    payload = {
        "posts": [
            {
                "platform": "reddit",
                "content_id": "batch_001",
                "text": "AI is amazing and transforming everything!",
                "timestamp": "2026-08-25T10:00:00Z",
                "content_type": "post",
                "likes": 100,
                "comments": 20,
            },
            {
                "platform": "reddit",
                "content_id": "batch_002",
                "text": "This product is terrible and a waste of money.",
                "timestamp": "2026-08-25T11:00:00Z",
                "content_type": "post",
                "likes": 30,
                "comments": 45,
            },
            {
                "platform": "reddit",
                "content_id": "batch_003",
                "text": "Oh great, another update that breaks everything. Thanks a lot 🙄",
                "timestamp": "2026-08-25T12:00:00Z",
                "content_type": "comment",
                "likes": 15,
                "comments": 3,
                "parent_id": "batch_001",
            },
        ]
    }
    response = client.post("/analyze/reddit", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["platform"] == "reddit"
    assert data["total_items"] == 3
    assert len(data["results"]) == 3
    assert "topics" in data
    assert "trends" in data
    assert "timeline" in data
    assert "summary" in data


def test_analyze_reddit_empty_batch():
    payload = {"posts": []}
    response = client.post("/analyze/reddit", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_items"] == 0


def test_analyze_malformed_input():
    payload = {
        "posts": [
            {
                "platform": "reddit",
                "content_id": "malformed_001",
                "text": None,
                "content_type": "post",
            },
            {
                "platform": "reddit",
                "content_id": "malformed_002",
                "content_type": "comment",
            },
        ]
    }
    response = client.post("/analyze/reddit", json=payload)
    assert response.status_code == 200
    data = response.json()
    # Both items should be skipped, not crash
    assert data["total_items"] == 2
    for r in data["results"]:
        assert r["skipped"] is True


def test_analyze_batch_endpoint():
    payload = {
        "items": [
            {
                "platform": "reddit",
                "content_id": "generic_001",
                "text": "Testing the generic batch endpoint.",
                "content_type": "post",
                "likes": 5,
            }
        ]
    }
    response = client.post("/analyze/batch", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_items"] == 1


def test_summary_fields():
    payload = {
        "posts": [
            {
                "platform": "reddit",
                "content_id": "sum_001",
                "text": "I love this new feature! It's brilliant!",
                "timestamp": "2026-08-25T10:00:00Z",
                "content_type": "post",
                "likes": 100,
            },
            {
                "platform": "reddit",
                "content_id": "sum_002",
                "text": "This is absolutely terrible. Worst update ever.",
                "timestamp": "2026-08-25T11:00:00Z",
                "content_type": "post",
                "likes": 50,
            },
        ]
    }
    response = client.post("/analyze/reddit", json=payload)
    assert response.status_code == 200
    summary = response.json()["summary"]
    assert "positive_percentage" in summary
    assert "negative_percentage" in summary
    assert "neutral_percentage" in summary
    assert "dominant_emotion" in summary
    assert "average_engagement" in summary
