from pydantic import BaseModel, EmailStr
from typing import Optional
from enum import Enum


class CookingExperience(str, Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    cooking_experience: Optional[CookingExperience] = None
    preferred_cuisine: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    age: Optional[int] = None
    cooking_experience: Optional[str] = None
    preferred_cuisine: Optional[str] = None

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse
