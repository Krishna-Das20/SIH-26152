"""Tests for the POST /embeddings endpoint."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient
from main import app


client = TestClient(app)


def test_embeddings_basic():
    """Returns embeddings with correct shape for N texts."""
    payload = {"texts": ["Hello world", "Goodbye world"]}
    response = client.post("/embeddings", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["embeddings"]) == 2
    assert data["dimension"] == 384  # all-MiniLM-L6-v2
    assert len(data["embeddings"][0]) == 384
    assert len(data["embeddings"][1]) == 384
    assert data["model"] != ""


def test_embeddings_single_text():
    """Single text returns one 384-dim vector."""
    payload = {"texts": ["AI will improve software development."]}
    response = client.post("/embeddings", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["embeddings"]) == 1
    assert len(data["embeddings"][0]) == 384


def test_embeddings_deterministic():
    """Same input produces the same output (no randomness)."""
    payload = {"texts": ["Deterministic embedding test"]}
    r1 = client.post("/embeddings", json=payload).json()
    r2 = client.post("/embeddings", json=payload).json()
    assert r1["embeddings"] == r2["embeddings"]


def test_embeddings_similar_texts_closer():
    """Similar texts should have higher cosine similarity than dissimilar texts."""
    import numpy as np

    payload = {
        "texts": [
            "AI will improve software development.",
            "AI will enhance programming productivity.",
            "The weather is sunny today in Paris.",
        ]
    }
    response = client.post("/embeddings", json=payload)
    data = response.json()
    e = [np.array(v) for v in data["embeddings"]]

    def cosine_sim(a, b):
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

    sim_related = cosine_sim(e[0], e[1])
    sim_unrelated = cosine_sim(e[0], e[2])
    assert sim_related > sim_unrelated, (
        f"Related texts ({sim_related:.3f}) should be more similar "
        f"than unrelated ({sim_unrelated:.3f})"
    )


def test_embeddings_empty_list_rejected():
    """Empty text list should be rejected by Pydantic validation."""
    payload = {"texts": []}
    response = client.post("/embeddings", json=payload)
    assert response.status_code == 422  # validation error


def test_embeddings_whitespace_only():
    """Whitespace-only text should still return an embedding (encoder handles it)."""
    payload = {"texts": ["   "]}
    response = client.post("/embeddings", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["embeddings"]) == 1
    assert len(data["embeddings"][0]) == 384
