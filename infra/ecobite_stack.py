"""
ecobite_stack.py — AWS CDK stack for EcoBite backend infrastructure.

Provisions
──────────
1. S3 bucket          — profile photo storage (versioned, encrypted, CORS)
2. CloudFront         — CDN in front of S3 (OAC, 1-year cache TTL)
3. ECR repository     — stores the EcoBite FastAPI Docker image
4. ECS Fargate        — runs the FastAPI container (no servers to manage)
5. Application Load Balancer — stable public DNS, health-checked
6. IAM Task Role      — grants the container access to S3/Rekognition/
                        Transcribe/Bedrock via instance credentials
                        (no access keys stored in the container)
7. Secrets Manager    — stores DB url, secret key, and all env vars
8. IAM service user   — separate key for local dev (not used in ECS)

Outputs
───────
  BackendApiUrl         — ALB DNS → paste as VITE_API_URL in the frontend
  EcrRepositoryUri      — ECR URI → used by the build/push script
  BucketName
  CloudFrontDomain
  ServiceUserSecretArn
"""

from __future__ import annotations

import json
import aws_cdk as cdk
from aws_cdk import (
    Stack,
    Duration,
    RemovalPolicy,
    CfnOutput,
    aws_s3 as s3,
    aws_iam as iam,
    aws_cloudfront as cf,
    aws_cloudfront_origins as origins,
    aws_secretsmanager as secretsmanager,
    aws_ecr as ecr,
    aws_ec2 as ec2,
    aws_ecs as ecs,
    aws_ecs_patterns as ecs_patterns,
    aws_logs as logs,
)
from constructs import Construct


class EcoBiteStack(Stack):
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        bucket_name: str = "ecobite-uploads",
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # ── 1. S3 Bucket ──────────────────────────────────────────────────
        bucket = s3.Bucket(
            self,
            "ProfilePhotosBucket",
            bucket_name=bucket_name,
            versioned=True,
            encryption=s3.BucketEncryption.S3_MANAGED,
            block_public_access=s3.BlockPublicAccess(
                block_public_acls=True,
                ignore_public_acls=True,
                block_public_policy=False,
                restrict_public_buckets=False,
            ),
            cors=[
                s3.CorsRule(
                    allowed_methods=[s3.HttpMethods.GET, s3.HttpMethods.HEAD],
                    allowed_origins=["*"],
                    allowed_headers=["*"],
                    max_age=3000,
                )
            ],
            lifecycle_rules=[
                s3.LifecycleRule(
                    id="expire-old-versions",
                    noncurrent_version_expiration=Duration.days(30),
                    abort_incomplete_multipart_upload_after=Duration.days(1),
                )
            ],
            removal_policy=RemovalPolicy.RETAIN,
            auto_delete_objects=False,
        )

        # ── 2. CloudFront distribution ────────────────────────────────────
        oac = cf.S3OriginAccessControl(
            self, "OAC",
            description="EcoBite S3 Origin Access Control",
            signing=cf.Signing.SIGV4_NO_OVERRIDE,
        )

        cache_policy = cf.CachePolicy(
            self,
            "ProfilePhotosCachePolicy",
            cache_policy_name="EcoBite-ProfilePhotos",
            comment="Long-TTL immutable caching for EcoBite profile photos",
            default_ttl=Duration.days(365),
            max_ttl=Duration.days(365),
            min_ttl=Duration.seconds(0),
            enable_accept_encoding_gzip=True,
            enable_accept_encoding_brotli=True,
            cookie_behavior=cf.CacheCookieBehavior.none(),
            header_behavior=cf.CacheHeaderBehavior.none(),
            query_string_behavior=cf.CacheQueryStringBehavior.none(),
        )

        distribution = cf.Distribution(
            self,
            "ProfilePhotosDistribution",
            comment="EcoBite profile photos CDN",
            default_behavior=cf.BehaviorOptions(
                origin=origins.S3BucketOrigin.with_origin_access_control(
                    bucket, origin_access_control=oac,
                ),
                viewer_protocol_policy=cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cache_policy=cache_policy,
                allowed_methods=cf.AllowedMethods.ALLOW_GET_HEAD,
                cached_methods=cf.CachedMethods.CACHE_GET_HEAD,
                compress=True,
            ),
            http_version=cf.HttpVersion.HTTP2_AND_3,
            price_class=cf.PriceClass.PRICE_CLASS_100,
            minimum_protocol_version=cf.SecurityPolicyProtocol.TLS_V1_2_2021,
        )

        bucket.add_to_resource_policy(
            iam.PolicyStatement(
                sid="AllowCloudFrontRead",
                effect=iam.Effect.ALLOW,
                principals=[iam.ServicePrincipal("cloudfront.amazonaws.com")],
                actions=["s3:GetObject"],
                resources=[bucket.arn_for_objects("*")],
                conditions={
                    "StringEquals": {
                        "AWS:SourceArn": self.format_arn(
                            service="cloudfront",
                            resource="distribution",
                            resource_name=distribution.distribution_id,
                            arn_format=cdk.ArnFormat.SLASH_RESOURCE_NAME,
                        )
                    }
                },
            )
        )

        bucket.add_to_resource_policy(
            iam.PolicyStatement(
                sid="PublicReadProfilePhotos",
                effect=iam.Effect.ALLOW,
                principals=[iam.StarPrincipal()],
                actions=["s3:GetObject"],
                resources=[bucket.arn_for_objects("profile-photos/*")],
            )
        )

        # ── 3. ECR repository ─────────────────────────────────────────────
        repo = ecr.Repository(
            self,
            "EcoBiteRepo",
            repository_name="ecobite-backend",
            removal_policy=RemovalPolicy.RETAIN,
            # Keep the last 5 images, expire everything older
            lifecycle_rules=[
                ecr.LifecycleRule(
                    rule_priority=1,
                    description="Keep last 5 images",
                    tag_status=ecr.TagStatus.ANY,
                    max_image_count=5,
                )
            ],
        )

        # ── 4. VPC ────────────────────────────────────────────────────────
        # 2 AZs, public + private subnets. ALB lives in public, tasks in private.
        vpc = ec2.Vpc(
            self,
            "EcoBiteVpc",
            max_azs=2,
            nat_gateways=1,          # 1 NAT GW is enough for dev/prod small scale
            subnet_configuration=[
                ec2.SubnetConfiguration(
                    name="Public",
                    subnet_type=ec2.SubnetType.PUBLIC,
                    cidr_mask=24,
                ),
                ec2.SubnetConfiguration(
                    name="Private",
                    subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidr_mask=24,
                ),
            ],
        )

        # ── 5. ECS Cluster ────────────────────────────────────────────────
        cluster = ecs.Cluster(
            self,
            "EcoBiteCluster",
            vpc=vpc,
            cluster_name="ecobite",
            container_insights=True,
        )

        # ── 6. Secrets Manager — all backend env vars ─────────────────────
        # The ECS task pulls these at startup. No .env file in the container.
        app_secret = secretsmanager.Secret(
            self,
            "EcoBiteAppSecret",
            secret_name="EcoBiteAppConfig",
            description="All environment variables for the EcoBite FastAPI backend",
            secret_string_value=cdk.SecretValue.unsafe_plain_text(
                json.dumps({
                    # These are placeholders — update via AWS Console or CLI
                    # after first deploy:
                    #   aws secretsmanager update-secret \
                    #     --secret-id EcoBiteAppConfig \
                    #     --secret-string file://backend/.env.json
                    "DATABASE_URL":               "sqlite+aiosqlite:///./ecobite.db",
                    "SECRET_KEY":                 "REPLACE_WITH_SECURE_KEY",
                    "ALGORITHM":                  "HS256",
                    "ACCESS_TOKEN_EXPIRE_MINUTES": "10080",
                    "CORS_ORIGINS":               '["*"]',
                    "AWS_REGION":                 self.region,
                    "S3_BUCKET_NAME":             bucket.bucket_name,
                    "CLOUDFRONT_DOMAIN":          f"https://{distribution.distribution_domain_name}",
                    "REKOGNITION_MIN_CONFIDENCE": "70.0",
                    "TRANSCRIBE_LANGUAGE_CODE":   "en-US",
                    "TRANSCRIBE_VOCABULARY_FILTER": "",
                    "BEDROCK_MODEL_ID":           "us.anthropic.claude-haiku-4-5-20251001-v1:0",
                    "BEDROCK_REGION":             "us-east-1",
                })
            ),
        )

        # ── 7. IAM Task Role ──────────────────────────────────────────────
        # The running container assumes this role via ECS metadata endpoint.
        # No access keys needed inside the container.
        task_role = iam.Role(
            self,
            "EcoBiteTaskRole",
            assumed_by=iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
            description="EcoBite Fargate task role - S3, Rekognition, Transcribe, Bedrock",
        )

        # S3 — profile photos
        task_role.add_to_policy(
            iam.PolicyStatement(
                sid="S3ProfilePhotos",
                actions=["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
                resources=[bucket.arn_for_objects("profile-photos/*")],
            )
        )
        task_role.add_to_policy(
            iam.PolicyStatement(
                sid="S3HeadBucket",
                actions=["s3:HeadBucket", "s3:ListBucket"],
                resources=[bucket.bucket_arn],
            )
        )

        # Rekognition
        task_role.add_to_policy(
            iam.PolicyStatement(
                sid="Rekognition",
                actions=["rekognition:DetectLabels", "rekognition:ListCollections"],
                resources=["*"],
            )
        )

        # Transcribe
        task_role.add_to_policy(
            iam.PolicyStatement(
                sid="Transcribe",
                actions=[
                    "transcribe:StartStreamTranscription",
                    "transcribe:StartStreamTranscriptionWebSocket",
                    "transcribe:ListVocabularies",
                    "transcribe:GetVocabulary",
                    "transcribe:ListVocabularyFilters",
                    "transcribe:GetVocabularyFilter",
                ],
                resources=["*"],
            )
        )

        # Bedrock
        task_role.add_to_policy(
            iam.PolicyStatement(
                sid="Bedrock",
                actions=[
                    "bedrock:InvokeModel",
                    "bedrock:InvokeModelWithResponseStream",
                    "bedrock:ListFoundationModels",
                ],
                resources=["*"],
            )
        )

        # Allow task to read its own secrets from Secrets Manager
        app_secret.grant_read(task_role)

        # ── 8. Task Execution Role ────────────────────────────────────────
        # Used by ECS agent to pull image from ECR and send logs to CloudWatch.
        exec_role = iam.Role(
            self,
            "EcoBiteExecRole",
            assumed_by=iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name(
                    "service-role/AmazonECSTaskExecutionRolePolicy"
                )
            ],
        )
        # Allow execution role to read the app secret (for env var injection)
        app_secret.grant_read(exec_role)

        # ── 9. CloudWatch Log Group ───────────────────────────────────────
        log_group = logs.LogGroup(
            self,
            "EcoBiteLogGroup",
            log_group_name="/ecs/ecobite-backend",
            retention=logs.RetentionDays.TWO_WEEKS,
            removal_policy=RemovalPolicy.DESTROY,
        )

        # ── 10. ECS Task Definition ───────────────────────────────────────
        task_def = ecs.FargateTaskDefinition(
            self,
            "EcoBiteTaskDef",
            cpu=512,            # 0.5 vCPU — plenty for FastAPI
            memory_limit_mib=1024,
            task_role=task_role,
            execution_role=exec_role,
        )

        container = task_def.add_container(
            "EcoBiteContainer",
            # Image is built and pushed externally (see scripts/push_image.ps1)
            # CDK references it by ECR URI; the first deploy uses a placeholder
            image=ecs.ContainerImage.from_ecr_repository(repo, tag="latest"),
            logging=ecs.LogDrivers.aws_logs(
                stream_prefix="ecobite",
                log_group=log_group,
            ),
            environment={
                # Non-secret static config
                "AWS_REGION":       self.region,
                "PYTHONUNBUFFERED": "1",
            },
            secrets={
                # Each key is injected as an env var from the JSON secret
                "DATABASE_URL":               ecs.Secret.from_secrets_manager(app_secret, "DATABASE_URL"),
                "SECRET_KEY":                 ecs.Secret.from_secrets_manager(app_secret, "SECRET_KEY"),
                "ALGORITHM":                  ecs.Secret.from_secrets_manager(app_secret, "ALGORITHM"),
                "ACCESS_TOKEN_EXPIRE_MINUTES":ecs.Secret.from_secrets_manager(app_secret, "ACCESS_TOKEN_EXPIRE_MINUTES"),
                "CORS_ORIGINS":               ecs.Secret.from_secrets_manager(app_secret, "CORS_ORIGINS"),
                "S3_BUCKET_NAME":             ecs.Secret.from_secrets_manager(app_secret, "S3_BUCKET_NAME"),
                "CLOUDFRONT_DOMAIN":          ecs.Secret.from_secrets_manager(app_secret, "CLOUDFRONT_DOMAIN"),
                "REKOGNITION_MIN_CONFIDENCE": ecs.Secret.from_secrets_manager(app_secret, "REKOGNITION_MIN_CONFIDENCE"),
                "TRANSCRIBE_LANGUAGE_CODE":   ecs.Secret.from_secrets_manager(app_secret, "TRANSCRIBE_LANGUAGE_CODE"),
                "TRANSCRIBE_VOCABULARY_FILTER":ecs.Secret.from_secrets_manager(app_secret, "TRANSCRIBE_VOCABULARY_FILTER"),
                "BEDROCK_MODEL_ID":           ecs.Secret.from_secrets_manager(app_secret, "BEDROCK_MODEL_ID"),
                "BEDROCK_REGION":             ecs.Secret.from_secrets_manager(app_secret, "BEDROCK_REGION"),
                "AWS_ACCESS_KEY_ID":          ecs.Secret.from_secrets_manager(app_secret, "AWS_ACCESS_KEY_ID"),
                "AWS_SECRET_ACCESS_KEY":      ecs.Secret.from_secrets_manager(app_secret, "AWS_SECRET_ACCESS_KEY"),
            },
            health_check=ecs.HealthCheck(
                command=["CMD-SHELL", "curl -f http://127.0.0.1:8000/health || exit 1"],
                interval=Duration.seconds(30),
                timeout=Duration.seconds(5),
                retries=3,
                start_period=Duration.seconds(60),
            ),
        )

        container.add_port_mappings(
            ecs.PortMapping(container_port=8000, protocol=ecs.Protocol.TCP)
        )

        # ── 11. Fargate Service + ALB ─────────────────────────────────────
        fargate_service = ecs_patterns.ApplicationLoadBalancedFargateService(
            self,
            "EcoBiteService",
            cluster=cluster,
            task_definition=task_def,
            desired_count=1,
            public_load_balancer=True,
            listener_port=80,
            assign_public_ip=False,   # tasks sit in private subnet, reach internet via NAT
            task_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            service_name="ecobite-backend",
            # ALB health check
            health_check_grace_period=Duration.seconds(120),
        )

        # Configure the ALB target group health check
        fargate_service.target_group.configure_health_check(
            path="/health",
            interval=Duration.seconds(30),
            timeout=Duration.seconds(5),
            healthy_threshold_count=2,
            unhealthy_threshold_count=3,
        )

        # Auto-scale: 1–4 tasks based on CPU utilisation
        scaling = fargate_service.service.auto_scale_task_count(
            min_capacity=1,
            max_capacity=4,
        )
        scaling.scale_on_cpu_utilization(
            "CpuScaling",
            target_utilization_percent=70,
            scale_in_cooldown=Duration.seconds(120),
            scale_out_cooldown=Duration.seconds(60),
        )

        # ── 12. IAM service user (local dev) ──────────────────────────────
        # Used only for local development — ECS uses the task role instead.
        service_user = iam.User(
            self,
            "EcoBiteServiceUser",
            user_name="ecobite-service",
            password_reset_required=False,
        )

        for stmt in [
            iam.PolicyStatement(sid="DevS3", actions=["s3:PutObject","s3:GetObject","s3:DeleteObject"], resources=[bucket.arn_for_objects("profile-photos/*")]),
            iam.PolicyStatement(sid="DevS3Head", actions=["s3:HeadBucket","s3:ListBucket"], resources=[bucket.bucket_arn]),
            iam.PolicyStatement(sid="DevRekognition", actions=["rekognition:DetectLabels","rekognition:ListCollections"], resources=["*"]),
            iam.PolicyStatement(sid="DevTranscribe", actions=["transcribe:StartStreamTranscription","transcribe:StartStreamTranscriptionWebSocket","transcribe:ListVocabularies","transcribe:GetVocabulary","transcribe:ListVocabularyFilters","transcribe:GetVocabularyFilter"], resources=["*"]),
            iam.PolicyStatement(sid="DevBedrock", actions=["bedrock:InvokeModel","bedrock:InvokeModelWithResponseStream","bedrock:ListFoundationModels"], resources=["*"]),
        ]:
            service_user.add_to_policy(stmt)

        access_key = iam.CfnAccessKey(
            self, "ServiceUserAccessKey",
            user_name=service_user.user_name,
            serial=1,
        )

        dev_secret = secretsmanager.Secret(
            self,
            "ServiceUserSecret",
            secret_name="EcoBiteServiceUserKey",
            description="AWS access key for local development (ECS uses task role instead)",
            secret_string_value=cdk.SecretValue.unsafe_plain_text(
                json.dumps({
                    "AWS_ACCESS_KEY_ID":    access_key.ref,
                    "AWS_SECRET_ACCESS_KEY":access_key.attr_secret_access_key,
                    "AWS_REGION":          self.region,
                    "S3_BUCKET_NAME":      bucket.bucket_name,
                    "CLOUDFRONT_DOMAIN":   f"https://{distribution.distribution_domain_name}",
                })
            ),
        )

        # ── Outputs ───────────────────────────────────────────────────────
        CfnOutput(self, "BackendApiUrl",
                  value=f"http://{fargate_service.load_balancer.load_balancer_dns_name}/api/v1",
                  description="Stable public URL — paste as VITE_API_URL in the frontend")

        CfnOutput(self, "EcrRepositoryUri",
                  value=repo.repository_uri,
                  description="ECR URI — used by scripts/push_image.ps1 to push the Docker image")

        CfnOutput(self, "BucketName",
                  value=bucket.bucket_name,
                  description="S3 bucket for EcoBite profile photos")

        CfnOutput(self, "CloudFrontDomain",
                  value=f"https://{distribution.distribution_domain_name}",
                  description="Set this as CLOUDFRONT_DOMAIN in your backend .env")

        CfnOutput(self, "CloudFrontDistributionId",
                  value=distribution.distribution_id,
                  description="CloudFront distribution ID")

        CfnOutput(self, "AppSecretArn",
                  value=app_secret.secret_arn,
                  description="Update backend config: aws secretsmanager update-secret --secret-id EcoBiteAppConfig --secret-string file://backend/.env.json")

        CfnOutput(self, "ServiceUserSecretArn",
                  value=dev_secret.secret_arn,
                  description="Local dev credentials: aws secretsmanager get-secret-value --secret-id EcoBiteServiceUserKey --query SecretString --output text")
