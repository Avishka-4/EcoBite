"""
yolo_service.py — Real ingredient detection using YOLO11n (Ultralytics Nano).

The model is loaded lazily on first call. If YOLO_MODEL_PATH is set in the
environment, that file is loaded. Otherwise the Ultralytics library will
auto-download yolo11n.pt (~6 MB) on first use.

COCO Classes Included:
  YOLO11n is trained on COCO-128.  The food-relevant classes are mapped
  to common ingredient names below.  For broader ingredient coverage
  (spices, packaged goods, etc.) a custom fine-tuned model is recommended
  as future work.
"""

from __future__ import annotations

import io
import logging
from typing import List, Tuple

from PIL import Image

from app.core.config import settings

log = logging.getLogger(__name__)

# ── COCO class → canonical ingredient name mapping ──────────────────────────
# Only classes relevant to food/ingredients are listed here.
# Non-food COCO classes (person, car, …) are intentionally omitted.
COCO_FOOD_MAP: dict[str, str] = {
    "banana": "banana",
    "apple": "apple",
    "sandwich": "sandwich",
    "orange": "orange",
    "broccoli": "broccoli",
    "carrot": "carrot",
    "hot dog": "sausage",
    "pizza": "pizza",
    "donut": "donut",
    "cake": "cake",
    "bowl": "bowl",
    "bottle": "bottle",
    "wine glass": "wine",
    "cup": "cup",
    "fork": "fork",
    "knife": "knife",
    "spoon": "spoon",
    "dining table": "dining table",
    "potted plant": "herbs",
    "vase": "vase",
    # Additional COCO items sometimes miscategorised as food
    "cell phone": None,  # explicitly exclude
    "person": None,
    "car": None,
}

# ── Lazy-loaded model singleton ──────────────────────────────────────────────
_yolo_model = None


def _get_model():
    """Load YOLO11n once and reuse across requests."""
    global _yolo_model
    if _yolo_model is None:
        try:
            from ultralytics import YOLO  # type: ignore

            model_path = settings.YOLO_MODEL_PATH or "yolo11n.pt"
            log.info("Loading YOLO model from: %s", model_path)
            _yolo_model = YOLO(model_path)
            log.info("YOLO model loaded. Classes: %d", len(_yolo_model.names))
        except Exception as exc:
            log.warning("Failed to load YOLO model: %s", exc)
            _yolo_model = None  # keep None so we can retry on next request
    return _yolo_model


def is_model_available() -> bool:
    """Return True if the YOLO model loaded (or can be loaded) successfully."""
    try:
        return _get_model() is not None
    except Exception:
        return False


async def detect_ingredients(image_bytes: bytes) -> Tuple[List[str], float]:
    """
    Detect food ingredients in an image using YOLO11n.

    Returns
    -------
    ingredients : list[str]
        Deduplicated list of canonical ingredient names found in the image.
    confidence : float
        Mean detection confidence (0–1). 0.0 if no model available.
    """
    model = _get_model()

    if model is None:
        # No model available — return empty rather than random
        log.warning("YOLO model unavailable. Returning empty ingredient list.")
        return [], 0.0

    try:
        # Decode image
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        # Run inference (verbose=False suppresses console output)
        results = model(img, verbose=False)

        detected: list[str] = []
        confidences: list[float] = []

        for result in results:
            for box in result.boxes:
                cls_id = int(box.cls.item())
                cls_name: str = model.names.get(cls_id, "")
                conf: float = float(box.conf.item())

                # Only keep food-relevant classes with confidence > 30%
                if conf < 0.30:
                    continue

                canonical = COCO_FOOD_MAP.get(cls_name.lower())
                if canonical is None:
                    # Not in the food map (either explicitly excluded or unknown)
                    continue

                detected.append(canonical)
                confidences.append(conf)

        # Deduplicate while preserving order
        seen: set[str] = set()
        unique: list[str] = []
        for name in detected:
            if name not in seen:
                seen.add(name)
                unique.append(name)

        avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
        log.info("YOLO detected %d ingredients (conf=%.2f)", len(unique), avg_conf)
        return unique, avg_conf

    except Exception as exc:
        log.error("YOLO inference error: %s", exc)
        return [], 0.0
