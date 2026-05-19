from fastapi import APIRouter, Depends, UploadFile, File
from app.deps import get_current_user
from app.models.user import User
from app.schemas.recipe import IngredientDetectResponse
from app.services.yolo_service import detect_ingredients, is_model_available

router = APIRouter(prefix="/ingredients", tags=["ingredients"])


@router.post("/detect", response_model=IngredientDetectResponse)
async def detect_from_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    image_bytes = await file.read()
    ingredients, confidence = await detect_ingredients(image_bytes)
    return IngredientDetectResponse(
        ingredients=ingredients,
        confidence=confidence,
        model_available=is_model_available(),
    )
