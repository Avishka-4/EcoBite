"""
vosk_service.py — Voice-based ingredient detection using Vosk with a constrained vocabulary.

Vosk runs locally and uses KaldiRecognizer with culinary ingredient vocabulary.
"""

from __future__ import annotations

import io
import json
import logging
import os
import wave
from typing import List, Tuple, Set

try:
    import audioop
except ImportError:
    try:
        import audioop_lts as audioop  # Python 3.13+ compatibility
    except ImportError:
        audioop = None

from app.core.config import settings

log = logging.getLogger(__name__)

# ── Canonical Ingredient Mapping & Constrained Vocabulary ───────────────────
# Maps recognized spoken words/phrases to clean canonical ingredient names
INGREDIENT_CANONICAL_MAP: dict[str, str] = {
    # Vegetables & Aromatics
    "tomato": "tomatoes",
    "tomatoes": "tomatoes",
    "potato": "potatoes",
    "potatoes": "potatoes",
    "onion": "onions",
    "onions": "onions",
    "garlic": "garlic",
    "ginger": "ginger",
    "carrot": "carrots",
    "carrots": "carrots",
    "broccoli": "broccoli",
    "spinach": "spinach",
    "mushroom": "mushrooms",
    "mushrooms": "mushrooms",
    "pepper": "bell peppers",
    "peppers": "bell peppers",
    "bell pepper": "bell peppers",
    "bell peppers": "bell peppers",
    "chili": "chillies",
    "chillies": "chillies",
    "chilli": "chillies",
    "chili pepper": "chillies",
    "green chili": "chillies",
    "cucumber": "cucumber",
    "cucumbers": "cucumber",
    "cabbage": "cabbage",
    "cauliflower": "cauliflower",
    "lettuce": "lettuce",
    "zucchini": "zucchini",
    "eggplant": "eggplant",
    "aubergine": "eggplant",
    "peas": "green peas",
    "pea": "green peas",
    "corn": "corn",
    "sweet corn": "corn",
    "celery": "celery",
    "leek": "leek",
    "leeks": "leek",
    "pumpkin": "pumpkin",
    "beetroot": "beetroot",
    "radish": "radish",
    "asparagus": "asparagus",
    "curry leaf": "curry leaves",
    "curry leaves": "curry leaves",

    # Legumes & Pulses
    "lentil": "lentils",
    "lentils": "lentils",
    "dal": "lentils",
    "chickpea": "chickpeas",
    "chickpeas": "chickpeas",
    "beans": "beans",
    "black beans": "black beans",
    "kidney beans": "kidney beans",

    # Fruits
    "apple": "apples",
    "apples": "apples",
    "banana": "bananas",
    "bananas": "bananas",
    "orange": "oranges",
    "oranges": "oranges",
    "lemon": "lemon",
    "lemons": "lemon",
    "lime": "lime",
    "limes": "lime",
    "avocado": "avocado",
    "avocados": "avocado",
    "mango": "mango",
    "mangoes": "mango",
    "strawberry": "strawberries",
    "strawberries": "strawberries",
    "blueberry": "blueberries",
    "blueberries": "blueberries",
    "pineapple": "pineapple",
    "coconut": "coconut",
    "coconut milk": "coconut milk",

    # Proteins & Meats
    "chicken": "chicken",
    "chicken breast": "chicken",
    "beef": "beef",
    "pork": "pork",
    "fish": "fish",
    "salmon": "salmon",
    "tuna": "tuna",
    "shrimp": "shrimp",
    "prawn": "shrimp",
    "prawns": "shrimp",
    "egg": "eggs",
    "eggs": "eggs",
    "tofu": "tofu",
    "paneer": "paneer",
    "sausage": "sausage",
    "bacon": "bacon",
    "ham": "ham",
    "turkey": "turkey",
    "mutton": "mutton",
    "lamb": "lamb",

    # Dairy
    "cheese": "cheese",
    "cheddar": "cheese",
    "mozzarella": "cheese",
    "parmesan": "cheese",
    "milk": "milk",
    "butter": "butter",
    "cream": "cream",
    "yogurt": "yogurt",

    # Grains, Pasta & Bakery
    "rice": "rice",
    "pasta": "pasta",
    "noodle": "noodles",
    "noodles": "noodles",
    "spaghetti": "pasta",
    "bread": "bread",
    "flour": "flour",
    "oats": "oats",
    "quinoa": "quinoa",

    # Herbs, Spices & Pantry
    "olive oil": "olive oil",
    "oil": "cooking oil",
    "vegetable oil": "cooking oil",
    "soy sauce": "soy sauce",
    "vinegar": "vinegar",
    "turmeric": "turmeric",
    "cumin": "cumin",
    "coriander": "coriander",
    "curry powder": "curry powder",
    "cinnamon": "cinnamon",
    "cardamom": "cardamom",
    "clove": "cloves",
    "cloves": "cloves",
    "mustard": "mustard",
    "black pepper": "black pepper",
    "salt": "salt",
    "sugar": "sugar",
    "honey": "honey",
    "basil": "basil",
    "oregano": "oregano",
    "thyme": "thyme",
    "rosemary": "rosemary",
    "parsley": "parsley",
    "mint": "mint",
}

# Connective words allowed in speech grammar to improve flow
_CONNECTIVE_WORDS = [
    "i", "have", "we", "got", "some", "and", "with", "a", "few", "also",
    "plus", "there", "is", "are", "of", "the", "fresh", "frozen", "red",
    "green", "white", "yellow", "black"
]

# Distinct vocabulary terms for Vosk grammar JSON
_VOCAB_WORDS = sorted(list(set(
    word for phrase in INGREDIENT_CANONICAL_MAP.keys() for word in phrase.split()
) | set(_CONNECTIVE_WORDS)))

_GRAMMAR_LIST = _VOCAB_WORDS + ["[unk]"]
_GRAMMAR_JSON = json.dumps(_GRAMMAR_LIST)

_vosk_model = None


def _get_vosk_model():
    """Load or download Vosk model once."""
    global _vosk_model
    if _vosk_model is not None:
        return _vosk_model

    try:
        from vosk import Model, SetLogLevel
        SetLogLevel(-1)  # Quiet Vosk logs

        model_path = settings.VOSK_MODEL_PATH
        if model_path and os.path.isdir(model_path):
            log.info("Loading local Vosk model from: %s", model_path)
            _vosk_model = Model(model_path)
        else:
            log.info("Loading default Vosk model 'vosk-model-small-en-us-0.15'...")
            _vosk_model = Model(model_name="vosk-model-small-en-us-0.15")
        log.info("Vosk model initialized successfully.")
    except Exception as exc:
        log.warning("Failed to initialize Vosk model: %s", exc)
        _vosk_model = None

    return _vosk_model


def is_vosk_available() -> bool:
    """Check if Vosk model is ready or can be instantiated."""
    try:
        return _get_vosk_model() is not None
    except Exception:
        return False


def _convert_audio_to_pcm_16k(audio_bytes: bytes) -> bytes:
    """
    Convert incoming audio bytes (WAV, WebM, etc.) into 16000Hz mono 16-bit PCM.
    """
    # 1. Primary: Try reading as standard WAV (direct from Web Audio API)
    try:
        with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
            n_channels = wf.getnchannels()
            sampwidth = wf.getsampwidth()
            framerate = wf.getframerate()
            frames = wf.readframes(wf.getnframes())

            if audioop is not None:
                # Convert stereo to mono if needed
                if n_channels == 2:
                    frames = audioop.tomono(frames, sampwidth, 1, 1)
                # Convert sample width to 16-bit (2 bytes)
                if sampwidth != 2:
                    frames = audioop.lin2lin(frames, sampwidth, 2)
                # Resample to 16000 Hz if needed
                if framerate != 16000:
                    frames, _ = audioop.ratecv(frames, 2, 1, framerate, 16000, None)
                return frames
            elif framerate == 16000 and n_channels == 1 and sampwidth == 2:
                return frames
    except Exception as e:
        log.debug("WAV read note: %s", e)

    # 2. Secondary: Try PyDub if available
    try:
        from pydub import AudioSegment
        audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
        audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
        return audio.raw_data
    except Exception as e:
        log.debug("PyDub conversion note: %s", e)

    return audio_bytes


def _extract_ingredients_from_text(text: str) -> list[str]:
    """Scan transcript for known single-word and two-word ingredient items."""
    if not text:
        return []

    words = text.lower().replace(",", " ").replace(".", " ").split()
    detected: list[str] = []

    # 1. Check two-word items (e.g. 'bell peppers', 'coconut milk', 'curry leaves', 'olive oil')
    i = 0
    while i < len(words):
        if i + 1 < len(words):
            two_word = f"{words[i]} {words[i+1]}"
            if two_word in INGREDIENT_CANONICAL_MAP:
                canonical = INGREDIENT_CANONICAL_MAP[two_word]
                if canonical not in detected:
                    detected.append(canonical)
                i += 2
                continue

        single = words[i]
        if single in INGREDIENT_CANONICAL_MAP:
            canonical = INGREDIENT_CANONICAL_MAP[single]
            if canonical not in detected:
                detected.append(canonical)
        i += 1

    return detected


async def detect_ingredients_from_voice(audio_bytes: bytes) -> Tuple[List[str], float]:
    """
    Process speech audio and detect ingredient names using Vosk.
    """
    model = _get_vosk_model()
    if model is None:
        log.warning("Vosk model unavailable for voice detection.")
        return [], 0.0

    try:
        from vosk import KaldiRecognizer

        pcm_data = _convert_audio_to_pcm_16k(audio_bytes)
        if not pcm_data or len(pcm_data) < 100:
            log.warning("Received empty or corrupt PCM audio data (%d bytes)", len(pcm_data) if pcm_data else 0)
            return [], 0.0

        # Try open vocabulary recognizer for high natural speech recognition
        recognizer = KaldiRecognizer(model, 16000)
        recognizer.SetWords(True)

        chunk_size = 4000
        recognized_texts: list[str] = []

        for i in range(0, len(pcm_data), chunk_size):
            chunk = pcm_data[i:i + chunk_size]
            if recognizer.AcceptWaveform(chunk):
                res = json.loads(recognizer.Result())
                text = res.get("text", "")
                if text:
                    recognized_texts.append(text)

        final_res = json.loads(recognizer.FinalResult())
        final_text = final_res.get("text", "")
        if final_text:
            recognized_texts.append(final_text)

        transcription = " ".join(recognized_texts).strip().lower()
        log.info("Vosk transcription: '%s'", transcription)

        detected = _extract_ingredients_from_text(transcription)

        # If open vocabulary didn't catch anything, try grammar-constrained recognizer as fallback
        if not detected:
            constrained_rec = KaldiRecognizer(model, 16000, _GRAMMAR_JSON)
            c_texts: list[str] = []
            for i in range(0, len(pcm_data), chunk_size):
                chunk = pcm_data[i:i + chunk_size]
                if constrained_rec.AcceptWaveform(chunk):
                    res = json.loads(constrained_rec.Result())
                    t = res.get("text", "")
                    if t:
                        c_texts.append(t)
            c_final = json.loads(constrained_rec.FinalResult())
            c_final_text = c_final.get("text", "")
            if c_final_text:
                c_texts.append(c_final_text)
            c_transcription = " ".join(c_texts).strip().lower()
            log.info("Vosk constrained fallback transcription: '%s'", c_transcription)
            detected = _extract_ingredients_from_text(c_transcription)

        confidence = 0.95 if detected else 0.0
        log.info("Final detected %d ingredients: %s", len(detected), detected)
        return detected, confidence

    except Exception as exc:
        log.error("Vosk voice detection error: %s", exc)
        return [], 0.0
