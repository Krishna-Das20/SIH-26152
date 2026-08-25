# NLP Analysis Pipeline — ML Service

> **SIH26-26152** | AI-Driven Social Media Analytics Framework  
> Python ML micro-service for Reddit (and future multi-platform) NLP analysis.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js Dashboard                            │
│           (existing frontend — NOT modified)                    │
│                         │                                       │
│              POST /analyze/reddit                               │
│              (normalized SocialContent[])                        │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Python ML Service (FastAPI)                     │
│                                                                 │
│  ┌───────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐ │
│  │Preprocess │→│ Language │→│Sentiment │→│   Emotion     │ │
│  │(clean)    │  │Detection │  │Analysis  │  │  Detection    │ │
│  └───────────┘  └──────────┘  └──────────┘  └───────────────┘ │
│       │                                                         │
│  ┌───────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐ │
│  │ Sarcasm   │→│Toxicity  │→│Embeddings│→│  Keywords     │ │
│  │Detection  │  │Detection │  │(internal)│  │  (KeyBERT)    │ │
│  └───────────┘  └──────────┘  └──────────┘  └───────────────┘ │
│       │                                                         │
│  ┌───────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐ │
│  │  Topics   │→│ Trends   │→│ Timeline │→│   Summary     │ │
│  │(BERTopic) │  │Detection │  │ Analysis │  │ (Executive)   │ │
│  └───────────┘  └──────────┘  └──────────┘  └───────────────┘ │
│                                                                 │
│           → Structured JSON Response                            │
└─────────────────────────────────────────────────────────────────┘
```

## ML Models Used

| Task | Model | Source |
|---|---|---|
| Sentiment Analysis | `cardiffnlp/twitter-roberta-base-sentiment-latest` | HuggingFace |
| Emotion Detection | `SamLowe/roberta-base-go_emotions` | HuggingFace |
| Sarcasm Detection | `mrm8488/distilroberta-finetuned-sarcasm` | HuggingFace |
| Toxicity Detection | `unitary/toxic-bert` | HuggingFace |
| Embeddings | `all-MiniLM-L6-v2` | sentence-transformers |
| Keywords | KeyBERT | Uses embedding model |
| Topics | BERTopic + HDBSCAN | Uses embedding model |
| Language | `langdetect` | Python library |

---

## Quick Start

### 1. Create Python Environment

```bash
cd ml
python -m venv venv

# Windows
venv\Scripts\activate

# Linux / macOS
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

> **Note:** First install downloads ~2–3 GB of pretrained models from HuggingFace.  
> Subsequent starts use the cached models (~30 s startup on CPU).

### 3. Configure Environment

```bash
copy .env.example .env
# Edit .env if you need to override defaults
```

### 4. Start the Service

```bash
# Option A: Using uvicorn directly
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Option B: Using Python
python main.py
```

### 5. Verify Health

```bash
curl http://localhost:8000/health
```

Expected:
```json
{
  "status": "ok",
  "device": "cpu",
  "models_loaded": 6
}
```

### 6. Check Models

```bash
curl http://localhost:8000/models
```

---

## API Endpoints

### `GET /health`
Health check. Returns `{"status": "ok"}`.

### `GET /models`
Lists all configured ML models and device.

### `POST /analyze`
Analyse a single social content item.

**Request:**
```json
{
  "platform": "reddit",
  "content_id": "abc123",
  "text": "This new AI model is actually insane!",
  "timestamp": "2026-08-25T10:30:00Z",
  "content_type": "post",
  "likes": 150,
  "comments": 32
}
```

### `POST /analyze/batch`
Analyse multiple items. Body: `{"items": [...]}`.

### `POST /analyze/reddit`
Reddit-specific batch analysis. Body: `{"posts": [...]}`.

**Full Response Example:**
```json
{
  "platform": "reddit",
  "total_items": 25,
  "results": [
    {
      "content_id": "post_001",
      "sentiment": {"label": "positive", "positive": 0.91, "negative": 0.03, "neutral": 0.06, "confidence": 0.91},
      "emotion": {"joy": 0.72, "anger": 0.04, "dominant_emotion": "joy"},
      "sarcasm": {"is_sarcastic": false, "confidence": 0.12},
      "toxicity": {"is_toxic": false, "toxicity": 0.02},
      "keywords": ["AI", "model", "insane", "breakthrough"]
    }
  ],
  "topics": [
    {"topic_id": 0, "topic_name": "AI, coding, agents", "keywords": ["AI", "coding", "agents"], "num_posts": 8}
  ],
  "trends": [
    {"topic": "AI agents", "current_mentions": 12, "growth_percentage": 118.0, "trend_score": 91.4, "status": "rising"}
  ],
  "timeline": [
    {"timestamp": "2026-08-25T10:00:00Z", "positive": 0.61, "negative": 0.24, "neutral": 0.15}
  ],
  "summary": {
    "total_posts": 15,
    "total_comments": 10,
    "positive_percentage": 54.2,
    "negative_percentage": 27.8,
    "neutral_percentage": 18.0,
    "dominant_emotion": "excitement",
    "top_topic": "AI, coding, agents",
    "rising_topic": "AI agents",
    "average_engagement": 128.4
  }
}
```

---

## Input Schema

```json
{
  "platform": "reddit",
  "content_id": "abc123",
  "author_id": "user123",
  "text": "The actual post or comment text",
  "timestamp": "2026-08-25T10:30:00Z",
  "content_type": "post",
  "likes": 150,
  "comments": 32,
  "shares": 0,
  "views": 2000,
  "parent_id": null,
  "community": "technology",
  "url": "https://reddit.com/..."
}
```

All fields except `platform` and `content_id` are optional. Missing text triggers `skipped=true`.

---

## How to Change Models

Edit `ml/config.py` or set environment variables:

```bash
# In .env
SENTIMENT_MODEL=nlptown/bert-base-multilingual-uncased-sentiment
EMOTION_MODEL=bhadresh-savani/distilbert-base-uncased-emotion
EMBEDDING_MODEL=all-mpnet-base-v2
```

---

## CPU vs GPU

The service auto-detects CUDA GPUs. To force CPU:

```bash
# In .env
DEVICE=cpu
```

GPU provides ~5-10x speedup for batch inference.

---

## Running Tests

```bash
cd ml
pytest tests/ -v
```

To run only preprocessing tests (fast, no model loading):
```bash
pytest tests/test_preprocessing.py -v
```

---

## Project Structure

```
ml/
├── main.py                    # FastAPI application
├── config.py                  # Central configuration
├── requirements.txt           # Python dependencies
├── .env.example               # Environment template
├── README.md                  # This file
│
├── schemas/
│   └── social.py              # Pydantic input/output models
│
├── preprocessing/
│   ├── cleaner.py             # Reddit-specific text cleaning
│   └── language.py            # Language detection
│
├── sentiment/
│   └── analyzer.py            # Transformer sentiment analysis
│
├── emotion/
│   └── analyzer.py            # Multi-class emotion detection
│
├── sarcasm/
│   └── detector.py            # Sarcasm classification
│
├── toxicity/
│   └── detector.py            # Multi-label toxicity detection
│
├── embeddings/
│   └── encoder.py             # Sentence-transformer embeddings
│
├── topics/
│   └── topic_model.py         # BERTopic + KeyBERT fallback
│
├── trends/
│   └── detector.py            # Trend scoring and detection
│
├── pipeline/
│   └── nlp_pipeline.py        # End-to-end orchestrator
│
├── data/
│   └── sample_reddit.json     # 25 sample records (TESTING ONLY)
│
├── tests/
│   ├── test_preprocessing.py
│   ├── test_sentiment.py
│   ├── test_emotion.py
│   ├── test_api.py
│   └── test_batch.py
│
└── integration/
    └── nextjs_example.ts      # TypeScript integration example
```

---

## Connecting to Next.js

Set in the Next.js `.env`:
```
ML_API_URL=http://localhost:8000
```

See `ml/integration/nextjs_example.ts` for a complete TypeScript client example.

---

## Limitations

- **First startup** downloads ~2–3 GB of models (cached thereafter)
- **CPU-only** inference is slower (~5–15 s for 100 items)
- **BERTopic** needs ≥10 documents for meaningful topics; falls back to KeyBERT
- **Sarcasm model** may not load on all environments; gracefully returns `model_available: false`
- Optimised primarily for **English** content
- No persistent storage — results are returned per-request (stateless)
