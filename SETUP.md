# EcoBite — Setup Guide

## Tech Stack
- **Frontend**: React + Vite + TailwindCSS + React Router v7 + Axios
- **Backend**: FastAPI + SQLAlchemy (async) + MySQL + JWT Auth
- **AI**: Claude (recipe generation) + YOLO stub (ingredient detection — model to be trained)
- **DevOps**: Docker + docker-compose

---

## Quick Start (Development)

### 1. Backend

```bash
cd backend
cp .env.example .env          # edit with your values
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The backend auto-creates all database tables on first run.

### 2. Frontend

```bash
# In project root
cp .env.example .env          # edit VITE_API_URL if needed
pnpm install                  # or: npm install
pnpm dev                      # or: npm run dev
```

Open http://localhost:5173

---

## Production (Docker)

```bash
# Set secrets
export SECRET_KEY=your-long-random-secret
export ANTHROPIC_API_KEY=sk-ant-...

docker-compose up --build -d
```

Frontend → http://localhost  
Backend API → http://localhost:8000  
API Docs → http://localhost:8000/docs

---

## Environment Variables

### Backend (`backend/.env`)
| Variable | Description |
|---|---|
| `DATABASE_URL` | MySQL connection string |
| `SECRET_KEY` | JWT signing secret (keep private) |
| `ANTHROPIC_API_KEY` | Claude API key for recipe generation |
| `YOLO_MODEL_PATH` | Path to trained YOLO model (optional, add later) |

### Frontend (`.env`)
| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login → JWT token |
| GET | `/api/v1/users/me` | Get current user profile |
| PUT | `/api/v1/users/me` | Update profile |
| POST | `/api/v1/ingredients/detect` | Upload image → detect ingredients (YOLO stub) |
| POST | `/api/v1/recipes/generate` | Generate recipes via Claude |
| GET | `/api/v1/recipes/saved` | List saved recipes |
| POST | `/api/v1/recipes/saved` | Save a recipe |
| DELETE | `/api/v1/recipes/saved/{id}` | Remove saved recipe |

---

## Connecting the YOLO Model (Later)

1. Train your YOLO model on a food ingredient dataset
2. Save the `.pt` file to `./models/yolo_ingredients.pt`
3. Set `YOLO_MODEL_PATH=./models/yolo_ingredients.pt` in `.env`
4. Update `backend/app/services/yolo_service.py` — the stub comment shows exactly where to add inference code

---

## Connecting Claude (Now)

1. Get an API key from https://console.anthropic.com
2. Set `ANTHROPIC_API_KEY=sk-ant-...` in `backend/.env`
3. Restart the backend — recipes will now be AI-generated

Without the key, the app uses sensible fallback recipes.
