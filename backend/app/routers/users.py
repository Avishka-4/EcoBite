from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.user import UserResponse, UserProfileUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_profile(
    profile: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    for field, value in profile.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    await db.commit()
    await db.refresh(current_user)
    return current_user
