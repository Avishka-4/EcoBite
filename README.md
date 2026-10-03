<div align="center">

# 🍽️ EcoBite

### *Cook what you have. Waste less.*

**AI-powered food sustainability for a more thoughtful kitchen.**

</div>

---

EcoBite is an AI-powered food sustainability startup helping people turn
available ingredients into practical, personalized meals. By recognizing food
from images or voice input and suggesting recipes with AI, EcoBite helps
households use what they already have instead of throwing it away.

> 🌱 **Our aim:** make everyday cooking easier while reducing avoidable food
> waste, one ingredient and one meal at a time.

## ✨ What it does

- 📸 Detects ingredients from a food photo.
- 🎙️ Accepts ingredients through voice or text.
- 🤖 Generates recipes based on ingredients, cuisine, and cooking experience.
- ❤️ Lets users create profiles and save favourite recipes.
- 📱 Delivers a responsive web app that can also be packaged for Android.

## ☁️ AWS services

| Service | Purpose |
|---|---|
| 📷 **Amazon Rekognition** | Identifies ingredients in uploaded food images. |
| 🎧 **Amazon Transcribe Streaming** | Converts spoken ingredients into text. |
| 🧠 **Amazon Bedrock** | Generates personalized recipes with Claude. |
| 🗂️ **Amazon S3** | Stores profile photos and uploads. |
| 🚀 **Amazon CloudFront** | Delivers stored images through a CDN. |
| ⚙️ **Amazon ECS on AWS Fargate** | Runs the FastAPI backend without managing servers. |
| 📦 **Amazon ECR** | Stores the backend Docker image. |
| 🌐 **Application Load Balancer** | Exposes and health-checks the backend API. |
| 🔒 **Amazon VPC** | Provides private/public networking and NAT access. |
| 🔐 **AWS Secrets Manager** | Stores application configuration and credentials. |
| 🛡️ **AWS IAM** | Controls service and developer permissions. |
| 📊 **Amazon CloudWatch Logs** | Collects backend container logs. |
| ✅ **AWS STS** | Validates AWS identity during service health checks. |

Infrastructure is defined with **AWS CDK** in [`infra/`](infra/).

## 🧩 Tech stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** FastAPI, Python, SQLAlchemy, JWT authentication
- **AI:** Amazon Rekognition, Amazon Transcribe, Amazon Bedrock
- **Storage:** SQLite for local development; object uploads in Amazon S3
- **Deployment:** Docker, Amazon ECS/Fargate, AWS CDK

## 🛠️ Run locally

### Prerequisites

- Node.js 18+
- Python 3.11+
- AWS credentials for Rekognition, Transcribe, Bedrock, and S3 features

### Backend

```powershell
cd backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```powershell
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and the API at
`http://localhost:8000/docs`. Set `VITE_API_URL` in `.env.local` when using a
different backend URL.

## 🚀 Deploy to AWS

```powershell
# Build and push the backend image
.\scripts\push_image.ps1

# Deploy the infrastructure
cd infra
pip install -r requirements.txt
cdk bootstrap
cdk deploy
```

After deployment, use the CDK `BackendApiUrl` output as `VITE_API_URL`.

> 🔐 Never commit AWS access keys or production secrets. Use IAM roles and AWS
> Secrets Manager for deployed environments.


