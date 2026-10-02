"""
ai_service.py — EcoBite Recipe Generation Engine

Architecture (two tiers):
─────────────────────────
  Tier 1 — AWS Bedrock (Claude)
      Calls claude-3-haiku via bedrock:InvokeModel.
      Returns 3–5 fully dynamic, ingredient-matched recipes as structured JSON.
      Active whenever AWS credentials + BEDROCK_MODEL_ID are configured.

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
CUISINE_RECIPE_CATALOGUE: Dict[str, List[Dict[str, Any]]] = {
    "Sri Lankan": [
        {
            "name": "Parippu (Sri Lankan Dhal Curry)",
            "description": "Creamy red lentils tempered with mustard seeds, curry leaves, onions, and enriched with thick coconut milk.",
            "cookTime": "25 min", "servings": 4, "difficulty": "Easy",
            "requiredIngredients": ["red lentils","onions","garlic","coconut milk","turmeric","curry leaves","chilli powder","mustard seeds","salt","oil"],
            "instructions": [
                "Rinse red lentils until water runs clear, then add to a pot with sliced onions, garlic, turmeric, and 1.5 cups water.",
                "Simmer on medium heat for 12-15 minutes until lentils are soft.",
                "Pour in thick coconut milk, season with salt, and simmer on gentle heat for 5 minutes.",
                "In a separate small pan, heat 1 tbsp oil; fry mustard seeds, sliced shallots, and fresh curry leaves until fragrant.",
                "Pour the hot aromatic temper over the cooked dhal and stir gently before serving with rice.",
            ],
            "imageUrl": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800",
        },
        {
            "name": "Sri Lankan Vegetable & Egg Kottu Roti",
            "description": "Street-style shredded flatbread stir-fried on high heat with crispy vegetables, eggs, and rich aromatic curry sauce.",
            "cookTime": "20 min", "servings": 3, "difficulty": "Medium",
            "requiredIngredients": ["roti","eggs","onions","carrots","leeks","green chillies","garlic","ginger","soy sauce","curry powder","oil"],
            "instructions": [
                "Slice the Godamba/flatbread roti into thin bite-sized ribbons.",
                "Heat oil in a wide skillet or wok on high heat; add onions, minced ginger, garlic, and chopped green chillies.",
                "Add shredded carrots, leeks, and curry powder; toss vigorously for 3 minutes until crisp-tender.",
                "Push veggies to one side, crack in eggs and scramble quickly.",
                "Toss in the shredded roti ribbons with a dash of soy sauce, mixing and chopping with metal spatulas until piping hot.",
            ],
            "imageUrl": "https://images.unsplash.com/photo-1625398407796-82c4b0e31410?w=800",
        },
        {
            "name": "Ala Baduma (Spiced Sri Lankan Fried Potatoes)",
            "description": "Golden pan-fried potato cubes tossed with sautéed red onions, curry leaves, and crushed red chilli flakes.",
            "cookTime": "25 min", "servings": 4, "difficulty": "Easy",
            "requiredIngredients": ["potatoes","onions","garlic","curry leaves","chilli flakes","turmeric","salt","oil"],
            "instructions": [
                "Peel and cube potatoes into 2cm pieces; boil in salted water with a pinch of turmeric until fork-tender (approx. 8 min).",
                "Drain thoroughly and let surface steam dry for crispiness.",
                "Heat 2 tbsp oil in a pan; fry the boiled potatoes over medium-high heat until golden brown.",
                "Add sliced onions, garlic, and curry leaves; cook until onions caramelize at the edges.",
                "Sprinkle with crushed red chilli flakes, toss well, and serve hot.",
            ],
            "imageUrl": "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800",
        },
        {
            "name": "Pol Sambol with Hard-Boiled Eggs",
            "description": "Fresh coconut relish made with red onions, fiery chilli, and lime juice, paired with seasoned boiled eggs.",
            "cookTime": "15 min", "servings": 2, "difficulty": "Easy",
            "requiredIngredients": ["grated coconut","red onions","chilli powder","lime","eggs","salt","black pepper"],
            "instructions": [
                "Boil eggs in water for 9 minutes for firm yolks; peel and halve.",
                "In a pestle and mortar or bowl, crush finely chopped red onions with salt and chilli powder.",
                "Add fresh grated coconut and mix thoroughly with fingers or pestle until vibrant orange.",
                "Squeeze fresh lime juice over the sambol and adjust seasoning.",
                "Serve the tangy coconut sambol alongside the sliced boiled eggs and warm toast or hoppers.",
            ],
            "imageUrl": "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800",
        },
    ],
    "Indian": [
        {
            "name": "Dal Tadka (Spiced Yellow Lentil Curry)",
            "description": "Creamy toor and moong lentils finished with a sizzling ghee tempering of cumin, garlic, and dried red chillies.",
            "cookTime": "30 min", "servings": 4, "difficulty": "Easy",
            "requiredIngredients": ["lentils","tomatoes","onions","garlic","ginger","cumin seeds","turmeric","ghee","fresh coriander","salt"],
            "instructions": [
                "Pressure cook or boil lentils with turmeric and salt until soft and velvety (approx. 20 min).",
                "In a pan, melt ghee; add cumin seeds and let them sizzle.",
                "Add minced garlic, ginger, and chopped onions; sauté until golden brown.",
                "Stir in chopped tomatoes and cook down until oil separates.",
                "Pour the spiced tadka into the simmered lentils, garnish with chopped coriander, and serve with hot basmati rice or roti.",
            ],
            "imageUrl": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800",
        },
        {
            "name": "Aloo Gobi Masala",
            "description": "Homestyle dry curry of tender potatoes and cauliflower florets roasted with ground spices, ginger, and coriander.",
            "cookTime": "30 min", "servings": 4, "difficulty": "Easy",
            "requiredIngredients": ["potatoes","cauliflower","onions","tomatoes","ginger","garlic","garam masala","turmeric","coriander powder","oil"],
            "instructions": [
                "Cut cauliflower into bite-sized florets and peel/dice potatoes.",
                "Heat oil in a heavy-bottomed pan; sauté cumin seeds, onions, ginger, and garlic until aromatic.",
                "Add ground turmeric, coriander powder, and diced tomatoes; cook to a paste.",
                "Add cauliflower and potatoes, tossing to coat in masala spices.",
                "Cover with a lid and cook on low heat for 15-18 minutes until vegetables are tender. Garnish with garam masala and fresh coriander.",
            ],
            "imageUrl": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800",
        },
        {
            "name": "Fragrant Vegetable Biryani",
            "description": "Layered aromatic basmati rice cooked with seasoned mixed vegetables, saffron, and whole warm spices.",
            "cookTime": "40 min", "servings": 4, "difficulty": "Medium",
            "requiredIngredients": ["basmati rice","onions","carrots","potatoes","peas","yogurt","garlic","ginger","biryani masala","mint leaves","oil"],
            "instructions": [
                "Parboil soaked basmati rice with whole spices (bay leaf, cardamom) until 70% cooked; drain.",
                "Sauté sliced onions in oil until caramelized and crisp; set half aside for garnish.",
                "Add ginger-garlic paste, diced carrots, potatoes, peas, yogurt, and biryani masala; cook for 10 minutes.",
                "Layer the cooked spiced vegetables at the bottom of a heavy pot and top with the parboiled rice.",
                "Scatter fried onions and mint leaves over the top, seal tightly with foil, and steam on low heat (dum) for 15 minutes.",
            ],
            "imageUrl": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800",
        },
    ],
    "Korean": [
        {
            "name": "Kimchi Jjigae (Spicy Kimchi Stew)",
            "description": "Rich, comforting Korean stew simmered with aged kimchi, tofu, scallions, and savory broth.",
            "cookTime": "25 min", "servings": 3, "difficulty": "Easy",
            "requiredIngredients": ["kimchi","tofu","onions","garlic","spring onions","gochugaru","soy sauce","sesame oil","broth"],
            "instructions": [
                "Heat sesame oil in a pot; add chopped aged kimchi, sliced onions, and minced garlic; sauté for 4-5 minutes.",
                "Pour in vegetable or anchovy broth and add gochugaru (Korean chilli flakes) and soy sauce.",
                "Bring to a rolling boil, then lower heat and simmer for 15 minutes to develop deep flavors.",
                "Slice tofu into slabs and nestle into the stew; simmer for an additional 5 minutes.",
                "Top with chopped spring onions and serve bubbling hot with a bowl of steamed white rice.",
            ],
            "imageUrl": "https://images.unsplash.com/photo-1583416750470-965b2707b355?w=800",
        },
        {
            "name": "Classic Bibimbap (Mixed Rice Bowl)",
            "description": "Warm steamed rice topped with colorful seasoned vegetables, a crispy sunny-side-up egg, and spicy-sweet gochujang sauce.",
            "cookTime": "30 min", "servings": 2, "difficulty": "Medium",
            "requiredIngredients": ["rice","carrots","spinach","mushrooms","eggs","garlic","sesame oil","soy sauce","gochujang"],
            "instructions": [
                "Cook short-grain white rice and keep warm in deep serving bowls.",
                "Blanch spinach briefly, squeeze out excess moisture, and toss with sesame oil, garlic, and salt.",
                "Julienne carrots and slice mushrooms; stir-fry each vegetable separately with a pinch of salt until tender.",
                "Fry eggs sunny-side-up with crispy edges and soft runny yolks.",
                "Arrange the prepared vegetables in sections over the rice, place egg in center, and serve with sesame oil and gochujang paste.",
            ],
            "imageUrl": "https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=800",
        },
    ],
    "Chinese": [
        {
            "name": "Golden Egg Fried Rice",
            "description": "Wok-fried rice tossed on high heat with fluffy scrambled eggs, garlic, spring onions, and toasted sesame oil.",
            "cookTime": "15 min", "servings": 2, "difficulty": "Easy",
            "requiredIngredients": ["cooked rice","eggs","garlic","spring onions","soy sauce","sesame oil","white pepper","oil"],
            "instructions": [
                "Use chilled day-old cooked rice and break up any clumps with your fingers.",
                "Beat 2 eggs in a bowl with a pinch of salt.",
                "Heat oil in a hot wok until shimmering; pour in eggs and scramble softly, then set aside.",
                "Add another tablespoon of oil to the wok, sauté minced garlic and white parts of spring onions for 30 seconds.",
                "Toss in cold rice on maximum heat; drizzle soy sauce around the rim of the wok and toss continuously for 3 minutes.",
                "Fold in scrambled eggs, green spring onion tops, and a dash of sesame oil before serving.",
            ],
            "imageUrl": "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800",
        },
        {
            "name": "Chinese Tomato & Egg Stir-Fry",
            "description": "Beloved Chinese comfort food featuring sweet ripe tomatoes and soft scrambled eggs in a savory-sweet natural sauce.",
            "cookTime": "15 min", "servings": 2, "difficulty": "Easy",
            "requiredIngredients": ["tomatoes","eggs","garlic","spring onions","sugar","soy sauce","salt","oil"],
            "instructions": [
                "Cut ripe tomatoes into wedges; whisk 3 eggs with a pinch of salt.",
                "Heat oil in a pan over medium-high heat; cook eggs until softly set and remove to a plate.",
                "Add another drizzle of oil, sauté minced garlic, and add the tomato wedges.",
                "Cook tomatoes for 3-4 minutes, pressing lightly with spatula until they release rich juices.",
                "Add 1/2 tsp sugar, 1 tsp soy sauce, and return the eggs to the pan; toss gently to combine and garnish with spring onions.",
            ],
            "imageUrl": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800",
        },
        {
            "name": "Stir-Fried Garlic Vegetables",
            "description": "Crisp broccoli, bell peppers, and mushrooms wok-tossed in a savory garlic and light soy glaze.",
            "cookTime": "15 min", "servings": 3, "difficulty": "Easy",
            "requiredIngredients": ["broccoli","bell peppers","mushrooms","garlic","ginger","soy sauce","cornstarch","sesame oil","oil"],
            "instructions": [
                "Cut broccoli into florets, slice bell peppers into strips, and quarter the mushrooms.",
                "Whisk 2 tbsp soy sauce, 1/2 cup water, and 1 tsp cornstarch in a small bowl.",
                "Heat wok on high; add oil, sliced ginger, and smashed garlic cloves until aromatic (20 seconds).",
                "Toss in broccoli florets with 2 tbsp water; cover for 1 minute to steam-cook.",
                "Add mushrooms and bell peppers; stir-fry for 2 minutes on high heat.",
                "Pour in sauce mixture, toss until glossy and clinging to the vegetables, and finish with sesame oil.",
            ],
            "imageUrl": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800",
        },
    ],
    "Malaysian": [
        {
            "name": "Nasi Lemak Infusion Bowl",
            "description": "Fragrant rice steamed in coconut milk and pandan, served with crispy fried egg, cucumber, and spicy sambal.",
            "cookTime": "25 min", "servings": 3, "difficulty": "Easy",
            "requiredIngredients": ["rice","coconut milk","eggs","cucumber","onions","garlic","chilli paste","peanuts","oil","salt"],
            "instructions": [
                "Rinse rice; cook in a pot with coconut milk, equal parts water, smashed ginger, and a pinch of salt.",
                "In a small pan, fry sliced onions and garlic with chilli paste and sugar until deep dark red sambal forms.",
                "Fry or boil eggs to your liking and slice fresh cucumbers into cooling rounds.",
                "Plate the aromatic coconut rice in a mound.",
                "Surround with the warm sambal, sliced cucumber, fried peanuts, and boiled/fried egg.",
            ],
            "imageUrl": "https://images.unsplash.com/photo-1567982047351-76b6f93e038d?w=800",
        },
        {
            "name": "Mee Goreng Mamak (Malaysian Fried Noodles)",
            "description": "Spicy, savory hawker-style fried noodles with cabbage, tofu, eggs, and rich sweet dark soy sauce.",
            "cookTime": "20 min", "servings": 3, "difficulty": "Medium",
            "requiredIngredients": ["noodles","eggs","tofu","onions","garlic","cabbage","soy sauce","chilli paste","lime","oil"],
            "instructions": [
                "Boil noodles until al dente, drain, and toss with a drop of oil.",
                "Heat oil in a wok; fry cubed tofu until golden on all sides, then set aside.",
                "Sauté minced garlic, sliced onions, and chilli paste until fragrant.",
                "Add shredded cabbage and noodles; splash with sweet dark soy sauce and light soy sauce.",
                "Push noodles aside, scramble in egg, toss everything together, and serve with a fresh lime wedge.",
            ],
            "imageUrl": "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800",
        },
    ],
    "English": [
        {
            "name": "Classic Shepherd's Pie",
            "description": "Savory minced meat and vegetable filling in rich brown gravy, topped with creamy piped golden mashed potatoes.",
            "cookTime": "45 min", "servings": 4, "difficulty": "Medium",
            "requiredIngredients": ["minced meat","potatoes","onions","carrots","peas","garlic","butter","milk","beef broth","worcestershire sauce"],
            "instructions": [
                "Boil peeled potatoes in salted water until tender; mash with butter, warm milk, salt, and black pepper.",
                "In a deep pan, brown minced meat with diced onions, carrots, and minced garlic.",
                "Stir in broth, peas, Worcestershire sauce, and thyme; simmer for 15 minutes until thick.",
                "Spoon the savory meat filling into a baking dish and spread the creamy mashed potato over the top.",
                "Score with a fork and bake at 200°C (400°F) for 20-25 minutes until golden and bubbling.",
            ],
            "imageUrl": "https://images.unsplash.com/photo-1584947897588-4663b65cbef9?w=800",
        },
        {
            "name": "Hearty English Country Vegetable Stew",
            "description": "Wholesome simmered stew with chunky root vegetables, herbs, and savory vegetable stock.",
            "cookTime": "35 min", "servings": 4, "difficulty": "Easy",
            "requiredIngredients": ["potatoes","carrots","onions","celery","garlic","vegetable broth","thyme","butter","flour","black pepper"],
            "instructions": [
                "Melt butter in a heavy pot; sauté chopped onions, carrots, and celery for 6-8 minutes.",
                "Add minced garlic and stir in 1 tbsp flour to coat vegetables.",
                "Pour in vegetable broth slowly while stirring to prevent lumps.",
                "Add cubed potatoes, thyme sprigs, salt, and freshly cracked black pepper.",
                "Cover and simmer on low heat for 25 minutes until all root vegetables are tender.",
            ],
            "imageUrl": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800",
        },
    ],
    "American": [
        {
            "name": "Classic Skillet Cheeseburger",
            "description": "Juicy seasoned beef patty seared in a hot cast-iron skillet, topped with melted cheese and caramelized onions.",
            "cookTime": "20 min", "servings": 2, "difficulty": "Easy",
            "requiredIngredients": ["ground beef","cheese","onions","burger buns","tomatoes","lettuce","butter","salt","black pepper"],
            "instructions": [
                "Divide ground beef into patties, seasoning both sides generously with salt and pepper.",
                "Sauté sliced onions in butter in a hot skillet until browned and caramelized; set aside.",
                "Sear patties in the screaming-hot skillet for 3-4 minutes per side.",
                "Place cheese slice on patty, cover pan for 1 minute until cheese is completely melted.",
                "Toast burger buns in the pan juices, assemble with lettuce, tomato slice, cheesy patty, and caramelized onions.",
            ],
            "imageUrl": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800",
        },
        {
            "name": "Smoky Skillet Beef & Bean Chili",
            "description": "Rich, comforting chili made with ground beef, kidney beans, crushed tomatoes, and warm smoky spices.",
            "cookTime": "35 min", "servings": 4, "difficulty": "Easy",
            "requiredIngredients": ["ground beef","kidney beans","canned tomatoes","onions","garlic","bell peppers","chilli powder","cumin","oil"],
            "instructions": [
                "Heat oil in a heavy pot; brown ground beef with diced onions and bell peppers for 6-8 minutes.",
                "Add minced garlic, chilli powder, and ground cumin; toast spices for 1 minute.",
                "Stir in crushed tomatoes and rinsed kidney beans.",
                "Cover and simmer gently for 20 minutes until flavors meld into a thick, hearty chili.",
                "Serve warm with a dollop of sour cream or grated cheddar cheese.",
            ],
            "imageUrl": "https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=800",
        },
    ],
    "Italian": [
        {
            "name": "Spaghetti Aglio, Olio e Peperoncino",
            "description": "Traditional Roman pasta tossed with aromatic extra virgin olive oil, golden toasted garlic slivers, and fiery chilli flakes.",
            "cookTime": "15 min", "servings": 2, "difficulty": "Easy",
            "requiredIngredients": ["spaghetti","garlic","olive oil","chilli flakes","fresh parsley","parmesan cheese","salt"],
            "instructions": [
                "Cook spaghetti in a pot of generously salted boiling water until al dente.",
                "While pasta cooks, heat good quality olive oil in a wide skillet over low heat.",
                "Add thinly sliced garlic and chilli flakes; cook gently until garlic turns pale golden (do not burn).",
                "Scoop 1/2 cup of starchy pasta water into the garlic oil to create a silky emulsion.",
                "Transfer pasta directly into the skillet, toss vigorously over heat for 1 minute, and finish with chopped parsley and parmesan.",
            ],
            "imageUrl": "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800",
        },
        {
            "name": "Classic Pasta Pomodoro with Fresh Basil",
            "description": "Silky spaghetti coated in a rich sweet tomato sauce infused with garlic, extra virgin olive oil, and fresh basil leaves.",
            "cookTime": "20 min", "servings": 2, "difficulty": "Easy",
            "requiredIngredients": ["pasta","tomatoes","garlic","olive oil","fresh basil","parmesan cheese","salt","black pepper"],
            "instructions": [
                "Boil pasta in salted water until 1 minute shy of al dente.",
                "In a pan, gently sauté whole peeled garlic cloves in olive oil until golden, then discard or crush them.",
                "Add crushed ripe tomatoes, salt, and pepper; simmer for 12 minutes until reduced and flavorful.",
                "Toss drained pasta in the tomato sauce with a splash of pasta water and fresh torn basil leaves.",
                "Serve hot with a drizzle of raw olive oil and freshly grated parmesan.",
            ],
            "imageUrl": "https://images.unsplash.com/photo-1621996346565-e3d5d628169e?w=800",
        },
        {
            "name": "Creamy Parmesan & Mushroom Risotto",
            "description": "Slow-stirred Arborio rice simmered with savory mushrooms, garlic, vegetable broth, and aged parmesan cheese.",
            "cookTime": "30 min", "servings": 3, "difficulty": "Medium",
            "requiredIngredients": ["arborio rice","mushrooms","onions","garlic","vegetable broth","butter","parmesan cheese","olive oil","black pepper"],
            "instructions": [
                "Keep vegetable broth warm in a saucepan over low heat.",
                "Sauté sliced mushrooms in olive oil until golden brown; set half aside for topping.",
                "In a deep pan, melt 1 tbsp butter and cook finely diced onions and garlic until translucent.",
                "Add Arborio rice, stirring for 2 minutes to toast the grains.",
                "Add warm broth one ladle at a time, stirring steadily until absorbed before adding the next (approx. 18-20 min).",
                "Turn off heat; vigorously beat in remaining butter, grated parmesan, and season with black pepper.",
            ],
            "imageUrl": "https://images.unsplash.com/photo-1579113800032-c38bd7635818?w=800",
        },
    ],
}


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
    Avoids a live API call since list_foundation_models requires
    Bedrock model access to be enabled in the AWS console first.
    Used by GET /health/aws.
    """
    if not settings.BEDROCK_MODEL_ID:
        return False
    if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY:
        return False
    try:
        # Just verify the boto3 client can be constructed with valid credentials
        # A real invocation test happens naturally on first recipe generation
        region = settings.BEDROCK_REGION or settings.AWS_REGION
        client = boto3.client(
            "bedrock-runtime",
            region_name=region,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            config=BotocoreConfig(connect_timeout=5, read_timeout=10),
        )
        # Verify the endpoint is reachable with a zero-cost STS check
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

    # Claude Messages API payload
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
    # Claude returns: {"content": [{"type": "text", "text": "..."}], ...}
    text = raw["content"][0]["text"].strip()

    # Strip any accidental markdown fences Claude might add
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)

    recipes = json.loads(text)

    if not isinstance(recipes, list):
        raise ValueError(f"Bedrock response is not a list: {type(recipes)}")

    # Ensure every recipe has a valid id and imageUrl
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


# ── Tier 2: catalogue fallback ────────────────────────────────────────────────

def _normalize_token(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)
    if text.endswith("es"):
        text = text[:-2]
    elif text.endswith("s") and not text.endswith("ss"):
        text = text[:-1]
    return text


def _extract_tokens(items: List[str]) -> Set[str]:
    tokens: set[str] = set()
    for item in items:
        for word in item.split():
            clean = _normalize_token(word)
            if len(clean) >= 3 and clean not in {
                "and", "with", "for", "the", "fresh", "dried", "chopped", "sliced"
            }:
                tokens.add(clean)
    return tokens


def _generate_catalogue_recipes(
    user_ingredients: List[str],
    cuisine: str,
    experience_level: str,
    count: int,
) -> List[Dict[str, Any]]:
    """Select and rank recipes from the built-in catalogue."""
    user_tokens = _extract_tokens(user_ingredients)

    catalog_key = "Italian"
    for k in CUISINE_RECIPE_CATALOGUE:
        if k.lower() == cuisine.lower():
            catalog_key = k
            break

    candidates = CUISINE_RECIPE_CATALOGUE[catalog_key]
    scored: List[Dict[str, Any]] = []
    seen: set[str] = set()

    for tmpl in candidates:
        norm_name = re.sub(r"[^\w\s]", "", tmpl["name"].lower())
        if norm_name in seen:
            continue

        req = tmpl["requiredIngredients"]
        matched = [i for i in req if user_tokens.intersection(_extract_tokens([i]))]
        missing = [i for i in req if i not in matched][:5]

        if user_tokens and not matched:
            continue

        difficulty = "Easy" if experience_level.lower() == "beginner" else tmpl.get("difficulty", "Medium")

        scored.append({
            "id": str(uuid.uuid4()),
            "name": tmpl["name"],
            "description": tmpl["description"],
            "cookTime": tmpl["cookTime"],
            "servings": tmpl["servings"],
            "difficulty": difficulty,
            "ingredients": req,
            "missingIngredients": missing,
            "instructions": tmpl["instructions"],
            "imageUrl": tmpl.get("imageUrl") or FOOD_IMAGES.get(catalog_key, FOOD_IMAGES["default"]),
            "_score": len(matched) * 2.0 - len(missing) * 0.1,
        })
        seen.add(norm_name)

    scored.sort(key=lambda r: r["_score"], reverse=True)
    results = [{k: v for k, v in r.items() if k != "_score"} for r in scored[:count]]

    # Hard fallback: no ingredient overlap — return top-N anyway
    if not results:
        for t in candidates[:count]:
            results.append({
                "id": str(uuid.uuid4()),
                "name": t["name"],
                "description": t["description"],
                "cookTime": t["cookTime"],
                "servings": t["servings"],
                "difficulty": t.get("difficulty", "Easy"),
                "ingredients": t["requiredIngredients"],
                "missingIngredients": t["requiredIngredients"][:4],
                "instructions": t["instructions"],
                "imageUrl": t.get("imageUrl") or FOOD_IMAGES.get(catalog_key, FOOD_IMAGES["default"]),
            })

    return results


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
    Tier 2 — Built-in catalogue (instant fallback if Bedrock unavailable)
    """
    # ── Tier 1: AWS Bedrock ───────────────────────────────────────────────────
    if is_bedrock_available():
        try:
            recipes = await _generate_with_bedrock(ingredients, cuisine, experience_level, count)
            if recipes:
                return recipes
        except (ClientError, BotoCoreError) as exc:
            log.warning("Bedrock API error (%s) — falling back to catalogue.", exc)
        except (json.JSONDecodeError, ValueError, KeyError) as exc:
            log.warning("Bedrock response parse error (%s) — falling back to catalogue.", exc)
        except Exception as exc:
            log.warning("Unexpected Bedrock error (%s: %s) — falling back to catalogue.",
                        type(exc).__name__, exc)

    # ── Tier 2: Built-in catalogue ────────────────────────────────────────────
    log.info("Using built-in catalogue for cuisine=%s", cuisine)
    return _generate_catalogue_recipes(ingredients, cuisine, experience_level, count)
