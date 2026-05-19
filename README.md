# EcoBite

An AI-powered ingredient-to-recipe mobile web app. Take a photo of your fridge or type what you have — EcoBite uses Claude AI to generate personalized recipes matched to your cuisine preferences and cooking skill level.

---

## Features

- **Photo ingredient detection** — upload a photo and YOLO AI identifies your ingredients (model training in progress; stub returns sample results)
- **AI recipe generation** — Claude crafts personalized recipes from your ingredients, cuisine style, and experience level
- **User profiles** — save your preferred cuisine and cooking experience for tailored suggestions
- **Save recipes** — bookmark favourites and access them any time
- **JWT authentication** — secure register/login flow with persistent sessions

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, React Router v7, TailwindCSS v4, Axios, Context API, Vite |
| Backend | FastAPI, Python async, SQLAlchemy (async), JWT auth |
| AI / ML | Claude (Anthropic SDK) for recipes · YOLO (PyTorch) for ingredient detection |
| Database | MySQL 8 |
| DevOps | Docker, docker-compose, Nginx |

---

## Project Structure

```
EcoBite/
├── backend/                  # FastAPI backend
│   ├── app/
│   │   ├── core/             # Config, DB engine, JWT security
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   ├── routers/          # API route handlers
│   │   └── services/         # Claude AI + YOLO service layer
│   ├── requirements.txt
│   └── Dockerfile
├── src/                      # React frontend
│   ├── api/                  # Axios API clients
│   ├── context/              # Auth context (global state)
│   └── app/
│       └── components/
│           └── auth/         # Login & Register screens
├── docker-compose.yml
├── Dockerfile                # Frontend (Nginx)
└── nginx.conf
```

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm / pnpm
- Python 3.11+
- MySQL 8 (or use Docker)

---

### 1. Backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
DATABASE_URL=mysql+aiomysql://root:password@localhost:3306/ecobite
SECRET_KEY=your-long-random-secret
ANTHROPIC_API_KEY=sk-ant-...        # get from console.anthropic.com
YOLO_MODEL_PATH=                    # leave empty until model is trained
```

```bash
python -m venv venv
source venv/bin/activate            # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Database tables are created automatically on first run.  
API docs available at http://localhost:8000/docs

---

### 2. Frontend

```bash
# In project root
cp .env.example .env                # VITE_API_URL=http://localhost:8000/api/v1
npm install                         # or: pnpm install
npm run dev                         # or: pnpm dev
```

Open http://localhost:5173

---

### 3. Docker (Production)

```bash
export SECRET_KEY=your-long-random-secret
export ANTHROPIC_API_KEY=sk-ant-...

docker-compose up --build -d
```

| Service | URL |
|---|---|
| Frontend | http://localhost |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Login → JWT token |
| GET | `/api/v1/users/me` | Get profile |
| PUT | `/api/v1/users/me` | Update profile |
| POST | `/api/v1/ingredients/detect` | Image upload → ingredient list |
| POST | `/api/v1/recipes/generate` | Generate recipes via Claude |
| GET | `/api/v1/recipes/saved` | List saved recipes |
| POST | `/api/v1/recipes/saved` | Save a recipe |
| DELETE | `/api/v1/recipes/saved/{id}` | Remove saved recipe |

---

## Connecting the YOLO Model

Once your model is trained:

1. Copy the `.pt` file to `./models/yolo_ingredients.pt`
2. Set `YOLO_MODEL_PATH=./models/yolo_ingredients.pt` in `backend/.env`
3. Replace the stub in [`backend/app/services/yolo_service.py`](backend/app/services/yolo_service.py) with real inference (the comment shows exactly where)

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | MySQL async connection string |
| `SECRET_KEY` | Yes | JWT signing secret |
| `ALGORITHM` | No | JWT algorithm (default: `HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Token lifetime (default: 10080 = 7 days) |
| `ANTHROPIC_API_KEY` | No | Claude API key — falls back to template recipes if not set |
| `YOLO_MODEL_PATH` | No | Path to trained YOLO `.pt` file |
| `CORS_ORIGINS` | No | Allowed frontend origins |

### Frontend (`.env`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend base URL (default: `http://localhost:8000/api/v1`) |


