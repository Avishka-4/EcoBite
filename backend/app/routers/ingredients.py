from fastapi import APIRouter, Depends, UploadFile, File
from app.deps import get_optional_current_user
from app.models.user import User
from app.schemas.recipe import IngredientDetectResponse
from app.services.vosk_service import detect_ingredients_from_voice, is_vosk_available

router = APIRouter(prefix="/ingredients", tags=["ingredients"])


@router.post("/voice-detect", response_model=IngredientDetectResponse)
async def detect_from_voice(
    file: UploadFile = File(...),
    current_user: User | None = Depends(get_optional_current_user),
):
    audio_bytes = await file.read()
    ingredients, confidence = await detect_ingredients_from_voice(audio_bytes)
    return IngredientDetectResponse(
        ingredients=ingredients,
        confidence=confidence,
        model_available=is_vosk_available(),
    )
