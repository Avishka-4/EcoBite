import os
import random
from typing import List, Tuple

COMMON_INGREDIENTS = [
    "tomatoes", "onions", "garlic", "chicken breast", "eggs",
    "pasta", "rice", "potatoes", "carrots", "bell peppers",
    "broccoli", "spinach", "mushrooms", "cheese", "butter",
    "olive oil", "lemon", "ginger", "cucumber", "zucchini",
]


def is_model_available() -> bool:
    model_path = os.environ.get("YOLO_MODEL_PATH", "")
    return bool(model_path and os.path.exists(model_path))


async def detect_ingredients(image_bytes: bytes) -> Tuple[List[str], float]:
    """
    Detect food ingredients from an image.

    STUB — replace the body below with real YOLO inference once the model is trained:

        from ultralytics import YOLO
        model = YOLO(settings.YOLO_MODEL_PATH)
        results = model(image_bytes)
        names   = [model.names[int(c)] for c in results[0].boxes.cls]
        conf    = float(results[0].boxes.conf.mean()) if len(results[0].boxes) else 0.0
        return names, conf
    """
    if is_model_available():
        # Real inference will be wired here after training
        pass

    count = random.randint(4, 7)
    detected = random.sample(COMMON_INGREDIENTS, count)
    return detected, 0.0
