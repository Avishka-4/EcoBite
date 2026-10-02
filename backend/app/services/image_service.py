"""
image_service.py — Profile photo compression and resizing using Pillow.

All profile photos are resized to at most MAX_DIMENSION × MAX_DIMENSION pixels
(preserving aspect ratio) and re-encoded as JPEG before upload.  This keeps
S3 storage costs low and ensures consistent delivery sizes over CloudFront.

Typical savings
---------------
  Phone camera JPEG (4000×3000, ~4 MB)  →  512×384 JPEG, ~35–80 KB  (≈98% reduction)
  PNG screenshot   (1080×2340, ~1.5 MB) →  236×512 JPEG, ~20–50 KB  (≈97% reduction)

The caller always receives JPEG bytes regardless of the original format, so
`content_type` and `file_extension` are normalised to `image/jpeg` / `"jpg"`.
"""

from __future__ import annotations

import io
import logging
from typing import Tuple

from PIL import Image, ImageOps, UnidentifiedImageError

log = logging.getLogger(__name__)

# Maximum dimension (width or height) in pixels after resizing
MAX_DIMENSION: int = 512

# JPEG quality: 85 gives an excellent quality/size balance
JPEG_QUALITY: int = 85

# Hard cap on input size accepted by this function (defence-in-depth;
# the router also validates, but we check here too)
MAX_INPUT_BYTES: int = 10 * 1024 * 1024  # 10 MB


class ImageProcessingError(Exception):
    """Raised when the supplied bytes cannot be parsed as an image."""


def compress_profile_photo(
    image_bytes: bytes,
    max_dimension: int = MAX_DIMENSION,
    quality: int = JPEG_QUALITY,
) -> Tuple[bytes, str, str]:
    """
    Resize and compress a profile photo.

    Parameters
    ----------
    image_bytes : bytes
        Raw image data (JPEG, PNG, WebP, GIF, or BMP).
    max_dimension : int
        Maximum width or height in pixels after resizing (default: 512).
    quality : int
        JPEG quality 1–95 (default: 85).

    Returns
    -------
    compressed_bytes : bytes
        JPEG-encoded image bytes.
    content_type : str
        Always ``"image/jpeg"``.
    file_extension : str
        Always ``"jpg"``.

    Raises
    ------
    ImageProcessingError
        If the bytes cannot be decoded as an image.
    ValueError
        If ``image_bytes`` exceeds MAX_INPUT_BYTES.
    """
    if len(image_bytes) > MAX_INPUT_BYTES:
        raise ValueError(
            f"Image too large for processing: {len(image_bytes)} bytes "
            f"(max {MAX_INPUT_BYTES} bytes)."
        )

    try:
        img: Image.Image = Image.open(io.BytesIO(image_bytes))
    except UnidentifiedImageError as exc:
        raise ImageProcessingError(
            "Cannot identify image format. "
            "Supported formats: JPEG, PNG, WebP, GIF, BMP."
        ) from exc
    except Exception as exc:
        raise ImageProcessingError(f"Failed to open image: {exc}") from exc

    original_format = img.format or "unknown"
    original_size = img.size  # (width, height)

    # ── Normalise ────────────────────────────────────────────────────────────
    # Apply EXIF orientation so the photo isn't rotated after re-encoding
    img = ImageOps.exif_transpose(img)

    # Convert palette / RGBA / LA / P modes to RGB for JPEG encoding
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    # ── Resize ───────────────────────────────────────────────────────────────
    width, height = img.size
    if width > max_dimension or height > max_dimension:
        img.thumbnail(
            (max_dimension, max_dimension),
            Image.Resampling.LANCZOS,  # highest-quality downsampling
        )
        log.debug(
            "Resized profile photo %s → %s (format=%s)",
            original_size, img.size, original_format,
        )

    # ── Encode ───────────────────────────────────────────────────────────────
    output = io.BytesIO()
    img.save(
        output,
        format="JPEG",
        quality=quality,
        optimize=True,
        progressive=True,    # progressive JPEG renders faster in browsers
    )
    compressed = output.getvalue()

    reduction_pct = (1 - len(compressed) / len(image_bytes)) * 100
    log.info(
        "Profile photo compressed: %d B → %d B (%.1f%% reduction, "
        "final size=%s, original_format=%s)",
        len(image_bytes), len(compressed), reduction_pct,
        img.size, original_format,
    )

    return compressed, "image/jpeg", "jpg"
