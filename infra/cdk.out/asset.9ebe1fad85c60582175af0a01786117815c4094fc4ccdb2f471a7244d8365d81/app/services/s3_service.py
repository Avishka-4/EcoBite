"""
s3_service.py — AWS S3 file upload service for EcoBite profile photos.

Uploads images to an S3 bucket under the `profile-photos/` prefix and returns
the public URL.  If CLOUDFRONT_DOMAIN is configured the CDN URL is returned
instead of the direct S3 URL, enabling faster delivery.

AWS credentials are read from environment / config:
  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION,
  S3_BUCKET_NAME, CLOUDFRONT_DOMAIN

Security notes
--------------
- Credentials are NEVER logged or returned to callers.
- The boto3 client is created once and reused (thread-safe via a lock).
- Objects are uploaded without a public ACL; access is granted via bucket policy
  (configured in the CDK stack — see infra/ecobite_stack.py).
- The S3 key is namespaced per user and uses a random suffix to prevent
  enumeration.
"""

from __future__ import annotations

import logging
import threading
import uuid
from typing import Optional

import boto3
from botocore.config import Config as BotocoreConfig
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings

log = logging.getLogger(__name__)

# ── Thread-safe lazy client ──────────────────────────────────────────────────
_s3_client = None
_s3_lock = threading.Lock()


def _get_client():
    """Return a cached boto3 S3 client, or None if credentials are missing."""
    global _s3_client
    if _s3_client is not None:
        return _s3_client

    with _s3_lock:
        if _s3_client is not None:
            return _s3_client

        if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY:
            log.warning(
                "AWS credentials not configured (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY "
                "are empty) — S3 is unavailable."
            )
            return None

        try:
            _s3_client = boto3.client(
                "s3",
                region_name=settings.AWS_REGION,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                config=BotocoreConfig(
                    retries={"max_attempts": 3, "mode": "adaptive"},
                    connect_timeout=5,
                    read_timeout=60,
                ),
            )
            log.info(
                "AWS S3 client initialised (region=%s, bucket=%s)",
                settings.AWS_REGION,
                settings.S3_BUCKET_NAME,
            )
        except Exception as exc:
            log.error("Failed to create S3 client: %s: %s", type(exc).__name__, exc)
            return None

    return _s3_client


def reset_client() -> None:
    """Reset the cached client — useful in tests or after credential rotation."""
    global _s3_client
    with _s3_lock:
        _s3_client = None


def is_s3_available() -> bool:
    """Return True if an S3 client can be created from current settings."""
    return _get_client() is not None


async def ping_s3() -> bool:
    """
    Perform a lightweight live call to S3 to verify the bucket is accessible.
    Used by the /health/aws endpoint.
    """
    client = _get_client()
    if client is None:
        return False
    try:
        client.head_bucket(Bucket=settings.S3_BUCKET_NAME)
        return True
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")
        # 403 means the bucket exists but this IAM user lacks s3:GetBucketLocation/
        # s3:ListBucket — still confirms connectivity and that the bucket is there.
        if error_code == "403":
            return True
        log.warning("S3 ping failed for bucket '%s' (%s): %s",
                    settings.S3_BUCKET_NAME, error_code, exc)
        return False
    except (BotoCoreError, Exception) as exc:
        log.warning("S3 ping error: %s: %s", type(exc).__name__, exc)
        return False


def _public_url(s3_key: str) -> str:
    """
    Build the public URL for an S3 object.

    Prefers the CloudFront CDN URL when CLOUDFRONT_DOMAIN is set so that
    callers always get the fastest delivery URL.
    """
    if settings.CLOUDFRONT_DOMAIN:
        domain = settings.CLOUDFRONT_DOMAIN.rstrip("/")
        # Strip any accidental protocol prefix entered in the env var
        if not domain.startswith("https://") and not domain.startswith("http://"):
            domain = f"https://{domain}"
        return f"{domain}/{s3_key}"

    return (
        f"https://{settings.S3_BUCKET_NAME}"
        f".s3.{settings.AWS_REGION}.amazonaws.com/{s3_key}"
    )


def _s3_key_from_url(url: str) -> Optional[str]:
    """
    Extract the S3 object key from either a direct S3 URL or a CloudFront URL.

    Returns None if the key cannot be determined.
    """
    # CloudFront URL: https://<distribution>.cloudfront.net/profile-photos/...
    if settings.CLOUDFRONT_DOMAIN:
        domain = settings.CLOUDFRONT_DOMAIN.rstrip("/")
        if not domain.startswith("https://") and not domain.startswith("http://"):
            domain = f"https://{domain}"
        if url.startswith(domain + "/"):
            return url[len(domain) + 1:]

    # Direct S3 URL: https://<bucket>.s3.<region>.amazonaws.com/<key>
    s3_prefix = (
        f"https://{settings.S3_BUCKET_NAME}"
        f".s3.{settings.AWS_REGION}.amazonaws.com/"
    )
    if url.startswith(s3_prefix):
        return url[len(s3_prefix):]

    log.warning("Cannot parse S3 key from URL: %s", url)
    return None


async def upload_profile_photo(
    user_id: int,
    image_bytes: bytes,
    content_type: str = "image/jpeg",
    file_extension: str = "jpg",
) -> Optional[str]:
    """
    Upload a profile photo to S3.

    Parameters
    ----------
    user_id : int
        Used to namespace the object under ``profile-photos/user-{id}/``.
    image_bytes : bytes
        Raw (optionally pre-compressed) image data.
    content_type : str
        MIME type sent as the S3 ``ContentType`` metadata.
    file_extension : str
        Extension appended to the S3 key (e.g. ``"jpg"``).

    Returns
    -------
    str or None
        Public URL of the uploaded object, or None on failure.
    """
    client = _get_client()
    if client is None:
        log.warning("S3 unavailable — cannot upload profile photo for user %d.", user_id)
        return None

    unique_id = uuid.uuid4().hex[:12]
    s3_key = f"profile-photos/user-{user_id}/{unique_id}.{file_extension}"

    try:
        client.put_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=s3_key,
            Body=image_bytes,
            ContentType=content_type,
            # CacheControl improves CDN performance for static profile photos
            CacheControl="public, max-age=31536000, immutable",
        )
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")
        log.error(
            "S3 upload ClientError for user %d (key=%s, code=%s): %s",
            user_id, s3_key, error_code, exc,
        )
        return None
    except BotoCoreError as exc:
        log.error("S3 upload BotoCoreError for user %d: %s: %s",
                  user_id, type(exc).__name__, exc)
        return None
    except Exception as exc:
        log.error("Unexpected S3 upload error for user %d: %s: %s",
                  user_id, type(exc).__name__, exc)
        return None

    url = _public_url(s3_key)
    log.info("Uploaded profile photo for user %d → %s", user_id, url)
    return url


async def delete_profile_photo(photo_url: str) -> bool:
    """
    Delete a profile photo from S3 by its URL.

    Handles both direct S3 URLs and CloudFront URLs.

    Returns True on success, False on failure.
    """
    client = _get_client()
    if client is None:
        return False

    s3_key = _s3_key_from_url(photo_url)
    if s3_key is None:
        return False

    # Safety guard: only allow deletion within the profile-photos/ prefix
    if not s3_key.startswith("profile-photos/"):
        log.error(
            "Refusing to delete S3 key outside profile-photos/ prefix: %s", s3_key
        )
        return False

    try:
        client.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
        log.info("Deleted S3 object: %s", s3_key)
        return True
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")
        log.error("S3 delete ClientError (key=%s, code=%s): %s", s3_key, error_code, exc)
        return False
    except BotoCoreError as exc:
        log.error("S3 delete BotoCoreError (key=%s): %s: %s",
                  s3_key, type(exc).__name__, exc)
        return False
