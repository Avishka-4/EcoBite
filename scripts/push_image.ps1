# push_image.ps1 — Build the EcoBite backend Docker image and push to ECR
# Run from the repo root:  .\scripts\push_image.ps1

$ErrorActionPreference = "Stop"

$REGION     = "us-east-1"
$ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text)
$REPO       = "ecobite-backend"
$TAG        = "latest"
$ECR_URI    = "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPO}:${TAG}"

Write-Host "`n==> Authenticating Docker with ECR..." -ForegroundColor Cyan
aws ecr get-login-password --region $REGION |
    docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

Write-Host "`n==> Building Docker image..." -ForegroundColor Cyan
docker build -t "${REPO}:${TAG}" ./backend

Write-Host "`n==> Tagging image as $ECR_URI..." -ForegroundColor Cyan
docker tag "${REPO}:${TAG}" $ECR_URI

Write-Host "`n==> Pushing to ECR..." -ForegroundColor Cyan
docker push $ECR_URI

Write-Host "`n✅  Image pushed: $ECR_URI" -ForegroundColor Green
Write-Host "    Force a new ECS deployment to pick up the new image:" -ForegroundColor Yellow
Write-Host "    aws ecs update-service --cluster ecobite --service ecobite-backend --force-new-deployment --region $REGION" -ForegroundColor Yellow
