from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.routers import auth, users, ingredients, recipes
import app.models.user  # noqa: F401 – ensures models are registered
import app.models.recipe  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="EcoBite API",
    version="1.0.0",
    description="AI-powered ingredient-to-recipe app",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(ingredients.router, prefix=API_PREFIX)
app.include_router(recipes.router, prefix=API_PREFIX)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
