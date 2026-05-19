from datetime import datetime
from sqlalchemy import String, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=True)
    age: Mapped[int] = mapped_column(Integer, nullable=True)
    cooking_experience: Mapped[str] = mapped_column(String(20), nullable=True, default="beginner")
    preferred_cuisine: Mapped[str] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    saved_recipes: Mapped[list["SavedRecipe"]] = relationship("SavedRecipe", back_populates="user", cascade="all, delete-orphan")
