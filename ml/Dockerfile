# Python ML service for SIH26-26152.
#
# This cannot run on Vercel: it loads several GB of transformer weights and
# holds them resident between requests, which a serverless function cannot do.
# Deploy this image to any host that gives you a persistent container
# (Render, Railway, Fly.io, HuggingFace Spaces, or a plain VM).

FROM python:3.11-slim

# Model weights are baked into the image at build time so the first request
# after a deploy is fast, and so the container does not need outbound access
# to HuggingFace at runtime.
ENV HF_HOME=/models \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Build tools are needed for hdbscan/numba wheels on slim images.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl \
    && rm -rf /var/lib/apt/lists/*

# Dependencies first, so code edits do not invalidate the (large) pip layer.
COPY requirements.txt .

# CPU-only torch. The default PyPI wheel pulls ~2.5 GB of CUDA libraries that
# are dead weight on a CPU host.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

# Pre-download the weights into the image.
RUN python download_models.py || echo "Model prefetch incomplete; will download at runtime."

RUN apt-get purge -y build-essential && apt-get autoremove -y

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

# Single worker: each worker loads its own full copy of the model weights, so
# replicas belong at the container level, not the process level.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
