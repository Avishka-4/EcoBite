"""
routers/ingredients.py — Ingredient detection endpoints.

Endpoints
---------
  POST /api/v1/ingredients/voice-detect   — detect ingredients from speech audio
                                            (AWS Transcribe Streaming)
  POST /api/v1/ingredients/image-detect   — detect ingredients from a food photo
                                            (AWS Rekognition DetectLabels)
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from app.deps import get_optional_current_user
from app.models.user import User
from app.schemas.recipe import IngredientDetectResponse
from app.services.aws_transcribe_service import (
    detect_ingredients_from_voice,
    is_transcribe_available,
)
from app.services.aws_rekognition_service import (
    detect_ingredients_from_image,
    is_rekognition_available,
)

router = APIRouter(prefix="/ingredients", tags=["ingredients"])

# Accepted audio MIME types
ALLOWED_AUDIO_TYPES = {
    "audio/wav",
    "audio/wave",
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
    "audio/mpeg",
    "audio/mp3",
    "application/octet-stream",  # some browsers send this for WebM blobs
}

# Accepted image MIME types
ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}

MAX_AUDIO_SIZE = 10 * 1024 * 1024   # 10 MB
MAX_IMAGE_SIZE = 10 * 1024 * 1024   # 10 MB


@router.post("/voice-detect", response_model=IngredientDetectResponse)
async def detect_from_voice(
    file: UploadFile = File(...),
    current_user: User | None = Depends(get_optional_current_user),
):
    """
    Detect food ingredients from a speech audio clip.

    Accepts WAV, WebM, OGG, or MP4 audio.  The audio is transcribed using
    Amazon Transcribe Streaming and the transcript is scanned for ingredient
    names.

    Returns an empty list (not an error) when no ingredients are detected or
    when Transcribe is unavailable — the frontend handles this gracefully.
    """
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported audio type '{content_type}'. "
                f"Accepted: {', '.join(sorted(ALLOWED_AUDIO_TYPES))}."
            ),
        )

    audio_bytes = await file.read()
    if len(audio_bytes) > MAX_AUDIO_SIZE:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Audio file too large ({len(audio_bytes) // (1024 * 1024)} MB). "
                f"Maximum is {MAX_AUDIO_SIZE // (1024 * 1024)} MB."
            ),
        )

    ingredients, confidence = await detect_ingredients_from_voice(audio_bytes)
    return IngredientDetectResponse(
        ingredients=ingredients,
        confidence=confidence,
        model_available=is_transcribe_available(),
    )


@router.post("/image-detect", response_model=IngredientDetectResponse)
async def detect_from_image(
    file: UploadFile = File(...),
    current_user: User | None = Depends(get_optional_current_user),
):
    """
    Detect food ingredients in an uploaded photo using AWS Rekognition.

    Accepts JPEG, PNG, WebP, or GIF images.
    """
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported image type '{content_type}'. "
                f"Accepted: {', '.join(sorted(ALLOWED_IMAGE_TYPES))}."
            ),
        )

    image_bytes = await file.read()
    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Image file too large ({len(image_bytes) // (1024 * 1024)} MB). "
                f"Maximum is {MAX_IMAGE_SIZE // (1024 * 1024)} MB."
            ),
        )

    ingredients, confidence = await detect_ingredients_from_image(image_bytes)
    return IngredientDetectResponse(
        ingredients=ingredients,
        confidence=confidence,
        model_available=is_rekognition_available(),
    )
