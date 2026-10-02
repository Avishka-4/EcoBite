"""
aws_rekognition_service.py — Food/ingredient detection using AWS Rekognition.

Uses the Rekognition `detect_labels` API to identify food items in uploaded
images and maps them to canonical ingredient names for recipe generation.

AWS credentials are read from environment / config:
  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION

Security notes
--------------
- Credentials are NEVER returned to callers or logged.
- The boto3 client is created once and reused (thread-safe via a lock).
- If credentials are absent the service degrades gracefully (returns empty list).
"""

from __future__ import annotations

import logging
import threading
from typing import List, Optional, Tuple

import boto3
from botocore.config import Config as BotocoreConfig
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings

log = logging.getLogger(__name__)

# ── Rekognition food label → canonical ingredient name mapping ───────────────
REKOGNITION_FOOD_MAP: dict[str, str | None] = {
    # Fruits
    "banana": "banana",
    "apple": "apple",
    "orange": "orange",
    "lemon": "lemon",
    "lime": "lime",
    "grape": "grapes",
    "grapes": "grapes",
    "strawberry": "strawberries",
    "blueberry": "blueberries",
    "raspberry": "raspberries",
    "mango": "mango",
    "pineapple": "pineapple",
    "watermelon": "watermelon",
    "peach": "peach",
    "pear": "pear",
    "cherry": "cherries",
    "avocado": "avocado",
    "coconut": "coconut",
    "papaya": "papaya",
    "pomegranate": "pomegranate",
    "kiwi": "kiwi",
    "plum": "plum",
    # Vegetables
    "tomato": "tomatoes",
    "potato": "potatoes",
    "onion": "onions",
    "garlic": "garlic",
    "carrot": "carrots",
    "broccoli": "broccoli",
    "cauliflower": "cauliflower",
    "spinach": "spinach",
    "lettuce": "lettuce",
    "cabbage": "cabbage",
    "cucumber": "cucumber",
    "bell pepper": "bell peppers",
    "pepper": "bell peppers",
    "mushroom": "mushrooms",
    "corn": "corn",
    "peas": "peas",
    "green bean": "green beans",
    "celery": "celery",
    "zucchini": "zucchini",
    "eggplant": "eggplant",
    "asparagus": "asparagus",
    "ginger": "ginger",
    "sweet potato": "sweet potato",
    "pumpkin": "pumpkin",
    "beetroot": "beetroot",
    "radish": "radish",
    "leek": "leek",
    # Proteins
    "chicken": "chicken",
    "beef": "beef",
    "pork": "pork",
    "fish": "fish",
    "salmon": "salmon",
    "tuna": "tuna",
    "shrimp": "shrimp",
    "prawn": "shrimp",
    "egg": "eggs",
    "eggs": "eggs",
    "sausage": "sausage",
    "bacon": "bacon",
    "ham": "ham",
    "lamb": "lamb",
    "turkey": "turkey",
    "seafood": "seafood",
    "lobster": "lobster",
    "crab": "crab",
    "steak": "beef steak",
    "meat": "meat",
    # Dairy
    "cheese": "cheese",
    "milk": "milk",
    "butter": "butter",
    "yogurt": "yogurt",
    "cream": "cream",
    "cream cheese": "cream cheese",
    # Grains / Carbs
    "bread": "bread",
    "rice": "rice",
    "pasta": "pasta",
    "noodle": "noodles",
    "flour": "flour",
    "tortilla": "tortilla",
    "oats": "oats",
    # Pantry
    "oil": "cooking oil",
    "olive oil": "olive oil",
    "honey": "honey",
    "sugar": "sugar",
    "salt": "salt",
    "sauce": "sauce",
    "soy sauce": "soy sauce",
    "ketchup": "ketchup",
    "mustard": "mustard",
    "vinegar": "vinegar",
    "chocolate": "chocolate",
    # Herbs & Spices
    "herb": "herbs",
    "basil": "basil",
    "parsley": "parsley",
    "cilantro": "cilantro",
    "mint": "mint",
    "rosemary": "rosemary",
    "thyme": "thyme",
    "oregano": "oregano",
    "chili": "chillies",
    "chili pepper": "chillies",
    "cinnamon": "cinnamon",
    "turmeric": "turmeric",
    # Nuts & Legumes
    "nut": "mixed nuts",
    "almond": "almonds",
    "walnut": "walnuts",
    "peanut": "peanuts",
    "cashew": "cashews",
    "lentil": "lentils",
    "bean": "beans",
    "chickpea": "chickpeas",
    "tofu": "tofu",
    # Generic food labels Rekognition often returns — explicitly excluded
    "fruit": "mixed fruit",
    "vegetable": "mixed vegetables",
    "produce": "fresh produce",
    "food": None,
    "meal": None,
    "dish": None,
    "plant": None,
    "flora": None,
}

# ── Thread-safe lazy client ──────────────────────────────────────────────────
_rekognition_client = None
_rekognition_lock = threading.Lock()


def _get_client():
    """Return a cached boto3 Rekognition client, or None if credentials are missing."""
    global _rekognition_client
    if _rekognition_client is not None:
        return _rekognition_client

    with _rekognition_lock:
        # Double-checked locking — another thread may have initialised while we waited.
        if _rekognition_client is not None:
            return _rekognition_client

        if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY:
            log.warning(
                "AWS credentials not configured (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY "
                "are empty) — Rekognition is unavailable."
            )
            return None

        try:
            _rekognition_client = boto3.client(
                "rekognition",
                region_name=settings.AWS_REGION,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                config=BotocoreConfig(
                    retries={"max_attempts": 3, "mode": "adaptive"},
                    connect_timeout=5,
                    read_timeout=30,
                ),
            )
            log.info("AWS Rekognition client initialised (region=%s)", settings.AWS_REGION)
        except Exception as exc:
            # Log the error class only — never log credential values
            log.error("Failed to create Rekognition client: %s: %s", type(exc).__name__, exc)
            return None

    return _rekognition_client


def reset_client() -> None:
    """Reset the cached client — useful in tests or after credential rotation."""
    global _rekognition_client
    with _rekognition_lock:
        _rekognition_client = None


def is_rekognition_available() -> bool:
    """Return True if a Rekognition client can be created from current settings."""
    return _get_client() is not None


async def ping_rekognition() -> bool:
    """
    Perform a lightweight live call to Rekognition to verify the API is reachable
    and credentials are valid.  Used by the /health/aws endpoint.
    """
    client = _get_client()
    if client is None:
        return False
    try:
        # list_collections is cheap and requires no data — ideal for health checks
        client.list_collections(MaxResults=1)
        return True
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")
        # ProvisionedThroughputExceededException / ThrottlingException still mean
        # the API is up and credentials are valid.
        if error_code in ("ThrottlingException", "ProvisionedThroughputExceededException"):
            return True
        log.warning("Rekognition ping failed (%s): %s", error_code, exc)
        return False
    except (BotoCoreError, Exception) as exc:
        log.warning("Rekognition ping error: %s: %s", type(exc).__name__, exc)
        return False


async def detect_ingredients_from_image(image_bytes: bytes) -> Tuple[List[str], float]:
    """
    Detect food ingredients in an image using AWS Rekognition.

    Parameters
    ----------
    image_bytes : bytes
        Raw image data (JPEG, PNG, or WebP).

    Returns
    -------
    ingredients : list[str]
        Deduplicated canonical ingredient names found in the image.
    confidence : float
        Mean detection confidence normalised to 0–1.  0.0 if nothing detected.
    """
    client = _get_client()
    if client is None:
        log.warning("Rekognition unavailable — returning empty ingredient list.")
        return [], 0.0

    try:
        response = client.detect_labels(
            Image={"Bytes": image_bytes},
            MaxLabels=50,
            MinConfidence=settings.REKOGNITION_MIN_CONFIDENCE,
            Features=["GENERAL_LABELS"],
            Settings={
                "GeneralLabels": {
                    "LabelInclusionFilters": [],
                }
            },
        )
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")
        log.error("Rekognition ClientError (%s): %s", error_code, exc)
        return [], 0.0
    except BotoCoreError as exc:
        log.error("Rekognition BotoCoreError: %s: %s", type(exc).__name__, exc)
        return [], 0.0
    except Exception as exc:
        log.error("Unexpected Rekognition error: %s: %s", type(exc).__name__, exc)
        return [], 0.0

    detected: list[str] = []
    confidences: list[float] = []

    for label in response.get("Labels", []):
        label_name: str = label["Name"].lower()
        conf: float = label["Confidence"] / 100.0  # normalise to 0–1

        # Explicit mapping hit
        if label_name in REKOGNITION_FOOD_MAP:
            canonical: Optional[str] = REKOGNITION_FOOD_MAP[label_name]
            if canonical is None:
                # Mapped to None = explicitly excluded
                continue
        else:
            # Unknown label — include only if it has a food-related parent
            parents = [p["Name"].lower() for p in label.get("Parents", [])]
            is_food_related = any(
                p in (
                    "food", "fruit", "vegetable", "produce", "meat",
                    "seafood", "dairy", "spice", "herb", "grain",
                    "beverage", "ingredient",
                )
                for p in parents
            )
            if not is_food_related:
                continue
            canonical = label_name

        detected.append(canonical)
        confidences.append(conf)

    # Deduplicate while preserving detection order
    seen: set[str] = set()
    unique: list[str] = []
    for name in detected:
        if name not in seen:
            seen.add(name)
            unique.append(name)

    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
    log.info(
        "Rekognition detected %d ingredient(s) (avg_conf=%.2f): %s",
        len(unique), avg_conf, unique,
    )
    return unique, avg_conf
