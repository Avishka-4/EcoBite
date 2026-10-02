"""
aws_transcribe_service.py — Voice ingredient detection via Amazon Transcribe Streaming.

Uses the Amazon Transcribe Streaming SDK (amazon-transcribe package) to transcribe
audio bytes directly over a WebSocket — no S3 upload roundtrip required.

Flow
----
1. Audio bytes (WAV / WebM / OGG) are normalised to 16 kHz mono 16-bit PCM.
2. PCM chunks are streamed to Amazon Transcribe via an async WebSocket session.
3. Partial + final transcript results are accumulated.
4. The combined transcript is scanned for known ingredient names using
   INGREDIENT_CANONICAL_MAP (identical vocabulary to the former Vosk service).
5. Canonical ingredient names + average confidence are returned.

Supported audio formats from the frontend
------------------------------------------
  audio/wav, audio/webm, audio/ogg, audio/mp4, audio/mpeg

AWS credentials are read from environment / config:
  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION

Security notes
--------------
- Credentials are NEVER logged or returned to callers.
- The boto3 session is created per-request (streaming SDK is not thread-safe
  for reuse across concurrent calls).
- Audio data is streamed directly to AWS — it is NOT stored anywhere.
"""

from __future__ import annotations

import asyncio
import io
import logging
import wave
from typing import List, Tuple

from app.core.config import settings

log = logging.getLogger(__name__)

# ── Ingredient vocabulary (canonical map) ────────────────────────────────────
INGREDIENT_CANONICAL_MAP: dict[str, str] = {
    # Vegetables & Aromatics
    "tomato": "tomatoes", "tomatoes": "tomatoes",
    "potato": "potatoes", "potatoes": "potatoes",
    "onion": "onions", "onions": "onions",
    "garlic": "garlic", "ginger": "ginger",
    "carrot": "carrots", "carrots": "carrots",
    "broccoli": "broccoli", "spinach": "spinach",
    "mushroom": "mushrooms", "mushrooms": "mushrooms",
    "pepper": "bell peppers", "peppers": "bell peppers",
    "bell pepper": "bell peppers", "bell peppers": "bell peppers",
    "chili": "chillies", "chillies": "chillies", "chilli": "chillies",
    "chili pepper": "chillies", "green chili": "chillies",
    "cucumber": "cucumber", "cucumbers": "cucumber",
    "cabbage": "cabbage", "cauliflower": "cauliflower",
    "lettuce": "lettuce", "zucchini": "zucchini",
    "eggplant": "eggplant", "aubergine": "eggplant",
    "peas": "green peas", "pea": "green peas",
    "corn": "corn", "sweet corn": "corn",
    "celery": "celery", "leek": "leek", "leeks": "leek",
    "pumpkin": "pumpkin", "beetroot": "beetroot", "radish": "radish",
    "asparagus": "asparagus",
    "curry leaf": "curry leaves", "curry leaves": "curry leaves",
    # Legumes & Pulses
    "lentil": "lentils", "lentils": "lentils", "dal": "lentils",
    "chickpea": "chickpeas", "chickpeas": "chickpeas",
    "beans": "beans", "black beans": "black beans",
    "kidney beans": "kidney beans",
    # Fruits
    "apple": "apples", "apples": "apples",
    "banana": "bananas", "bananas": "bananas",
    "orange": "oranges", "oranges": "oranges",
    "lemon": "lemon", "lemons": "lemon",
    "lime": "lime", "limes": "lime",
    "avocado": "avocado", "avocados": "avocado",
    "mango": "mango", "mangoes": "mango",
    "strawberry": "strawberries", "strawberries": "strawberries",
    "blueberry": "blueberries", "blueberries": "blueberries",
    "pineapple": "pineapple", "coconut": "coconut",
    "coconut milk": "coconut milk",
    # Proteins & Meats
    "chicken": "chicken", "chicken breast": "chicken",
    "beef": "beef", "pork": "pork", "fish": "fish",
    "salmon": "salmon", "tuna": "tuna",
    "shrimp": "shrimp", "prawn": "shrimp", "prawns": "shrimp",
    "egg": "eggs", "eggs": "eggs",
    "tofu": "tofu", "paneer": "paneer",
    "sausage": "sausage", "bacon": "bacon", "ham": "ham",
    "turkey": "turkey", "mutton": "mutton", "lamb": "lamb",
    # Dairy
    "cheese": "cheese", "cheddar": "cheese",
    "mozzarella": "cheese", "parmesan": "cheese",
    "milk": "milk", "butter": "butter",
    "cream": "cream", "yogurt": "yogurt",
    # Grains, Pasta & Bakery
    "rice": "rice", "pasta": "pasta",
    "noodle": "noodles", "noodles": "noodles", "spaghetti": "pasta",
    "bread": "bread", "flour": "flour", "oats": "oats", "quinoa": "quinoa",
    # Herbs, Spices & Pantry
    "olive oil": "olive oil", "oil": "cooking oil",
    "vegetable oil": "cooking oil", "soy sauce": "soy sauce",
    "vinegar": "vinegar", "turmeric": "turmeric", "cumin": "cumin",
    "coriander": "coriander", "curry powder": "curry powder",
    "cinnamon": "cinnamon", "cardamom": "cardamom",
    "clove": "cloves", "cloves": "cloves",
    "mustard": "mustard", "black pepper": "black pepper",
    "salt": "salt", "sugar": "sugar", "honey": "honey",
    "basil": "basil", "oregano": "oregano", "thyme": "thyme",
    "rosemary": "rosemary", "parsley": "parsley", "mint": "mint",
}

# ── Audio conversion ──────────────────────────────────────────────────────────

def _to_pcm_16k(audio_bytes: bytes) -> bytes:
    """
    Normalise audio bytes to 16 kHz, mono, 16-bit PCM.

    Tries standard WAV parsing first, then falls back to PyDub for
    WebM / OGG / MP4 / MP3 containers.
    """
    # 1. Standard WAV
    try:
        with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
            channels = wf.getnchannels()
            sampwidth = wf.getsampwidth()
            framerate = wf.getframerate()
            frames = wf.readframes(wf.getnframes())

        try:
            import audioop
        except ImportError:
            try:
                import audioop_lts as audioop  # type: ignore
            except ImportError:
                audioop = None  # type: ignore

        if audioop is not None:
            if channels == 2:
                frames = audioop.tomono(frames, sampwidth, 1, 1)
            if sampwidth != 2:
                frames = audioop.lin2lin(frames, sampwidth, 2)
            if framerate != 16000:
                frames, _ = audioop.ratecv(frames, 2, 1, framerate, 16000, None)
        elif framerate == 16000 and channels == 1 and sampwidth == 2:
            pass  # already correct
        else:
            raise ValueError("audioop not available and audio is not already 16 kHz mono 16-bit")

        return frames
    except Exception as wav_err:
        log.debug("WAV parse failed (%s), trying PyDub…", wav_err)

    # 2. PyDub fallback (handles WebM, OGG, MP4, MP3)
    try:
        from pydub import AudioSegment  # type: ignore
        audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
        audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
        return audio.raw_data
    except Exception as pydub_err:
        log.warning("PyDub conversion failed: %s", pydub_err)

    # 3. Last resort — return raw bytes and let Transcribe try to handle it
    return audio_bytes


# ── Ingredient extraction from transcript ─────────────────────────────────────

def _extract_ingredients(text: str) -> list[str]:
    """
    Scan a transcript for known ingredient names (two-word then one-word).
    Returns deduplicated canonical names in detection order.
    """
    if not text:
        return []

    words = text.lower().replace(",", " ").replace(".", " ").split()
    detected: list[str] = []

    i = 0
    while i < len(words):
        # Try two-word phrase first
        if i + 1 < len(words):
            two_word = f"{words[i]} {words[i + 1]}"
            if two_word in INGREDIENT_CANONICAL_MAP:
                canonical = INGREDIENT_CANONICAL_MAP[two_word]
                if canonical not in detected:
                    detected.append(canonical)
                i += 2
                continue
        # Single word
        if words[i] in INGREDIENT_CANONICAL_MAP:
            canonical = INGREDIENT_CANONICAL_MAP[words[i]]
            if canonical not in detected:
                detected.append(canonical)
        i += 1

    return detected


# ── Availability check ────────────────────────────────────────────────────────

def is_transcribe_available() -> bool:
    """Return True if AWS credentials are configured for Transcribe."""
    return bool(settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY)


async def ping_transcribe() -> bool:
    """
    Lightweight live check — lists Transcribe vocabularies (cheap, read-only).
    Used by GET /health/aws.
    """
    if not is_transcribe_available():
        return False
    try:
        import boto3
        from botocore.config import Config as BotocoreConfig
        from botocore.exceptions import BotoCoreError, ClientError

        client = boto3.client(
            "transcribe",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            config=BotocoreConfig(
                retries={"max_attempts": 2, "mode": "standard"},
                connect_timeout=5,
                read_timeout=10,
            ),
        )
        client.list_vocabularies(MaxResults=1)
        return True
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "")
        # ThrottlingException still means the API is up
        if code in ("ThrottlingException", "AccessDeniedException"):
            return True
        log.warning("Transcribe ping ClientError (%s): %s", code, exc)
        return False
    except Exception as exc:
        log.warning("Transcribe ping error: %s: %s", type(exc).__name__, exc)
        return False


# ── Main detection function ───────────────────────────────────────────────────

async def detect_ingredients_from_voice(
    audio_bytes: bytes,
) -> Tuple[List[str], float]:
    """
    Transcribe speech audio and extract ingredient names.

    Uses the Amazon Transcribe Streaming SDK to open a real-time WebSocket
    session — audio bytes are chunked and sent directly, no S3 upload needed.

    Parameters
    ----------
    audio_bytes : bytes
        Raw audio from the frontend (WAV, WebM, OGG, or MP4).

    Returns
    -------
    ingredients : list[str]
        Canonical ingredient names found in the transcript.
    confidence : float
        Mean word-level confidence (0–1), or 0.85 if unavailable.
    """
    if not is_transcribe_available():
        log.warning("AWS Transcribe unavailable — credentials not configured.")
        return [], 0.0

    # Normalise to 16 kHz PCM for Transcribe streaming
    pcm_data = _to_pcm_16k(audio_bytes)
    if not pcm_data or len(pcm_data) < 200:
        log.warning("Audio too short or empty after conversion (%d bytes).", len(pcm_data or b""))
        return [], 0.0

    try:
        from amazon_transcribe.client import TranscribeStreamingClient  # type: ignore
        from amazon_transcribe.handlers import TranscriptResultStreamHandler  # type: ignore
        from amazon_transcribe.model import TranscriptEvent  # type: ignore
    except ImportError:
        log.error(
            "amazon-transcribe SDK not installed. "
            "Run: pip install amazon-transcribe"
        )
        return [], 0.0

    # Accumulate all transcript pieces and confidence scores
    transcript_parts: list[str] = []
    confidence_scores: list[float] = []

    class IngredientHandler(TranscriptResultStreamHandler):
        async def handle_transcript_event(self, transcript_event: TranscriptEvent):
            results = transcript_event.transcript.results
            for result in results:
                if result.is_partial:
                    continue  # wait for final results only
                for alt in result.alternatives:
                    if alt.transcript:
                        transcript_parts.append(alt.transcript)
                    # Collect per-word confidence when available
                    if alt.items:
                        for item in alt.items:
                            if (
                                item.confidence is not None
                                and item.item_type == "pronunciation"
                            ):
                                try:
                                    confidence_scores.append(float(item.confidence))
                                except (TypeError, ValueError):
                                    pass

    async def stream_audio(stream):
        """Feed PCM data in 8 KB chunks into the Transcribe stream."""
        chunk_size = 8 * 1024  # 8 KB ≈ 250 ms of 16 kHz mono audio
        for offset in range(0, len(pcm_data), chunk_size):
            chunk = pcm_data[offset : offset + chunk_size]
            await stream.input_stream.send_audio_event(audio_chunk=chunk)
        await stream.input_stream.end_stream()

    try:
        client = TranscribeStreamingClient(
            region=settings.AWS_REGION,
            # Credentials are picked up from env vars / IAM role automatically
            # by the underlying botocore session.
        )

        stream = await client.start_stream_transcription(
            language_code=settings.TRANSCRIBE_LANGUAGE_CODE,
            media_sample_rate_hz=16000,
            media_encoding="pcm",
            # Vocabulary filter suppresses common non-food filler words
            vocabulary_filter_name=(
                settings.TRANSCRIBE_VOCABULARY_FILTER or None
            ),
            vocabulary_filter_method="remove" if settings.TRANSCRIBE_VOCABULARY_FILTER else None,
            # Enable automatic punctuation for cleaner transcripts
            enable_partial_results_stabilization=False,
            show_speaker_label=False,
        )

        handler = IngredientHandler(stream.output_stream)
        await asyncio.gather(stream_audio(stream), handler.handle_events())

    except Exception as exc:
        log.error(
            "Amazon Transcribe streaming error: %s: %s",
            type(exc).__name__, exc,
        )
        return [], 0.0

    full_transcript = " ".join(transcript_parts).strip()
    log.info("Transcribe transcript: '%s'", full_transcript)

    ingredients = _extract_ingredients(full_transcript)
    avg_confidence = (
        sum(confidence_scores) / len(confidence_scores)
        if confidence_scores
        else (0.85 if ingredients else 0.0)
    )

    log.info(
        "Transcribe detected %d ingredient(s) (avg_conf=%.2f): %s",
        len(ingredients), avg_confidence, ingredients,
    )
    return ingredients, avg_confidence

