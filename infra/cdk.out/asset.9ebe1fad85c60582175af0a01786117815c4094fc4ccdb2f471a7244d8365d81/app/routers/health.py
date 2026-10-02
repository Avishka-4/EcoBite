"""
routers/health.py — Deployment health-check endpoints.

  GET /health        — liveness probe (always fast, no external calls)
  GET /health/aws    — readiness probe: credentials + S3 + Rekognition
                       + Transcribe + Bedrock (all concurrent)
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings
from app.services.s3_service import ping_s3
from app.services.aws_rekognition_service import ping_rekognition
from app.services.aws_transcribe_service import ping_transcribe
from app.services.ai_service import ping_bedrock

log = logging.getLogger(__name__)
router = APIRouter(tags=["health"])


# ── Response schemas ──────────────────────────────────────────────────────────

class ServiceCheck(BaseModel):
    ok: bool
    detail: str


class AwsHealthResponse(BaseModel):
    status: str               # "healthy" | "degraded" | "unhealthy"
    credentials_configured: bool
    s3: ServiceCheck
    rekognition: ServiceCheck
    transcribe: ServiceCheck
    bedrock: ServiceCheck
    cloudfront_configured: bool
    duration_ms: float


# ── Liveness ──────────────────────────────────────────────────────────────────

@router.get("/health", summary="Liveness probe")
async def liveness() -> dict[str, Any]:
    """Returns 200 immediately — use for container liveness checks."""
    return {"status": "ok", "version": "1.0.0"}


# ── Readiness ─────────────────────────────────────────────────────────────────

@router.get("/health/aws", response_model=AwsHealthResponse, summary="AWS readiness probe")
async def aws_health() -> AwsHealthResponse:
    """
    Probes all four AWS services concurrently:
    S3 · Rekognition · Transcribe · Bedrock

    status: healthy   = all pass
            degraded  = credentials ok but ≥1 service unreachable
            unhealthy = credentials not configured
    """
    start = time.monotonic()

    credentials_configured = bool(
        settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY
    )

    if not credentials_configured:
        elapsed = (time.monotonic() - start) * 1000
        not_cfg = ServiceCheck(ok=False, detail="Credentials not configured.")
        return AwsHealthResponse(
            status="unhealthy",
            credentials_configured=False,
            s3=not_cfg,
            rekognition=not_cfg,
            transcribe=not_cfg,
            bedrock=not_cfg,
            cloudfront_configured=bool(settings.CLOUDFRONT_DOMAIN),
            duration_ms=round(elapsed, 2),
        )

    s3_ok, rek_ok, tr_ok, bdr_ok = await asyncio.gather(
        _check_s3(),
        _check_rekognition(),
        _check_transcribe(),
        _check_bedrock(),
    )

    elapsed = (time.monotonic() - start) * 1000
    all_ok = s3_ok.ok and rek_ok.ok and tr_ok.ok and bdr_ok.ok
    status = "healthy" if all_ok else "degraded"

    log.info(
        "AWS health %.0f ms — %s | s3=%s rek=%s tr=%s bdr=%s cf=%s",
        elapsed, status, s3_ok.ok, rek_ok.ok, tr_ok.ok, bdr_ok.ok,
        bool(settings.CLOUDFRONT_DOMAIN),
    )

    return AwsHealthResponse(
        status=status,
        credentials_configured=True,
        s3=s3_ok,
        rekognition=rek_ok,
        transcribe=tr_ok,
        bedrock=bdr_ok,
        cloudfront_configured=bool(settings.CLOUDFRONT_DOMAIN),
        duration_ms=round(elapsed, 2),
    )


# ── Individual service checkers ───────────────────────────────────────────────

async def _check_s3() -> ServiceCheck:
    try:
        ok = await ping_s3()
        return ServiceCheck(
            ok=ok,
            detail=(
                f"Bucket '{settings.S3_BUCKET_NAME}' is accessible."
                if ok else
                f"Bucket '{settings.S3_BUCKET_NAME}' unreachable. "
                "Check bucket name, region, and IAM s3:HeadBucket permission."
            ),
        )
    except Exception as exc:
        return ServiceCheck(ok=False, detail=f"Unexpected error: {type(exc).__name__}")


async def _check_rekognition() -> ServiceCheck:
    try:
        ok = await ping_rekognition()
        return ServiceCheck(
            ok=ok,
            detail=(
                f"Rekognition reachable (region={settings.AWS_REGION})."
                if ok else
                f"Rekognition unreachable in '{settings.AWS_REGION}'. "
                "Check IAM rekognition:ListCollections permission."
            ),
        )
    except Exception as exc:
        return ServiceCheck(ok=False, detail=f"Unexpected error: {type(exc).__name__}")


async def _check_transcribe() -> ServiceCheck:
    try:
        ok = await ping_transcribe()
        return ServiceCheck(
            ok=ok,
            detail=(
                f"Transcribe reachable "
                f"(region={settings.AWS_REGION}, lang={settings.TRANSCRIBE_LANGUAGE_CODE})."
                if ok else
                f"Transcribe unreachable in '{settings.AWS_REGION}'. "
                "Check IAM transcribe:ListVocabularies permission."
            ),
        )
    except Exception as exc:
        return ServiceCheck(ok=False, detail=f"Unexpected error: {type(exc).__name__}")


async def _check_bedrock() -> ServiceCheck:
    try:
        if not settings.BEDROCK_MODEL_ID:
            return ServiceCheck(ok=False, detail="BEDROCK_MODEL_ID not configured.")
        ok = await ping_bedrock()
        region = settings.BEDROCK_REGION or settings.AWS_REGION
        return ServiceCheck(
            ok=ok,
            detail=(
                f"Bedrock reachable (region={region}, model={settings.BEDROCK_MODEL_ID})."
                if ok else
                f"Bedrock unreachable in '{region}'. "
                "Check IAM bedrock:InvokeModel / bedrock:ListFoundationModels permission."
            ),
        )
    except Exception as exc:
        return ServiceCheck(ok=False, detail=f"Unexpected error: {type(exc).__name__}")
