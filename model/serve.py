"""
serve.py — FastAPI server that exposes the PyTorch recipe recommender
as a drop-in replacement for the Anthropic Claude ai_service.py endpoint.

Endpoints
---------
POST /recommend
    Body:  { "ingredients": ["tomatoes", "onions", "eggs"],
              "cuisine": "Italian",       (optional)
              "experience": "Beginner",   (optional)
              "top_k": 5 }               (optional)
    Returns: list[Recipe]  — same schema as the existing EcoBite backend

POST /health
GET  /health

Run
---
    cd model
    uvicorn serve:app --host 0.0.0.0 --port 8001 --reload

Then point the EcoBite backend at http://localhost:8001 by setting:
    MODEL_SERVER_URL=http://localhost:8001
in backend/.env and updating backend/app/services/ai_service.py
(see the integration notes at the bottom of this file).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from inference.predictor import RecipePredictor


# ── Schemas (match the existing EcoBite Recipe pydantic schema) ───────────────

class RecommendRequest(BaseModel):
    ingredients:  List[str]
    cuisine:      Optional[str] = None
    experience:   Optional[str] = None   # Beginner / Intermediate / Advanced
    top_k:        Optional[int] = 5


class Recipe(BaseModel):
    id:                  str
    name:                str
    description:         str
    cookTime:            str
    servings:            int
    difficulty:          str
    ingredients:         List[str]
    missingIngredients:  List[str]
    instructions:        List[str]
    imageUrl:            Optional[str] = None


# ── App lifecycle ─────────────────────────────────────────────────────────────

predictor: Optional[RecipePredictor] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global predictor
    try:
        predictor = RecipePredictor()
        print("RecipePredictor loaded successfully.")
    except FileNotFoundError as e:
        print(f"WARNING: Could not load predictor — {e}")
        print("Run training and build_index.py first.")
        predictor = None
    yield
    predictor = None


app = FastAPI(
    title="EcoBite Recipe Recommender",
    description="PyTorch-powered ingredient-to-recipe matching",
    version="1.0.0",
    lifespan=lifespan,
)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
@app.post("/health")
def health():
    return {
        "status": "ok" if predictor is not None else "model_not_loaded",
        "model":  "EcoBite RecipeRecommender v1",
    }


@app.post("/recommend", response_model=List[Recipe])
def recommend(req: RecommendRequest):
    if predictor is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Run training first.",
        )

    if not req.ingredients:
        raise HTTPException(status_code=400, detail="ingredients list is empty")

    # Map user experience to difficulty filter
    difficulty_map = {
        "beginner":     "Easy",
        "intermediate": "Medium",
        "advanced":     None,   # show all
        "expert":       None,
    }
    diff_filter = difficulty_map.get(
        (req.experience or "").lower(), None
    )

    results = predictor.predict(
        ingredients       = req.ingredients,
        top_k             = req.top_k or 5,
        cuisine_filter    = req.cuisine,
        difficulty_filter = diff_filter,
    )

    # Strip internal debug fields before returning
    cleaned = []
    for r in results:
        r.pop("_score", None)
        cleaned.append(Recipe(**r))

    return cleaned


# ── Integration notes ─────────────────────────────────────────────────────────
#
# To swap out Claude in backend/app/services/ai_service.py, replace the
# generate_recipes() function body with:
#
#   import httpx, os
#   from typing import List
#   from ..schemas.recipe import Recipe
#
#   MODEL_SERVER = os.getenv("MODEL_SERVER_URL", "http://localhost:8001")
#
#   async def generate_recipes(
#       ingredients: List[str],
#       user_cuisine: str = None,
#       user_experience: str = None,
#   ) -> List[Recipe]:
#       async with httpx.AsyncClient(timeout=30) as client:
#           resp = await client.post(
#               f"{MODEL_SERVER}/recommend",
#               json={
#                   "ingredients": ingredients,
#                   "cuisine":     user_cuisine,
#                   "experience":  user_experience,
#                   "top_k":       5,
#               },
#           )
#           resp.raise_for_status()
#           return [Recipe(**r) for r in resp.json()]
#
# ─────────────────────────────────────────────────────────────────────────────


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("serve:app", host="0.0.0.0", port=8001, reload=False)
