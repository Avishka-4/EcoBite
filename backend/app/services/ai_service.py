import json
import uuid
from typing import List, Dict, Any
from app.core.config import settings

FOOD_IMAGES: Dict[str, str] = {
    "Italian":       "https://images.unsplash.com/photo-1579113800032-c38bd7635818?w=800",
    "Chinese":       "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800",
    "Mexican":       "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800",
    "Indian":        "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800",
    "Japanese":      "https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=800",
    "Mediterranean": "https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?w=800",
    "American":      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800",
    "Thai":          "https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=800",
    "French":        "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800",
    "Korean":        "https://images.unsplash.com/photo-1583416750470-965b2707b355?w=800",
    "default":       "https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=800",
}

_CLAUDE_PROMPT = """You are a professional chef AI for EcoBite. Generate exactly {count} recipe suggestions.

Available ingredients: {ingredients}
Preferred cuisine: {cuisine}
Cooking experience: {experience}

Rules:
- Use as many available ingredients as possible
- Keep complexity right for a {experience} cook
- Recipes should feel like {cuisine} cuisine
- Be practical and delicious

Return ONLY a valid JSON array — no markdown, no extra text. Each element must have:
{{
  "name": "string",
  "description": "1-2 sentence description",
  "cookTime": "X-Y min",
  "servings": 4,
  "difficulty": "Easy|Medium|Hard",
  "ingredients": ["quantity + ingredient"],
  "missingIngredients": ["ingredients not in the available list"],
  "instructions": ["Step 1", "Step 2", "Step 3", "Step 4", "Step 5"]
}}"""


async def generate_recipes(
    ingredients: List[str],
    cuisine: str = "Italian",
    experience_level: str = "beginner",
    count: int = 3,
) -> List[Dict[str, Any]]:
    """Generate recipe suggestions via Claude, falling back to templates if API key missing."""

    if settings.ANTHROPIC_API_KEY:
        try:
            return await _generate_with_claude(ingredients, cuisine, experience_level, count)
        except Exception:
            pass  # fall through to template fallback

    return _fallback_recipes(ingredients, cuisine, experience_level, count)


async def _generate_with_claude(
    ingredients: List[str],
    cuisine: str,
    experience_level: str,
    count: int,
) -> List[Dict[str, Any]]:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    prompt = _CLAUDE_PROMPT.format(
        count=count,
        ingredients=", ".join(ingredients),
        cuisine=cuisine,
        experience=experience_level,
    )

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    recipes_data = json.loads(raw.strip())
    image_url = FOOD_IMAGES.get(cuisine, FOOD_IMAGES["default"])

    return [
        {"id": str(uuid.uuid4()), "imageUrl": image_url, **recipe}
        for recipe in recipes_data[:count]
    ]


def _fallback_recipes(
    ingredients: List[str],
    cuisine: str,
    experience_level: str,
    count: int,
) -> List[Dict[str, Any]]:
    image_url = FOOD_IMAGES.get(cuisine, FOOD_IMAGES["default"])
    cook_time = {"beginner": "35-40 min", "intermediate": "25-30 min", "advanced": "20-25 min"}.get(
        experience_level, "30 min"
    )
    difficulty = {"beginner": "Easy", "intermediate": "Medium", "advanced": "Medium"}.get(
        experience_level, "Easy"
    )

    templates = [
        {
            "name": f"{cuisine} Stir Fry",
            "description": f"A quick and vibrant {cuisine.lower()} stir fry packed with your fresh ingredients.",
            "instructions": [
                "Wash and chop all vegetables into bite-sized pieces.",
                "Heat oil in a wok or large pan over high heat.",
                "Add aromatics (garlic, onion) and stir-fry for 1 minute.",
                "Add remaining ingredients and toss for 4-5 minutes.",
                "Season to taste and serve immediately.",
            ],
        },
        {
            "name": f"{cuisine} Baked Dish",
            "description": f"A comforting oven-baked {cuisine.lower()} recipe with a golden crust.",
            "instructions": [
                "Preheat oven to 200°C / 400°F.",
                "Layer ingredients in a baking dish.",
                "Season generously with salt, pepper, and herbs.",
                "Bake for 25-30 minutes until golden and cooked through.",
                "Rest for 5 minutes before serving.",
            ],
        },
        {
            "name": f"{cuisine} Soup",
            "description": f"A warming and hearty {cuisine.lower()} soup perfect for any occasion.",
            "instructions": [
                "Sauté onion and garlic in olive oil until soft.",
                "Add remaining vegetables and cook for 3 minutes.",
                "Pour in 500 ml stock or water and bring to a boil.",
                "Reduce heat and simmer for 20 minutes.",
                "Blend partially or leave chunky, then season to taste.",
            ],
        },
    ]

    result = []
    for i in range(min(count, len(templates))):
        t = templates[i]
        result.append(
            {
                "id": str(uuid.uuid4()),
                "name": t["name"],
                "description": t["description"],
                "cookTime": cook_time,
                "servings": 4,
                "difficulty": difficulty,
                "ingredients": [f"your {ing}" for ing in ingredients] + ["salt", "pepper", "oil"],
                "missingIngredients": [],
                "instructions": t["instructions"],
                "imageUrl": image_url,
            }
        )
    return result
