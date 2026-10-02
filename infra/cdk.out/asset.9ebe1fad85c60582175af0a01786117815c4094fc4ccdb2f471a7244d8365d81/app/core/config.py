from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./ecobite.db"

    # Generate with: python -c "import secrets; print(secrets.token_hex(32))"
    SECRET_KEY: str = "change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # Restrict to your actual frontend origins in production.
    CORS_ORIGINS: List[str] = ["*"]

    # ── AWS Core ───────────────────────────────────────────────────────────
    # Credentials for the IAM user provisioned by infra/ecobite_stack.py.
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"

    # ── AWS S3 ─────────────────────────────────────────────────────────────
    S3_BUCKET_NAME: str = "ecobite-uploads"

    # CloudFront CDN domain — set from cdk deploy output.
    # Example: "https://d1abc123xyz.cloudfront.net"
    CLOUDFRONT_DOMAIN: str = ""

    # ── AWS Rekognition ────────────────────────────────────────────────────
    # Minimum confidence % (0-100) for ingredient label detection.
    REKOGNITION_MIN_CONFIDENCE: float = 70.0

    # ── AWS Transcribe ─────────────────────────────────────────────────────
    # BCP-47 language code. Full list:
    # https://docs.aws.amazon.com/transcribe/latest/dg/supported-languages.html
    TRANSCRIBE_LANGUAGE_CODE: str = "en-US"

    # Optional Vocabulary Filter name to suppress filler words.
    TRANSCRIBE_VOCABULARY_FILTER: str = ""

    # ── AWS Bedrock (recipe generation) ───────────────────────────────────
    # Claude model ID to use for recipe generation.
    # Recommended: claude-3-haiku  (fastest + cheapest, ~$0.003/recipe)
    # Alternatives:
    #   anthropic.claude-3-sonnet-20240229-v1:0  (better quality, ~$0.015/recipe)
    #   anthropic.claude-3-opus-20240229-v1:0    (best quality,   ~$0.075/recipe)
    # Leave empty to disable Bedrock and use the built-in catalogue instead.
    BEDROCK_MODEL_ID: str = "us.anthropic.claude-haiku-4-5-20251001-v1:0"

    # Bedrock region — Claude models are available in us-east-1 and us-west-2.
    # Leave empty to use the same region as AWS_REGION.
    BEDROCK_REGION: str = "us-east-1"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
