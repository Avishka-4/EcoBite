from pydantic import BaseModel
from typing import List, Optional


class Recipe(BaseModel):
    id: str
    name: str
    description: str
    cookTime: str
    servings: int
    difficulty: str
    ingredients: List[str]
    missingIngredients: List[str]
    instructions: List[str]
    imageUrl: str


class RecipeGenerateRequest(BaseModel):
    ingredients: List[str]
    cuisine: Optional[str] = None
    experience_level: Optional[str] = "beginner"
    count: Optional[int] = 3


class SaveRecipeRequest(BaseModel):
    recipe: Recipe


class SavedRecipeResponse(BaseModel):
    id: int
    recipe: Recipe

    model_config = {"from_attributes": True}


class IngredientDetectResponse(BaseModel):
    ingredients: List[str]
    confidence: float
    model_available: bool
