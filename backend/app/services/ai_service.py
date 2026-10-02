"""
ai_service.py — EcoBite Recipe Generation Engine

Architecture (two tiers):
─────────────────────────
  Tier 1 — AWS Bedrock (Claude)
      Calls Claude via bedrock:InvokeModel.
      Returns 3–5 fully dynamic, ingredient-matched recipes as structured JSON.
      Active whenever AWS credentials + BEDROCK_MODEL_ID are configured AND
      the model is accessible.

  Tier 2 — Built-in Authentic Cuisine Catalogue
      Zero external dependencies.  Instant fallback if Bedrock is unavailable
      or credentials are not yet configured.
      Covers 8 cuisines: Sri Lankan, Indian, Korean, Chinese,
                         Malaysian, English, American, Italian.

Security notes
──────────────
- AWS credentials are read from settings (env vars) — never hardcoded.
- Claude's raw response is JSON-parsed and validated before returning.
- Any Bedrock error is caught and logged; the catalogue fallback activates
  transparently so the app never returns an empty recipe list.
"""

from __future__ import annotations

import json
import logging
import re
import uuid
from typing import Any, Dict, List, Set

import boto3
from botocore.config import Config as BotocoreConfig
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings

log = logging.getLogger(__name__)

# ── Cuisine default images ────────────────────────────────────────────────────
FOOD_IMAGES: Dict[str, str] = {
    "Italian":    "https://images.unsplash.com/photo-1579113800032-c38bd7635818?w=800",
    "Chinese":    "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800",
    "Indian":     "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800",
    "American":   "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800",
    "Korean":     "https://images.unsplash.com/photo-1583416750470-965b2707b355?w=800",
    "Sri Lankan": "https://images.unsplash.com/photo-1625398407796-82c4b0e31410?w=800",
    "Malaysian":  "https://images.unsplash.com/photo-1567982047351-76b6f93e038d?w=800",
    "English":    "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=800",
    "default":    "https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=800",
}

# ── Built-in recipe catalogue (Tier 2 fallback) ───────────────────────────────
RECIPE_CATALOGUE: Dict[str, List[Dict[str, Any]]] = {
    "Italian": [
        {
            "name": "Classic Tomato Pasta",
            "description": "A simple and delicious Italian pasta with fresh tomato sauce.",
            "cookTime": "25 min", "servings": 2, "difficulty": "Easy",
            "ingredients": ["pasta", "tomatoes", "garlic", "olive oil", "basil", "salt", "black pepper"],
            "missingIngredients": ["basil"],
            "instructions": [
                "Boil salted water and cook pasta until al dente.",
                "Sauté minced garlic in olive oil for 1 minute.",
                "Add chopped tomatoes and simmer for 10 minutes.",
                "Season with salt, pepper, and fresh basil.",
                "Toss pasta with sauce and serve immediately."
            ],
        },
        {
            "name": "Garlic Butter Spaghetti",
            "description": "Quick and flavourful spaghetti tossed in garlic butter.",
            "cookTime": "20 min", "servings": 2, "difficulty": "Easy",
            "ingredients": ["pasta", "garlic", "butter", "parsley", "parmesan cheese", "salt", "black pepper"],
            "missingIngredients": ["parsley", "parmesan cheese"],
            "instructions": [
                "Cook spaghetti in salted boiling water until al dente.",
                "Melt butter in a pan and sauté garlic until golden.",
                "Add cooked pasta to the pan and toss well.",
                "Top with parsley and parmesan before serving."
            ],
        },
        {
            "name": "Caprese Salad",
            "description": "Fresh and vibrant Italian salad with tomatoes and cheese.",
            "cookTime": "10 min", "servings": 2, "difficulty": "Easy",
            "ingredients": ["tomatoes", "cheese", "basil", "olive oil", "salt", "black pepper"],
            "missingIngredients": ["mozzarella cheese"],
            "instructions": [
                "Slice tomatoes and mozzarella into rounds.",
                "Alternate slices on a plate.",
                "Scatter fresh basil leaves.",
                "Drizzle with olive oil and season with salt and pepper."
            ],
        },
    ],
    "Indian": [
        {
            "name": "Masala Scrambled Eggs",
            "description": "Spicy Indian-style scrambled eggs with onions and tomatoes.",
            "cookTime": "15 min", "servings": 2, "difficulty": "Easy",
            "ingredients": ["eggs", "onions", "tomatoes", "garlic", "ginger", "cumin", "turmeric", "cooking oil", "salt"],
            "missingIngredients": [],
            "instructions": [
                "Heat oil and sauté onions until golden.",
                "Add garlic, ginger, cumin, and turmeric; cook 1 minute.",
                "Add tomatoes and cook until soft.",
                "Beat eggs and pour into pan; scramble gently.",
                "Season with salt and serve hot with bread."
            ],
        },
        {
            "name": "Vegetable Dal",
            "description": "Comforting red lentil dal with aromatic spices.",
            "cookTime": "35 min", "servings": 3, "difficulty": "Medium",
            "ingredients": ["lentils", "tomatoes", "onions", "garlic", "ginger", "turmeric", "cumin", "cooking oil", "salt"],
            "missingIngredients": ["red lentils"],
            "instructions": [
                "Rinse lentils and boil with turmeric until soft (20 min).",
                "Heat oil, sauté onions until golden.",
                "Add garlic, ginger and cumin; cook 2 minutes.",
                "Add tomatoes and cook until mushy.",
                "Combine with lentils, simmer 5 minutes and season."
            ],
        },
        {
            "name": "Potato Sabzi",
            "description": "Dry spiced potatoes — a classic Indian side dish.",
            "cookTime": "30 min", "servings": 2, "difficulty": "Easy",
            "ingredients": ["potatoes", "onions", "garlic", "cumin", "turmeric", "cooking oil", "salt"],
            "missingIngredients": [],
            "instructions": [
                "Dice potatoes and parboil for 5 minutes.",
                "Heat oil and add cumin seeds until they splutter.",
                "Add onions and garlic; sauté until soft.",
                "Add potatoes, turmeric and salt; cook on medium heat 15 min.",
                "Stir occasionally until potatoes are golden."
            ],
        },
    ],
    "Chinese": [
        {
            "name": "Egg Fried Rice",
            "description": "Classic Chinese fried rice with eggs and vegetables.",
            "cookTime": "20 min", "servings": 2, "difficulty": "Easy",
            "ingredients": ["rice", "eggs", "onions", "garlic", "soy sauce", "cooking oil", "salt"],
            "missingIngredients": [],
            "instructions": [
                "Cook rice and let it cool completely.",
                "Beat eggs and scramble in hot oiled wok; set aside.",
                "Stir-fry garlic and onions until fragrant.",
                "Add cold rice and stir-fry on high heat 3 minutes.",
                "Add eggs back, splash soy sauce, and toss well."
            ],
        },
        {
            "name": "Garlic Stir-fried Vegetables",
            "description": "Quick and healthy Chinese-style mixed vegetables.",
            "cookTime": "15 min", "servings": 2, "difficulty": "Easy",
            "ingredients": ["broccoli", "carrots", "garlic", "soy sauce", "cooking oil", "salt"],
            "missingIngredients": ["oyster sauce"],
            "instructions": [
                "Blanch broccoli and carrots in boiling water 2 minutes.",
                "Heat wok with oil on high heat.",
                "Add garlic and stir-fry 30 seconds.",
                "Add vegetables and stir-fry 3 minutes.",
                "Season with soy sauce and serve immediately."
            ],
        },
        {
            "name": "Tomato Egg Stir-fry",
            "description": "A beloved Chinese home-cook classic.",
            "cookTime": "15 min", "servings": 2, "difficulty": "Easy",
            "ingredients": ["tomatoes", "eggs", "garlic", "cooking oil", "salt", "sugar"],
            "missingIngredients": [],
            "instructions": [
                "Beat eggs with a pinch of salt.",
                "Scramble eggs in hot oiled wok; set aside.",
                "In same wok, sauté garlic then add tomatoes.",
                "Cook tomatoes until they release juice.",
                "Add eggs back, season with salt and sugar, serve."
            ],
        },
    ],
    "American": [
        {
            "name": "Classic Beef Burger",
            "description": "Juicy homemade beef burger with all the fixings.",
            "cookTime": "25 min", "servings": 2, "difficulty": "Easy",
            "ingredients": ["beef", "onions", "garlic", "salt", "black pepper", "bread"],
            "missingIngredients": ["burger buns", "lettuce", "cheddar cheese"],
            "instructions": [
                "Mix beef with garlic, salt, and pepper; form patties.",
                "Cook patties on high heat 3-4 min per side.",
                "Toast buns lightly.",
                "Assemble with lettuce, cheese, and onion.",
                "Serve immediately."
            ],
        },
        {
            "name": "Scrambled Egg Toast",
            "description": "Creamy scrambled eggs on toasted bread.",
            "cookTime": "10 min", "servings": 1, "difficulty": "Easy",
            "ingredients": ["eggs", "butter", "bread", "salt", "black pepper"],
            "missingIngredients": [],
            "instructions": [
                "Beat eggs with salt and pepper.",
                "Melt butter in pan on low-medium heat.",
                "Add eggs and stir slowly until just set.",
                "Toast bread.",
                "Pile eggs on toast and serve."
            ],
        },
        {
            "name": "Chicken and Rice Bowl",
            "description": "Simple and satisfying American-style chicken rice bowl.",
            "cookTime": "30 min", "servings": 2, "difficulty": "Easy",
            "ingredients": ["chicken", "rice", "garlic", "onions", "cooking oil", "salt", "black pepper"],
            "missingIngredients": [],
            "instructions": [
                "Cook rice according to package directions.",
                "Season chicken with salt, pepper, and garlic.",
                "Cook chicken in oiled pan until golden and cooked through.",
                "Sauté onions until soft.",
                "Serve chicken over rice with onions."
            ],
        },
    ],
    "Korean": [
        {
            "name": "Korean Egg Rice",
            "description": "Simple Korean comfort food — rice topped with a fried egg.",
            "cookTime": "15 min", "servings": 1, "difficulty": "Easy",
            "ingredients": ["rice", "eggs", "soy sauce", "cooking oil", "salt"],
            "missingIngredients": ["sesame oil", "gochujang"],
            "instructions": [
                "Cook rice and place in bowl.",
                "Fry egg sunny-side up in oil.",
                "Place egg on top of rice.",
                "Drizzle with soy sauce and sesame oil.",
                "Mix and eat."
            ],
        },
        {
            "name": "Gamja Jorim (Braised Potatoes)",
            "description": "Sweet and savoury Korean braised potato side dish.",
            "cookTime": "25 min", "servings": 2, "difficulty": "Easy",
            "ingredients": ["potatoes", "garlic", "soy sauce", "sugar", "cooking oil"],
            "missingIngredients": ["sesame oil", "sesame seeds"],
            "instructions": [
                "Peel and cube potatoes.",
                "Fry potatoes in oil until lightly golden.",
                "Add garlic, soy sauce, sugar and a splash of water.",
                "Simmer on medium until sauce thickens and coats potatoes.",
                "Finish with sesame oil and sesame seeds."
            ],
        },
        {
            "name": "Korean Vegetable Soup",
            "description": "Warming clear broth with vegetables.",
            "cookTime": "30 min", "servings": 2, "difficulty": "Easy",
            "ingredients": ["onions", "garlic", "mushrooms", "soy sauce", "salt"],
            "missingIngredients": ["dried kelp", "green onions"],
            "instructions": [
                "Boil 4 cups water with garlic and kelp 10 minutes.",
                "Remove kelp, add mushrooms and onions.",
                "Season with soy sauce and salt.",
                "Simmer 10 minutes more.",
                "Top with sliced green onions."
            ],
        },
    ],
    "Sri Lankan": [
        {
            "name": "Sri Lankan Coconut Egg Curry",
            "description": "Creamy egg curry cooked in rich coconut milk.",
            "cookTime": "30 min", "servings": 2, "difficulty": "Medium",
            "ingredients": ["eggs", "coconut milk", "onions", "garlic", "curry powder", "turmeric", "cooking oil", "salt"],
            "missingIngredients": ["curry leaves", "pandan leaf"],
            "instructions": [
                "Hard boil eggs and peel.",
                "Sauté onions and garlic in oil until golden.",
                "Add curry powder and turmeric; cook 1 minute.",
                "Pour in coconut milk and bring to gentle simmer.",
                "Add eggs and simmer 10 minutes; season with salt."
            ],
        },
        {
            "name": "Pol Sambol",
            "description": "Fresh Sri Lankan coconut relish.",
            "cookTime": "10 min", "servings": 4, "difficulty": "Easy",
            "ingredients": ["coconut", "onions", "chillies", "lemon", "salt"],
            "missingIngredients": ["desiccated coconut", "Maldive fish"],
            "instructions": [
                "Combine grated coconut, finely chopped onions and chillies.",
                "Add a squeeze of lemon juice.",
                "Season with salt.",
                "Mix well.",
                "Serve as a side with rice or bread."
            ],
        },
    ],
    "Malaysian": [
        {
            "name": "Nasi Goreng",
            "description": "Malaysian fragrant fried rice with chicken and egg.",
            "cookTime": "25 min", "servings": 2, "difficulty": "Medium",
            "ingredients": ["rice", "chicken", "eggs", "onions", "garlic", "soy sauce", "cooking oil", "salt"],
            "missingIngredients": ["shrimp paste", "kecap manis"],
            "instructions": [
                "Cook rice ahead and refrigerate to dry out.",
                "Fry onions and garlic in oil until fragrant.",
                "Add chicken and cook through.",
                "Push to side, scramble eggs in pan.",
                "Add rice, soy sauce, mix everything and stir-fry 3 minutes."
            ],
        },
        {
            "name": "Coconut Chicken Curry",
            "description": "Rich Malaysian-style chicken curry with coconut milk.",
            "cookTime": "40 min", "servings": 3, "difficulty": "Medium",
            "ingredients": ["chicken", "coconut milk", "onions", "garlic", "ginger", "curry powder", "cooking oil", "salt"],
            "missingIngredients": ["lemongrass", "kaffir lime leaves"],
            "instructions": [
                "Sauté onions, garlic and ginger in oil until golden.",
                "Add curry powder and cook 2 minutes.",
                "Add chicken and brown on all sides.",
                "Pour in coconut milk, bring to boil then simmer 25 minutes.",
                "Season with salt and serve with rice."
            ],
        },
    ],
    "English": [
        {
            "name": "Full English Breakfast",
            "description": "Classic British fry-up with eggs, bacon, and toast.",
            "cookTime": "20 min", "servings": 1, "difficulty": "Easy",
            "ingredients": ["eggs", "bacon", "bread", "butter", "cooking oil", "salt", "black pepper"],
            "missingIngredients": ["baked beans", "mushrooms"],
            "instructions": [
                "Fry bacon in a dry pan until crispy; keep warm.",
                "In same pan, fry eggs to your liking.",
                "Toast bread and butter it.",
                "Warm baked beans in a small pot.",
                "Plate everything together and season."
            ],
        },
        {
            "name": "Tomato Soup",
            "description": "Velvety classic British tomato soup.",
            "cookTime": "30 min", "servings": 2, "difficulty": "Easy",
            "ingredients": ["tomatoes", "onions", "garlic", "butter", "salt", "black pepper"],
            "missingIngredients": ["vegetable stock", "cream"],
            "instructions": [
                "Sauté onions and garlic in butter until soft.",
                "Add chopped tomatoes and stock; simmer 20 minutes.",
                "Blend until smooth.",
                "Season with salt and pepper.",
                "Stir in cream and serve with crusty bread."
            ],
        },
    ],
}


def _filter_by_ingredients(
    recipes: List[Dict[str, Any]],
    available: Set[str],
    count: int,
) -> List[Dict[str, Any]]:
    """
    Score catalogue recipes by how many provided ingredients they use,
    return top `count` sorted by score descending.
    """
    def score(r: Dict[str, Any]) -> int:
        needed = {i.lower() for i in r["ingredients"]}
        return sum(1 for a in available if any(a in n or n in a for n in needed))

    scored = sorted(recipes, key=score, reverse=True)
    return scored[:count]


def _build_catalogue_response(
    recipes: List[Dict[str, Any]],
    cuisine: str,
) -> List[Dict[str, Any]]:
    """Stamp each catalogue recipe with a fresh UUID and correct image URL."""
    image = FOOD_IMAGES.get(cuisine, FOOD_IMAGES["default"])
    result = []
    for r in recipes:
        item = dict(r)
        item["id"] = str(uuid.uuid4())
        item["imageUrl"] = image
        result.append(item)
    return result


def _generate_from_catalogue(
    ingredients: List[str],
    cuisine: str,
    count: int,
) -> List[Dict[str, Any]]:
    """Return `count` recipes from the built-in catalogue for the given cuisine."""
    pool = RECIPE_CATALOGUE.get(cuisine) or RECIPE_CATALOGUE.get("Italian", [])
    available = {i.lower() for i in ingredients}

    if not pool:
        # Ultimate fallback: pick from any cuisine
        for recipes in RECIPE_CATALOGUE.values():
            pool.extend(recipes)

    chosen = _filter_by_ingredients(pool, available, count)
    return _build_catalogue_response(chosen, cuisine)


# ── Bedrock client (lazy, thread-safe) ───────────────────────────────────────
import threading
_bedrock_client = None
_bedrock_lock = threading.Lock()


def _get_bedrock_client():
    """Return a cached boto3 bedrock-runtime client, or None if not configured."""
    global _bedrock_client
    if _bedrock_client is not None:
        return _bedrock_client
    with _bedrock_lock:
        if _bedrock_client is not None:
            return _bedrock_client
        if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY:
            return None
        if not settings.BEDROCK_MODEL_ID:
            return None
        try:
            _bedrock_client = boto3.client(
                "bedrock-runtime",
                region_name=settings.BEDROCK_REGION or settings.AWS_REGION,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                config=BotocoreConfig(
                    retries={"max_attempts": 2, "mode": "standard"},
                    connect_timeout=5,
                    read_timeout=60,
                ),
            )
            log.info("AWS Bedrock client initialised (model=%s)", settings.BEDROCK_MODEL_ID)
        except Exception as exc:
            log.error("Failed to create Bedrock client: %s: %s", type(exc).__name__, exc)
            return None
    return _bedrock_client


def reset_bedrock_client() -> None:
    """Reset cached client — useful after credential rotation or in tests."""
    global _bedrock_client
    with _bedrock_lock:
        _bedrock_client = None


def is_bedrock_available() -> bool:
    """Return True if a Bedrock client can be created from current settings."""
    return _get_bedrock_client() is not None


async def ping_bedrock() -> bool:
    """
    Lightweight Bedrock liveness check.
    Validates the client can be created and credentials are configured.
    """
    if not settings.BEDROCK_MODEL_ID:
        return False
    if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY:
        return False
    try:
        region = settings.BEDROCK_REGION or settings.AWS_REGION
        sts = boto3.client(
            "sts",
            region_name=region,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            config=BotocoreConfig(connect_timeout=5, read_timeout=10),
        )
        sts.get_caller_identity()
        log.info("Bedrock ping OK — credentials valid, model=%s region=%s",
                 settings.BEDROCK_MODEL_ID, region)
        return True
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        if code in ("ThrottlingException",):
            return True
        log.warning("Bedrock ping ClientError (%s): %s", code, exc)
        return False
    except (BotoCoreError, Exception) as exc:
        log.warning("Bedrock ping error: %s: %s", type(exc).__name__, exc)
        return False


# ── Prompt builder ────────────────────────────────────────────────────────────

def _build_prompt(
    ingredients: List[str],
    cuisine: str,
    experience_level: str,
    count: int,
) -> str:
    """Build the Claude prompt that returns structured JSON recipes."""
    ing_list = ", ".join(ingredients)
    default_image = FOOD_IMAGES.get(cuisine, FOOD_IMAGES["default"])

    return f"""You are a professional chef specialising in {cuisine} cuisine.
A home cook has these ingredients available: {ing_list}

Generate exactly {count} authentic {cuisine} recipes they can make.
Tailor difficulty for a {experience_level} cook.

Rules:
- Every recipe MUST use at least 2 of the provided ingredients.
- List ALL ingredients needed (both available and missing).
- missingIngredients = only the ingredients NOT in the provided list (max 5).
- cookTime must be realistic (e.g. "25 min", "1 hr 10 min").
- instructions must be an array of 4-6 clear numbered steps.
- imageUrl must be exactly: {default_image}

Respond with ONLY valid JSON — no markdown, no explanation, no code fences.
Use this exact schema:

[
  {{
    "id": "<uuid-v4>",
    "name": "<recipe name>",
    "description": "<one sentence description>",
    "cookTime": "<time string>",
    "servings": <integer>,
    "difficulty": "<Easy|Medium|Hard>",
    "ingredients": ["<all ingredients>"],
    "missingIngredients": ["<ingredients not in provided list>"],
    "instructions": ["<step 1>", "<step 2>", ...],
    "imageUrl": "{default_image}"
  }}
]"""


# ── Tier 1: Bedrock (Claude) caller ──────────────────────────────────────────

async def _generate_with_bedrock(
    ingredients: List[str],
    cuisine: str,
    experience_level: str,
    count: int,
) -> List[Dict[str, Any]]:
    """
    Call AWS Bedrock (Claude) to generate recipes.
    Returns a list of recipe dicts, or raises on failure.
    """
    client = _get_bedrock_client()
    if client is None:
        raise RuntimeError("Bedrock client not available")

    prompt = _build_prompt(ingredients, cuisine, experience_level, count)

    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 4096,
        "temperature": 0.7,
        "messages": [
            {"role": "user", "content": prompt}
        ],
    })

    response = client.invoke_model(
        modelId=settings.BEDROCK_MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=body,
    )

    raw = json.loads(response["body"].read())
    text = raw["content"][0]["text"].strip()

    # Strip any accidental markdown fences Claude might add
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)

    recipes = json.loads(text)

    if not isinstance(recipes, list):
        raise ValueError(f"Bedrock response is not a list: {type(recipes)}")

    default_image = FOOD_IMAGES.get(cuisine, FOOD_IMAGES["default"])
    for r in recipes:
        if not r.get("id"):
            r["id"] = str(uuid.uuid4())
        if not r.get("imageUrl"):
            r["imageUrl"] = default_image

    log.info(
        "Bedrock (Claude) generated %d recipe(s) for cuisine=%s ingredients=%s",
        len(recipes), cuisine, ingredients,
    )
    return recipes


# ── Public API ────────────────────────────────────────────────────────────────

async def generate_recipes(
    ingredients: List[str],
    cuisine: str = "Italian",
    experience_level: str = "beginner",
    count: int = 3,
) -> List[Dict[str, Any]]:
    """
    Generate recipe suggestions.

    Tier 1 — AWS Bedrock Claude (dynamic, AI-generated, uses your ingredients)
    Tier 2 — Built-in catalogue (instant fallback if Bedrock unavailable or errors)
    """
    # ── Tier 1: AWS Bedrock ───────────────────────────────────────────────────
    if is_bedrock_available():
        try:
            return await _generate_with_bedrock(ingredients, cuisine, experience_level, count)
        except Exception as exc:
            log.warning(
                "Bedrock recipe generation failed (%s: %s) — falling back to catalogue.",
                type(exc).__name__, exc,
            )

    # ── Tier 2: Built-in catalogue ────────────────────────────────────────────
    log.info(
        "Generating recipes from built-in catalogue (cuisine=%s, count=%d).",
        cuisine, count,
    )
    return _generate_from_catalogue(ingredients, cuisine, count)
