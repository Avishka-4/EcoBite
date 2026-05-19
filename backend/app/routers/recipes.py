from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List
from app.deps import get_db, get_current_user
from app.models.user import User
from app.models.recipe import SavedRecipe
from app.schemas.recipe import RecipeGenerateRequest, Recipe, SaveRecipeRequest, SavedRecipeResponse
from app.services.ai_service import generate_recipes

router = APIRouter(prefix="/recipes", tags=["recipes"])


@router.post("/generate", response_model=List[Recipe])
async def generate(
    request: RecipeGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    cuisine = request.cuisine or current_user.preferred_cuisine or "Italian"
    experience = request.experience_level or current_user.cooking_experience or "beginner"

    recipes = await generate_recipes(
        ingredients=request.ingredients,
        cuisine=cuisine,
        experience_level=experience,
        count=request.count or 3,
    )
    return recipes


@router.get("/saved", response_model=List[SavedRecipeResponse])
async def get_saved(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SavedRecipe).where(SavedRecipe.user_id == current_user.id)
    )
    saved = result.scalars().all()
    return [SavedRecipeResponse(id=s.id, recipe=Recipe(**s.recipe_data)) for s in saved]


@router.post("/saved", response_model=SavedRecipeResponse, status_code=201)
async def save_recipe(
    request: SaveRecipeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SavedRecipe).where(
            and_(
                SavedRecipe.user_id == current_user.id,
                SavedRecipe.recipe_id == request.recipe.id,
            )
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Recipe already saved")

    saved = SavedRecipe(
        user_id=current_user.id,
        recipe_id=request.recipe.id,
        recipe_data=request.recipe.model_dump(),
    )
    db.add(saved)
    await db.commit()
    await db.refresh(saved)
    return SavedRecipeResponse(id=saved.id, recipe=request.recipe)


@router.delete("/saved/{recipe_id}")
async def unsave_recipe(
    recipe_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SavedRecipe).where(
            and_(
                SavedRecipe.user_id == current_user.id,
                SavedRecipe.recipe_id == recipe_id,
            )
        )
    )
    saved = result.scalar_one_or_none()
    if not saved:
        raise HTTPException(status_code=404, detail="Saved recipe not found")

    await db.delete(saved)
    await db.commit()
    return {"message": "Recipe removed from saved"}
