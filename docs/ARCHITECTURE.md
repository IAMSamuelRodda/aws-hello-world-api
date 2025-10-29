# AWS Hello World API - Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Component Details](#component-details)
4. [Data Flow](#data-flow)
5. [Security Model](#security-model)
6. [Multi-Environment Strategy](#multi-environment-strategy)
7. [Scalability & Performance](#scalability--performance)
8. [Disaster Recovery](#disaster-recovery)
9. [Cost Analysis](#cost-analysis)
10. [Future Enhancements](#future-enhancements)

---

## System Overview

The AWS Hello World API is a serverless application built using AWS SAM (Serverless Application Model). It provides a simple REST API with two endpoints:
- `/hello` - Returns a Hello World message
- `/health` - Health check endpoint for monitoring

### Technology Stack
- **Infrastructure as Code**: AWS SAM (CloudFormation)
- **Runtime**: Node.js 20.x
- **API Gateway**: REST API with CORS support
- **Compute**: AWS Lambda (serverless)
- **Monitoring**: CloudWatch Logs, Metrics, Dashboards, X-Ray
- **Storage**: S3 (deployment artifacts)
- **CI/CD**: GitHub Actions with OIDC authentication

### Design Principles
1. **Serverless-First**: No server management, automatic scaling
2. **Infrastructure as Code**: All resources defined in SAM template
3. **Multi-Environment**: Separate dev, staging, and production environments
4. **Security by Default**: Least-privilege IAM, encryption at rest, private S3 buckets
5. **Observability**: Comprehensive logging, metrics, and distributed tracing
6. **Cost-Optimized**: Pay-per-use model, short log retention for non-prod

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Internet                                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               │ HTTPS
                               │
                    ┌──────────▼──────────┐
                    │   API Gateway       │
                    │  (REST API)         │
                    │  - CORS enabled     │
                    │  - X-Ray tracing    │
                    └──────┬────────┬─────┘
                           │        │
              ┌────────────┘        └────────────┐
              │                                  │
              │ /hello                           │ /health
              │                                  │
    ┌─────────▼─────────┐              ┌────────▼────────┐
    │  Hello World      │              │  Health Check   │
    │  Lambda Function  │              │  Lambda Function│
    │  - Node.js 20     │              │  - Node.js 20   │
    │  - 128MB RAM      │              │  - 128MB RAM    │
    │  - 3s timeout     │              │  - 3s timeout   │
    └─────────┬─────────┘              └────────┬────────┘
              │                                  │
              └──────────┬───────────────────────┘
                         │
                         │ Logs
                         │
              ┌──────────▼──────────┐
              │  CloudWatch Logs    │
              │  - 7 day retention  │
              │  - Structured logs  │
              └──────────┬──────────┘
                         │
                         │
              ┌──────────▼──────────┐
              │  CloudWatch         │
              │  Metrics & Dashboard│
              │  - Invocations      │
              │  - Errors           │
              │  - Duration         │
              │  - API Gateway stats│
              └─────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     Supporting Resources                            │
├─────────────────────────────────────────────────────────────────────┤
│  S3 Bucket (Deployment Artifacts)                                   │
│  - Versioning enabled                                               │
│  - Lifecycle policy (delete old versions after 30 days)             │
│  - Encryption at rest (AES256)                                      │
│  - Public access blocked                                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. API Gateway (HelloWorldApi)

**Resource Type**: `AWS::Serverless::Api`

**Configuration**:
- **Name**: `hello-world-api-{Environment}`
- **Stage**: Environment-specific (dev, staging, prod)
- **Tracing**: AWS X-Ray enabled for distributed tracing
- **OpenAPI Version**: 3.0.1
- **CORS**:
  - Allowed Methods: GET, OPTIONS
  - Allowed Headers: Content-Type, Authorization, X-Api-Key
  - Allowed Origins: * (all origins)

**Endpoints**:
| Path | Method | Lambda Function | Purpose |
|------|--------|-----------------|---------|
| /hello | GET | HelloWorldFunction | Main API endpoint |
| /health | GET | HealthCheckFunction | Health check |

**Integration Type**: AWS Proxy (passes full request to Lambda)

**Key Features**:
- Automatic request/response transformation
- Built-in throttling and rate limiting
- Request validation via OpenAPI schema
- CORS preflight handling

**Location in Code**: `template.yaml:47-84`

---

### 2. Hello World Lambda Function

**Resource Type**: `AWS::Serverless::Function`

**Configuration**:
- **Function Name**: `hello-world-{Environment}`
- **Runtime**: Node.js 20.x
- **Memory**: 128 MB
- **Timeout**: 3 seconds
- **Handler**: `hello.handler` (src/handlers/hello.js)

**Environment Variables**:
- `ENVIRONMENT`: Current environment (dev/staging/prod)
- `API_VERSION`: API version from deployment parameters

**IAM Role**: Auto-generated by SAM with basic Lambda execution permissions

**Event Trigger**: API Gateway GET request to `/hello`

**Response Format**:
```json
{
  "message": "Hello World!",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "environment": "prod",
  "version": "1.0.0"
}
```

**Location in Code**:
- Template: `template.yaml:86-100`
- Handler: `src/handlers/hello.js`

---

### 3. Health Check Lambda Function

**Resource Type**: `AWS::Serverless::Function`

**Configuration**:
- **Function Name**: `hello-world-health-{Environment}`
- **Runtime**: Node.js 20.x
- **Memory**: 128 MB
- **Timeout**: 3 seconds
- **Handler**: `health.handler` (src/handlers/health.js)

**Purpose**:
- Provides health check endpoint for monitoring systems
- Can be extended to check dependencies (databases, external APIs)
- Returns HTTP 200 for healthy, 503 for unhealthy

**Response Format**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Location in Code**:
- Template: `template.yaml:103-117`
- Handler: `src/handlers/health.js`

---

### 4. CloudWatch Log Groups

**Resource Type**: `AWS::Logs::LogGroup`

**Configuration**:
- **Hello World Logs**: `/aws/lambda/hello-world-{Environment}`
- **Health Check Logs**: `/aws/lambda/hello-world-health-{Environment}`
- **Retention**: 7 days (cost optimization for non-critical logs)

**Purpose**:
- Centralized logging for Lambda functions
- Debugging and troubleshooting
- Audit trail for API requests

**Log Format**: JSON structured logs with context information

**Location in Code**: `template.yaml:119-130`

---

### 5. S3 Deployment Bucket

**Resource Type**: `AWS::S3::Bucket`

**Configuration**:
- **Name**: `aws-hello-world-api-{AccountId}-{Environment}`
- **Versioning**: Enabled
- **Encryption**: AES256 server-side encryption
- **Public Access**: Completely blocked
- **Lifecycle Policy**: Delete non-current versions after 30 days

**Purpose**:
- Store Lambda deployment packages
- Store SAM build artifacts
- Versioning for rollback capability

**Security**:
- No public access
- Encryption at rest
- Access via IAM only

**Location in Code**: `template.yaml:132-152`

---

### 6. CloudWatch Dashboard

**Resource Type**: `AWS::CloudWatch::Dashboard`

**Configuration**:
- **Name**: `hello-world-api-{Environment}`
- **Widgets**: 2 metric widgets

**Metrics Displayed**:

**Lambda Metrics**:
- Invocations (Sum)
- Errors (Sum)
- Duration - Average (ms)

**API Gateway Metrics**:
- Total API Calls (Sum)
- 4XX Errors (Sum)
- 5XX Errors (Sum)

**Refresh Interval**: 5 minutes (300 seconds)

**Access**: AWS Console → CloudWatch → Dashboards

**Location in Code**: `template.yaml:154-197`

---

## Data Flow

### Request Flow (Happy Path)

1. **Client Request**
   ```
   GET https://api-id.execute-api.region.amazonaws.com/prod/hello
   ```

2. **API Gateway Processing**
   - Receives HTTPS request
   - Validates request format
   - Checks CORS headers (if preflight)
   - Generates X-Ray trace ID
   - Records request metrics

3. **Lambda Invocation**
   - API Gateway invokes HelloWorldFunction
   - Passes full HTTP event (headers, query params, body)
   - Sets execution context (request ID, trace ID)

4. **Lambda Execution**
   - Function initializes (cold start if needed)
   - Executes handler code
   - Generates response object
   - Logs execution details to CloudWatch

5. **API Gateway Response**
   - Receives Lambda response
   - Adds CORS headers
   - Records response metrics (latency, status)
   - Completes X-Ray trace

6. **Client Response**
   ```json
   HTTP/1.1 200 OK
   Content-Type: application/json
   Access-Control-Allow-Origin: *

   {
     "message": "Hello World!",
     "timestamp": "2024-01-01T12:00:00.000Z",
     "environment": "prod",
     "version": "1.0.0"
   }
   ```

### Error Flow

1. **Lambda Error**
   - Exception thrown in handler
   - Lambda catches error and returns error response
   - CloudWatch logs error with stack trace
   - X-Ray records error in trace

2. **API Gateway Error Handling**
   - Receives 500-series error from Lambda
   - Records 5XX metric
   - Returns error response to client
   - Triggers CloudWatch Alarm (if configured)

### Monitoring Data Flow

```
Lambda Function
      │
      ├─► CloudWatch Logs (log events)
      │
      ├─► CloudWatch Metrics (invocations, errors, duration)
      │
      └─► X-Ray (traces and segments)
              │
              └─► X-Ray Service Map (visualize architecture)
```

---

## Security Model

### Network Security

**API Gateway**:
- HTTPS only (TLS 1.2+)
- AWS-managed certificates
- DDoS protection via AWS Shield Standard
- No VPC required (public endpoint)

**Lambda Functions**:
- Execute in AWS-managed VPC
- No inbound network access
- Outbound internet access for external calls
- Isolated execution environment per invocation

### Identity and Access Management (IAM)

**Lambda Execution Role** (Auto-generated):
```yaml
Permissions:
  - logs:CreateLogGroup
  - logs:CreateLogStream
  - logs:PutLogEvents
  - xray:PutTraceSegments
  - xray:PutTelemetryRecords
```

**API Gateway Permissions**:
- Permission to invoke Lambda functions
- CloudWatch Logs write access for API Gateway logs

**S3 Bucket Policy**:
- Private by default
- Access only via IAM roles
- No public read/write

**GitHub Actions OIDC Role** (cloudformation/github-oidc.yaml):
- Temporary credentials (no long-lived access keys)
- Scoped to specific GitHub repository
- CloudFormation, SAM, S3, Lambda permissions
- Should be scoped to least-privilege (see security recommendations)

### Data Security

**Encryption at Rest**:
- S3 bucket: AES256 encryption enabled
- CloudWatch Logs: Encrypted by default
- Lambda environment variables: AWS KMS (optional, not currently enabled)

**Encryption in Transit**:
- API Gateway: TLS 1.2+ only
- AWS internal: All API calls encrypted

**Secrets Management**:
- No hardcoded credentials in code
- Use AWS Systems Manager Parameter Store for secrets (if needed)
- Use AWS Secrets Manager for database credentials (if needed)

### Security Best Practices Implemented

✅ Private S3 buckets with public access blocked
✅ IAM roles instead of access keys
✅ CloudWatch Logs for audit trail
✅ Encryption at rest and in transit
✅ No hardcoded credentials
✅ CORS configuration for browser security
✅ Short log retention to minimize data exposure

### Security Improvements Needed

⚠️ API Gateway throttling/rate limiting not configured
⚠️ CloudWatch Alarms not configured for security events
⚠️ API authentication not implemented (consider API keys, Cognito, or Lambda authorizers)
⚠️ WAF not configured (consider for production)
⚠️ Lambda function IAM roles could be more restrictive

---

## Multi-Environment Strategy

### Environment Isolation

Each environment (dev, staging, prod) has:
- Separate CloudFormation stack
- Separate Lambda functions
- Separate API Gateway endpoints
- Separate CloudWatch Log Groups
- Separate S3 buckets
- Separate IAM roles

### Environment Configuration

**Development**:
- **Purpose**: Feature development and testing
- **Auto-Deploy**: Yes (on push to `develop` branch)
- **Log Retention**: 7 days
- **Monitoring**: Basic
- **Cost**: Minimal ($5/month estimated)

**Staging**:
- **Purpose**: Pre-production validation
- **Auto-Deploy**: Yes (on merge to `main` branch)
- **Log Retention**: 7 days
- **Monitoring**: Same as production
- **Cost**: Low ($10/month estimated)

**Production**:
- **Purpose**: Live user traffic
- **Auto-Deploy**: No (requires manual approval)
- **Log Retention**: 7 days (increase to 30+ for production)
- **Monitoring**: Full (dashboards, alarms)
- **Cost**: Based on traffic ($50+/month)

### Configuration Management

**SAM Config File** (`samconfig.toml.example`):
```toml
[dev.deploy.parameters]
stack_name = "aws-hello-world-api-dev"
parameter_overrides = "Environment=dev ApiVersion=1.0.0"

[staging.deploy.parameters]
stack_name = "aws-hello-world-api-staging"
parameter_overrides = "Environment=staging ApiVersion=1.0.0"

[prod.deploy.parameters]
stack_name = "aws-hello-world-api-prod"
parameter_overrides = "Environment=prod ApiVersion=1.0.0"
```

**Environment Variables**:
- Passed via CloudFormation parameters
- Injected into Lambda functions at runtime
- No environment-specific code changes needed

---

## Scalability & Performance

### Automatic Scaling

**Lambda**:
- **Concurrent Executions**: 1000 (AWS account default)
- **Reserved Concurrency**: Disabled (commented out due to limits)
- **Scaling**: Automatic based on incoming requests
- **Cold Start**: ~200-500ms for Node.js 20
- **Warm Request**: ~50-100ms

**API Gateway**:
- **Throttle Limit**: 10,000 requests per second (default)
- **Burst Limit**: 5,000 requests (default)
- **Scaling**: Fully automatic
- **Regional**: Single region deployment

### Performance Characteristics

**Memory Configuration**: 128 MB
- Adequate for simple Hello World API
- Increase to 256-512 MB if doing compute-intensive work
- Memory directly affects CPU allocation

**Timeout Configuration**: 3 seconds
- Appropriate for fast API responses
- Increase if calling external services
- API Gateway max timeout: 29 seconds

**Expected Response Times**:
- **p50**: 50-100ms
- **p99**: 150-200ms
- **Cold start p99**: 300-500ms

### Performance Optimization Opportunities

1. **Provisioned Concurrency**: Keep functions warm to avoid cold starts
2. **Lambda Layers**: Share common dependencies across functions
3. **API Gateway Caching**: Cache frequent responses (not enabled)
4. **CloudFront CDN**: Add CDN layer for global distribution
5. **Regional Deployment**: Deploy to multiple regions for lower latency

---

## Disaster Recovery

### Backup Strategy

**Infrastructure**:
- ✅ Infrastructure as Code in git repository
- ✅ Can recreate entire stack from SAM template
- ✅ Version controlled in GitHub

**Lambda Code**:
- ✅ Source code in GitHub
- ✅ Deployment artifacts in S3 with versioning
- ✅ Can rollback to previous version

**Configuration**:
- ✅ Environment variables in SAM template
- ✅ API Gateway configuration in template
- ✅ No manual configuration required

### Recovery Procedures

**Scenario 1: Lambda Function Failure**
- Rollback to previous Lambda version (manual or via CI/CD)
- RTO: 5-10 minutes
- RPO: 0 (no data loss)

**Scenario 2: Entire Stack Deletion**
- Redeploy from SAM template
- RTO: 10-15 minutes
- RPO: 0 (no data loss)

**Scenario 3: Region Failure**
- Deploy to another region using same template
- RTO: 15-30 minutes (manual)
- RPO: 0 (stateless application)

**Scenario 4: Code Corruption**
- Restore from GitHub
- Redeploy via CI/CD
- RTO: 10-15 minutes
- RPO: Last git commit

### High Availability

**Current State**:
- Single region deployment
- No multi-AZ configuration needed (Lambda is multi-AZ by default)
- No database or stateful components

**Availability SLA**:
- **Lambda**: 99.95% (AWS SLA)
- **API Gateway**: 99.95% (AWS SLA)
- **Combined**: ~99.9%

**For Higher Availability**:
- Deploy to multiple regions
- Use Route 53 health checks and failover
- Consider AWS Global Accelerator

---

## Cost Analysis

### Monthly Cost Estimate (Production)

**Lambda Costs**:
```
Assumptions: 1 million requests/month, 100ms avg duration, 128MB memory

Compute cost: $0.0000002 per GB-second
Request cost: $0.20 per 1M requests

Calculation:
- Compute: 1M requests × 0.1s × 0.125GB × $0.0000002 = $2.50
- Requests: 1M × $0.20/1M = $0.20
Total Lambda: $2.70/month
```

**API Gateway Costs**:
```
Assumptions: 1 million requests/month

REST API: $3.50 per million requests (first 333M)
Total API Gateway: $3.50/month
```

**CloudWatch Costs**:
```
Assumptions: 1M requests, 5KB per log, 7-day retention

Logs ingestion: $0.50 per GB
Logs storage: $0.03 per GB per month

Calculation:
- Log volume: 1M × 5KB = 5GB/month
- Ingestion: 5GB × $0.50 = $2.50
- Storage: 5GB × $0.03 = $0.15
Total CloudWatch: $2.65/month
```

**S3 Costs**:
```
Assumptions: 100MB deployment artifacts, 10 versions

Storage: $0.023 per GB per month
Total S3: ~$0.25/month
```

**X-Ray Costs**:
```
Assumptions: 1M traces/month

Free tier: 100K traces/month
Paid: $5 per 1M traces

Calculation:
- Free: 100K traces
- Paid: 900K × $5/1M = $4.50
Total X-Ray: $4.50/month
```

**Total Monthly Cost (1M requests)**: ~$14/month

### Cost Optimization

**Implemented**:
- ✅ Minimal Lambda memory (128MB)
- ✅ Short timeout (3 seconds)
- ✅ 7-day log retention
- ✅ S3 lifecycle policy
- ✅ No reserved capacity

**Additional Opportunities**:
- Reduce X-Ray sampling rate (currently 100%)
- Implement API Gateway caching for frequently accessed endpoints
- Use CloudWatch Logs Insights sparingly (queries are expensive)
- Monitor and right-size Lambda memory based on actual usage

---

## Future Enhancements

### Short Term (1-3 months)

1. **API Authentication**
   - Implement API key authentication
   - Or integrate AWS Cognito for user authentication
   - Or implement Lambda authorizer for custom auth

2. **Enhanced Monitoring**
   - Add CloudWatch Alarms for errors and latency
   - Set up SNS notifications for critical alerts
   - Configure X-Ray sampling rules for better trace analysis

3. **Security Hardening**
   - Add API Gateway throttling/rate limiting
   - Implement WAF rules for common attacks
   - Scope IAM permissions to least-privilege

4. **CI/CD Enhancements**
   - Add automated integration tests
   - Add code quality gates (linting, formatting)
   - Add security scanning (dependency vulnerabilities)

### Medium Term (3-6 months)

1. **Database Integration**
   - Add DynamoDB for persistent storage
   - Implement CRUD operations
   - Add database backup/restore procedures

2. **Multi-Region Deployment**
   - Deploy to multiple AWS regions
   - Set up Route 53 for geo-routing
   - Implement disaster recovery procedures

3. **Performance Optimization**
   - Add API Gateway response caching
   - Implement Lambda provisioned concurrency for critical endpoints
   - Add CloudFront for global CDN

4. **Advanced Observability**
   - Implement custom CloudWatch metrics
   - Add application-level dashboards
   - Integrate with third-party monitoring (Datadog, New Relic)

### Long Term (6-12 months)

1. **Microservices Architecture**
   - Break down into multiple specialized services
   - Implement event-driven architecture with EventBridge/SQS
   - Add API Gateway custom domains

2. **Developer Experience**
   - Create local development environment with SAM CLI
   - Add hot-reload for local testing
   - Implement feature flags for safer deployments

3. **Advanced Security**
   - Implement end-to-end encryption
   - Add API versioning and deprecation strategy
   - Implement comprehensive audit logging

4. **Compliance & Governance**
   - Add automated compliance checks
   - Implement resource tagging strategy
   - Add cost allocation and budgeting

---

## Appendix

### Key Files Reference

| File | Purpose | Location |
|------|---------|----------|
| template.yaml | SAM infrastructure definition | `/template.yaml:1-227` |
| hello.js | Hello World Lambda handler | `/src/handlers/hello.js` |
| health.js | Health check Lambda handler | `/src/handlers/health.js` |
| deploy.yml | GitHub Actions CI/CD workflow | `/.github/workflows/deploy.yml` |
| github-oidc.yaml | OIDC authentication for GitHub | `/cloudformation/github-oidc.yaml` |
| samconfig.toml | SAM CLI configuration | `/samconfig.toml.example` |

### AWS Resource Naming Convention

```
Format: {resource-type}-{environment}
Examples:
  - hello-world-dev
  - hello-world-api-staging
  - aws-hello-world-api-123456789012-prod (S3 buckets)
```

### Tags Applied to All Resources

| Tag | Value | Purpose |
|-----|-------|---------|
| Environment | dev/staging/prod | Identify environment |
| Project | aws-hello-world-api | Group related resources |
| Version | API version | Track deployments |

---

**Document Version**: 1.0
**Last Updated**: 2024-01-01
**Author**: DevOps Team
**Next Review**: [Date + 3 months]
