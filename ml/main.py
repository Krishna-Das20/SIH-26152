"""
FastAPI application for the NLP Analysis Pipeline.

Endpoints:
    POST /analyze          — analyse one social content item
    POST /analyze/batch    — analyse a list of items
    POST /analyze/reddit   — Reddit-specific batch analysis
    GET  /health           — service health check
    GET  /models           — list loaded models
"""

from __future__ import annotations

import logging
import sys
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS, API_HOST, API_PORT, LOG_LEVEL
from config import SENTIMENT_MODEL, EMOTION_MODEL, SARCASM_MODEL, TOXICITY_MODEL, EMBEDDING_MODEL, DEVICE

from schemas.social import (
    SocialContent,
    BatchAnalysisRequest,
    RedditAnalysisRequest,
    RedditAnalysisResponse,
    ContentAnalysisResult,
    HealthResponse,
    ModelsResponse,
)

from pipeline import NLPAnalysisPipeline

# ── Logging ───────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("ml.main")

# ── Pipeline singleton ────────────────────────────────────────────
pipeline = NLPAnalysisPipeline()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load all models once at startup."""
    logger.info("🚀  NLP Pipeline starting — loading models …")
    t0 = time.time()
    pipeline.load_models()
    logger.info("✅  All models loaded in %.1f s", time.time() - t0)
    yield
    logger.info("🛑  NLP Pipeline shutting down.")


app = FastAPI(
    title="SIH26-26152 NLP Analysis Pipeline",
    description="AI-driven social media NLP service for the Smart India Hackathon project.",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════════════
#  ENDPOINTS
# ══════════════════════════════════════════════════════════════════


@app.get("/health", response_model=HealthResponse)
async def health():
    """Service health check."""
    return HealthResponse(
        status="ok",
        device=DEVICE,
        models_loaded=pipeline.models_loaded_count,
    )


@app.get("/models", response_model=ModelsResponse)
async def models():
    """Return the names of currently configured models."""
    return ModelsResponse(
        sentiment=SENTIMENT_MODEL,
        emotion=EMOTION_MODEL,
        sarcasm=SARCASM_MODEL,
        toxicity=TOXICITY_MODEL,
        embeddings=EMBEDDING_MODEL,
        device=DEVICE,
    )


@app.post("/analyze", response_model=ContentAnalysisResult)
async def analyze_single(content: SocialContent):
    """Analyse a single social content item."""
    try:
        result = pipeline.analyze(content)
        return result
    except Exception as exc:
        logger.exception("Error analysing single item")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/analyze/batch", response_model=RedditAnalysisResponse)
async def analyze_batch(req: BatchAnalysisRequest):
    """Analyse a batch of social content items."""
    try:
        t0 = time.time()
        response = pipeline.analyze_batch(req.items)
        elapsed = time.time() - t0
        logger.info(
            "Batch analysis: %d items in %.2f s (%.1f items/s)",
            len(req.items),
            elapsed,
            len(req.items) / max(elapsed, 0.001),
        )
        return response
    except Exception as exc:
        logger.exception("Error in batch analysis")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/analyze/reddit", response_model=RedditAnalysisResponse)
async def analyze_reddit(req: RedditAnalysisRequest):
    """Analyse Reddit-specific normalised data."""
    try:
        t0 = time.time()
        response = pipeline.analyze_batch(req.posts)
        response.platform = "reddit"
        elapsed = time.time() - t0
        logger.info(
            "Reddit analysis: %d items in %.2f s (%.1f items/s)",
            len(req.posts),
            elapsed,
            len(req.posts) / max(elapsed, 0.001),
        )
        return response
    except Exception as exc:
        logger.exception("Error in Reddit analysis")
        raise HTTPException(status_code=500, detail=str(exc))


# ── Run directly ──────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=API_HOST,
        port=API_PORT,
        reload=True,
        log_level=LOG_LEVEL.lower(),
    )
