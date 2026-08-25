"""
Pre-downloads every model the pipeline needs into the local HuggingFace cache.

Run once after installing dependencies so the first API request does not stall
for several minutes fetching ~2 GB of weights. Safe to re-run: cached models
are skipped.

    python download_models.py
"""

import sys
import time

sys.path.insert(0, ".")


def fetch_classifier(name: str, label: str) -> bool:
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    print(f"\n[{label}] {name}", flush=True)
    t0 = time.time()
    try:
        AutoTokenizer.from_pretrained(name)
        AutoModelForSequenceClassification.from_pretrained(name)
        print(f"[{label}] OK in {time.time() - t0:.1f}s", flush=True)
        return True
    except Exception as exc:
        print(f"[{label}] FAILED: {type(exc).__name__}: {exc}", flush=True)
        return False


def fetch_embeddings(name: str) -> bool:
    from sentence_transformers import SentenceTransformer

    print(f"\n[embeddings] {name}", flush=True)
    t0 = time.time()
    try:
        SentenceTransformer(name)
        print(f"[embeddings] OK in {time.time() - t0:.1f}s", flush=True)
        return True
    except Exception as exc:
        print(f"[embeddings] FAILED: {type(exc).__name__}: {exc}", flush=True)
        return False


def main() -> int:
    from config import (
        SENTIMENT_MODEL,
        EMOTION_MODEL,
        SARCASM_MODEL,
        TOXICITY_MODEL,
        EMBEDDING_MODEL,
    )

    results = {
        "sentiment": fetch_classifier(SENTIMENT_MODEL, "sentiment"),
        "emotion": fetch_classifier(EMOTION_MODEL, "emotion"),
        "sarcasm": fetch_classifier(SARCASM_MODEL, "sarcasm"),
        "toxicity": fetch_classifier(TOXICITY_MODEL, "toxicity"),
        "embeddings": fetch_embeddings(EMBEDDING_MODEL),
    }

    print("\n=== SUMMARY ===", flush=True)
    for name, ok in results.items():
        print(f"  {name:12s} {'OK' if ok else 'FAILED'}", flush=True)

    failed = [n for n, ok in results.items() if not ok]
    if failed:
        print(f"\n{len(failed)} model(s) failed: {', '.join(failed)}", flush=True)
        return 1

    print("=== ALL MODELS CACHED ===", flush=True)
    return 0


# REQUIRED on Windows. sentence-transformers and tokenizers can spawn worker
# processes, and Windows spawn re-imports the __main__ module in each child.
# Without this guard every child re-ran the whole download, producing several
# interleaved copies of the output and racing on the HuggingFace cache.
if __name__ == "__main__":
    sys.exit(main())
