from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.routers import auth, users, ingredients, recipes
from app.routers import health as health_router
import app.models.user    # noqa: F401 – registers models with Base
import app.models.recipe  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-create tables on startup (for new deployments / SQLite dev).
    # For existing databases use Alembic: `cd backend && alembic upgrade head`
    async with engine.begin() as conn:
        try:
            await conn.run_sync(Base.metadata.create_all)
        except Exception as e:
            # When running multiple workers, SQLite might throw "table already exists"
            print(f"Warning: DB init error (safe to ignore if concurrent): {e}")
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

# Health endpoints at root level (no /api/v1 prefix) so load-balancers and
# container orchestrators can probe them without versioning concerns.
# Provides:  GET /health  and  GET /health/aws
app.include_router(health_router.router)

# Versioned API routers
app.include_router(auth.router,        prefix=API_PREFIX)
app.include_router(users.router,       prefix=API_PREFIX)
app.include_router(ingredients.router, prefix=API_PREFIX)
app.include_router(recipes.router,     prefix=API_PREFIX)
