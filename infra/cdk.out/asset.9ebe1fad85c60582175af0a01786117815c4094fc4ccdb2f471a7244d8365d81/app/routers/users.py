"""
routers/users.py — User profile management endpoints.

Endpoints
---------
  GET    /api/v1/users/me                   — fetch own profile
  PUT    /api/v1/users/me                   — update own profile
  POST   /api/v1/users/me/profile-photo     — upload / replace profile photo
  DELETE /api/v1/users/me/profile-photo     — remove profile photo
"""

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.user import UserResponse, UserProfileUpdate
from app.services.s3_service import upload_profile_photo, delete_profile_photo
from app.services.image_service import compress_profile_photo, ImageProcessingError

router = APIRouter(prefix="/users", tags=["users"])

# Accepted MIME types for inbound uploads (before re-encoding)
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

# 10 MB hard cap on the raw upload; after compression output will be much smaller
MAX_FILE_SIZE = 10 * 1024 * 1024


@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_profile(
    profile: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update mutable profile fields (name, age, cooking_experience, etc.)."""
    for field, value in profile.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/me/profile-photo", response_model=UserResponse)
async def upload_user_profile_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload or replace the user's profile photo.

    The image is:
      1. Validated (MIME type + size).
      2. Resized to at most 512×512 px and re-encoded as JPEG (Pillow).
      3. Uploaded to S3 under ``profile-photos/user-{id}/``.
      4. The resulting URL (S3 or CloudFront) is saved to the user record.
    """
    # ── 1. Validate MIME type ────────────────────────────────────────────────
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid file type '{content_type}'. "
                f"Allowed types: {', '.join(sorted(ALLOWED_IMAGE_TYPES))}."
            ),
        )

    # ── 2. Read and validate file size ───────────────────────────────────────
    raw_bytes = await file.read()
    if len(raw_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=(
                f"File too large ({len(raw_bytes) // (1024 * 1024)} MB). "
                f"Maximum upload size is {MAX_FILE_SIZE // (1024 * 1024)} MB."
            ),
        )

    # ── 3. Compress / resize with Pillow ────────────────────────────────────
    try:
        compressed_bytes, upload_content_type, file_ext = compress_profile_photo(raw_bytes)
    except ImageProcessingError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except ValueError as exc:
        # Raised when raw bytes exceed the service's internal cap
        raise HTTPException(status_code=400, detail=str(exc))

    # ── 4. Delete old photo from S3 (best-effort, non-blocking) ─────────────
    if current_user.profile_photo_url:
        await delete_profile_photo(current_user.profile_photo_url)

    # ── 5. Upload compressed photo to S3 ────────────────────────────────────
    photo_url = await upload_profile_photo(
        user_id=current_user.id,
        image_bytes=compressed_bytes,
        content_type=upload_content_type,
        file_extension=file_ext,
    )

    if photo_url is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "Photo upload service is currently unavailable. "
                "Please check AWS credentials and S3 bucket configuration."
            ),
        )

    # ── 6. Persist URL in the database ──────────────────────────────────────
    current_user.profile_photo_url = photo_url
    await db.commit()
    await db.refresh(current_user)

    return current_user


@router.delete("/me/profile-photo", response_model=UserResponse)
async def delete_user_profile_photo(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove the user's profile photo from S3 and clear the URL."""
    if current_user.profile_photo_url:
        await delete_profile_photo(current_user.profile_photo_url)
        current_user.profile_photo_url = None
        await db.commit()
        await db.refresh(current_user)

    return current_user
