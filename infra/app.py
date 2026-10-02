#!/usr/bin/env python3
"""
EcoBite CDK Application entry-point.

Usage
-----
  cd infra
  pip install -r requirements.txt
  cdk bootstrap          # once per AWS account / region
  cdk deploy             # deploy EcoBiteStack
  cdk diff               # preview changes
  cdk destroy            # tear down (prompts for confirmation)

Environment variables consumed at synth time
-------------------------------------------
  CDK_DEFAULT_ACCOUNT   – your 12-digit AWS account ID  (or set in ~/.aws/config)
  CDK_DEFAULT_REGION    – target region                 (default: us-east-1)
  ECOBITE_BUCKET_NAME   – override the S3 bucket name   (default: ecobite-uploads)
"""

import os
import aws_cdk as cdk
from ecobite_stack import EcoBiteStack

app = cdk.App()

EcoBiteStack(
    app,
    "EcoBiteStack",
    bucket_name=os.environ.get("ECOBITE_BUCKET_NAME", "ecobite-uploads"),
    env=cdk.Environment(
        account=os.environ.get("CDK_DEFAULT_ACCOUNT"),
        region=os.environ.get("CDK_DEFAULT_REGION", "us-east-1"),
    ),
    description="EcoBite infrastructure: S3 profile photos, CloudFront CDN, IAM service user",
)

app.synth()
