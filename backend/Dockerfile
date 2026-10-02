# ── Stage 1: dependency builder ───────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /build

# Only gcc needed for compiling native extensions (cryptography, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends gcc && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 2: lean runtime image ───────────────────────────────────────────────
FROM python:3.12-slim

# Install curl for ECS container health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Non-root user for security
RUN useradd --create-home --shell /bin/bash appuser

WORKDIR /app

# Copy only the installed packages from the builder
COPY --from=builder /install /usr/local

# Copy application code
COPY . .

# Remove dev/test artifacts and local .env so secrets come from ECS env vars
RUN rm -f .env .env.example ecobite.db

# Ensure non-root user owns the app directory
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Single worker is fine for Fargate — scale by adding tasks, not threads.
# --no-access-log reduces noise; CloudWatch captures container stdout anyway.
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "2", \
     "--no-access-log"]
