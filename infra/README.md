# EcoBite Infrastructure (AWS CDK)

This directory contains the AWS CDK stack that provisions all cloud resources
required to run the EcoBite backend in production.

## What gets deployed

| Resource | Details |
|---|---|
| **S3 bucket** | `ecobite-uploads` (or `$ECOBITE_BUCKET_NAME`). Versioned, AES-256 encrypted. Public ACLs blocked; public read granted via bucket policy on `profile-photos/*` only. |
| **CloudFront** | CDN in front of the bucket. HTTPS-only, HTTP/2+3, 1-year cache TTL for profile photos. |
| **IAM user** | `ecobite-service` — minimum-privilege policy: S3 `PutObject/GetObject/DeleteObject` on `profile-photos/*`, Rekognition `DetectLabels/ListCollections`. |
| **Secrets Manager** | `EcoBiteServiceUserKey` — stores the IAM access key as JSON ready to paste into `.env`. |

## Prerequisites

```bash
# Install AWS CDK CLI
npm install -g aws-cdk

# Install Python dependencies
cd infra
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Make sure your local AWS credentials have enough permissions to run CDK
(typically `AdministratorAccess` for the deploying developer).

## First-time bootstrap

CDK needs a one-time bootstrap per account/region to create its staging bucket:

```bash
cdk bootstrap aws://YOUR_ACCOUNT_ID/us-east-1
```

## Deploy

```bash
# Optional: override bucket name
export ECOBITE_BUCKET_NAME=my-ecobite-bucket

cdk deploy
```

CDK will print all outputs at the end, including `CloudFrontDomain`.

## Retrieve backend credentials

After deploy, fetch the generated access key and paste the values into
`backend/.env`:

```bash
aws secretsmanager get-secret-value \
  --secret-id EcoBiteServiceUserKey \
  --query SecretString \
  --output text | python -m json.tool
```

## Rotate the IAM access key

Increment `serial` on `CfnAccessKey` in `ecobite_stack.py` from `1` → `2`,
then redeploy. The old key is deleted and a new one is generated automatically.

## Tear down (dev/staging only)

```bash
cdk destroy
```

> **Note** The S3 bucket has `RemovalPolicy.RETAIN` so it will **not** be
> deleted by `cdk destroy`. Delete it manually via the console or AWS CLI if
> you really want it gone.
