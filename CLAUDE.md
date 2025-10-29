# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a production-ready AWS serverless API built with AWS SAM (Serverless Application Model). It provides a REST API with Hello World and health check endpoints, complete with CI/CD pipeline, monitoring, and comprehensive documentation.

**Tech Stack**: Node.js 20, AWS Lambda, API Gateway, CloudWatch, X-Ray, GitHub Actions

## Project Structure

```
aws-hello-world-api/
├── src/handlers/           # Lambda function handlers
│   ├── hello.js           # Main Hello World endpoint
│   └── health.js          # Health check endpoint
├── tests/unit/            # Jest unit tests
│   ├── hello.test.js
│   └── health.test.js
├── .github/
│   └── workflows/
│       └── deploy.yml     # CI/CD pipeline (320 lines, multi-stage)
├── cloudformation/
│   └── github-oidc.yaml   # OIDC authentication for GitHub Actions
├── docs/
│   ├── RUNBOOK.md         # Operational procedures and troubleshooting
│   └── ARCHITECTURE.md    # Detailed system architecture documentation
├── template.yaml          # SAM infrastructure (226 lines)
├── samconfig.toml.example # Environment-specific SAM configurations
└── package.json           # Node.js dependencies and scripts
```

## Common Commands

### Development & Testing
```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code (after installing ESLint)
npm run lint

# Format code (after installing Prettier)
npm run format

# Local testing with SAM
sam build
sam local start-api
curl http://localhost:3000/hello
curl http://localhost:3000/health
```

### Deployment
```bash
# Build the application
sam build

# Deploy to specific environment
sam deploy --config-env dev
sam deploy --config-env staging
sam deploy --config-env prod

# First-time guided deployment
sam deploy --guided

# Validate SAM template
sam validate --lint

# View logs
sam logs --stack-name aws-hello-world-api-dev --tail
```

### AWS Operations
```bash
# Get stack outputs
aws cloudformation describe-stacks --stack-name aws-hello-world-api-prod \
  --query 'Stacks[0].Outputs'

# View Lambda logs
aws logs tail /aws/lambda/hello-world-prod --since 10m --follow

# Test deployed endpoint
curl https://YOUR_API_GATEWAY_URL/prod/hello
curl https://YOUR_API_GATEWAY_URL/prod/health
```

## Architecture Overview

### AWS Resources (defined in template.yaml)

1. **API Gateway REST API** (`HelloWorldApi`)
   - Two endpoints: `/hello` and `/health`
   - CORS enabled for browser access
   - X-Ray tracing enabled
   - OpenAPI 3.0.1 definition
   - Location: `template.yaml:47-84`

2. **Lambda Functions**
   - `HelloWorldFunction`: Main API handler (template.yaml:86-100, src/handlers/hello.js)
   - `HealthCheckFunction`: Health check handler (template.yaml:103-117, src/handlers/health.js)
   - Runtime: Node.js 20.x
   - Memory: 128MB
   - Timeout: 3 seconds

3. **CloudWatch Resources**
   - Log Groups with 7-day retention
   - Custom dashboard with Lambda and API Gateway metrics
   - Location: template.yaml:119-197

4. **S3 Deployment Bucket**
   - Versioning enabled
   - Encryption at rest (AES256)
   - Lifecycle policy (delete old versions after 30 days)
   - Public access blocked
   - Location: template.yaml:132-152

### Multi-Environment Support

Three environments configured via `samconfig.toml`:
- **dev**: Development environment (auto-deploy from `develop` branch)
- **staging**: Pre-production (auto-deploy from `main` branch)
- **prod**: Production (manual approval required)

Each environment has isolated AWS resources (separate Lambda functions, API Gateways, CloudWatch logs, S3 buckets).

## CI/CD Pipeline

### GitHub Actions Workflow (.github/workflows/deploy.yml)

**Trigger Events**:
- Push to `develop` → Deploy to development
- Push to `main` → Deploy to staging + production (with approval)
- Manual workflow dispatch

**Pipeline Stages**:
1. **Test** (runs on all branches)
   - Checkout code
   - Setup Node.js 20
   - Install dependencies
   - Run Jest tests with 80% coverage requirement
   - Upload coverage artifacts

2. **Deploy to Development** (automatic on `develop` push)
   - Configure AWS credentials via OIDC
   - Build with SAM
   - Deploy to dev environment
   - Test deployment with health check

3. **Deploy to Staging** (automatic on `main` push)
   - Same as development deployment
   - Deploy to staging environment
   - Smoke tests after deployment

4. **Deploy to Production** (manual approval required)
   - Requires approval from authorized users
   - Deploy to production environment
   - Comprehensive smoke tests
   - Automatic rollback on failure

### OIDC Authentication

GitHub Actions uses OpenID Connect for secure AWS authentication (no long-lived credentials).

**Setup**:
```bash
# Deploy OIDC stack (one-time setup)
aws cloudformation create-stack \
  --stack-name github-oidc-provider \
  --template-body file://cloudformation/github-oidc.yaml \
  --parameters ParameterKey=GitHubOrganization,ParameterValue=YOUR_ORG \
  --capabilities CAPABILITY_IAM

# Get role ARN for GitHub secret
aws cloudformation describe-stacks --stack-name github-oidc-provider \
  --query 'Stacks[0].Outputs[?OutputKey==`GitHubActionsRoleArn`].OutputValue' --output text
```

Add the role ARN to GitHub repository secrets as `AWS_ROLE_ARN`.

**Security Note**: The OIDC role uses least-privilege permissions (PowerUserAccess has been removed).

## Git Workflow

**Branch Strategy**: Simplified GitFlow

- `main`: Production-ready code (deploys to staging → production)
- `develop`: Integration branch (deploys to development)
- `feature/*`: Feature branches (merge to develop via PR)
- `bugfix/*`: Bug fix branches (merge to develop via PR)
- `hotfix/*`: Critical fixes (merge to both main and develop)

**Commit Message Convention**:
```
<type>: <subject>

Types: feat, fix, docs, style, refactor, test, chore, ci, perf
Examples:
  - feat: add JWT authentication middleware
  - fix: resolve memory leak in connection pool
  - docs: update API endpoint documentation
  - ci: add dependency vulnerability scanning
```

## Adding New Endpoints

1. **Create Lambda handler** in `src/handlers/`:
   ```javascript
   exports.handler = async (event) => {
       // Your logic here
       return {
           statusCode: 200,
           headers: {
               'Content-Type': 'application/json',
               'Access-Control-Allow-Origin': '*'
           },
           body: JSON.stringify({ data: 'your response' })
       };
   };
   ```

2. **Add function to template.yaml**:
   ```yaml
   NewFunction:
     Type: AWS::Serverless::Function
     Properties:
       FunctionName: !Sub 'new-function-${Environment}'
       CodeUri: src/handlers/
       Handler: newfile.handler
       Events:
         NewEndpoint:
           Type: Api
           Properties:
             RestApiId: !Ref HelloWorldApi
             Path: /newpath
             Method: get
   ```

3. **Update OpenAPI definition** in template.yaml (lines 54-83)

4. **Create unit test** in `tests/unit/`

5. **Run tests**: `npm test`

6. **Deploy**: Push to `develop` branch or run `sam deploy --config-env dev`

## Environment Variables

Lambda functions have access to:
- `ENVIRONMENT`: Current environment (dev/staging/prod)
- `API_VERSION`: API version from deployment parameters

Add new environment variables in `template.yaml` under `Globals.Function.Environment.Variables`.

## Testing Strategy

**Unit Tests** (tests/unit/):
- Jest test framework
- 80% code coverage requirement (enforced in CI/CD)
- Mock AWS SDK calls
- Run locally: `npm test`
- Coverage report: `npm run test:coverage`

**Integration Tests**:
- SAM local testing: `sam local start-api`
- Smoke tests in CI/CD after deployment
- Health check verification

**Load Testing** (not currently implemented):
- Consider using Artillery, k6, or AWS Load Testing for production

## Monitoring & Observability

### CloudWatch Dashboard
Access at: `https://console.aws.amazon.com/cloudwatch/home#dashboards:name=hello-world-api-{environment}`

**Metrics**:
- Lambda: Invocations, Errors, Duration
- API Gateway: Request count, 4XX/5XX errors

### Logs
```bash
# View Lambda logs (specific function)
aws logs tail /aws/lambda/hello-world-prod --since 10m --follow

# Filter for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/hello-world-prod \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s)000
```

### X-Ray Tracing
- Enabled on API Gateway and Lambda
- View traces at: https://console.aws.amazon.com/xray/
- Provides end-to-end request flow visualization

### Recommended Alarms (not yet configured)
See `docs/RUNBOOK.md` for alarm configuration guidance:
- Lambda error rate > 5%
- API Gateway 5XX errors > 10 in 5 minutes
- Lambda p99 latency > 200ms

## Security Best Practices

✅ **Implemented**:
- HTTPS-only API Gateway
- OIDC authentication (no long-lived AWS keys)
- Least-privilege IAM roles
- Encrypted S3 buckets (public access blocked)
- Structured logging (no sensitive data)
- CORS configuration
- X-Ray tracing for security monitoring

⚠️ **Not Yet Implemented** (see docs/ARCHITECTURE.md for guidance):
- API authentication (consider API keys, Cognito, or Lambda authorizers)
- API Gateway throttling/rate limiting
- CloudWatch Alarms for security events
- WAF rules for common attacks
- Secrets Manager for sensitive configuration

## Troubleshooting

### Common Issues

**Issue**: Tests failing locally
- Solution: Run `npm install` to ensure dependencies are up to date
- Check Node.js version: `node --version` (should be 20.x)

**Issue**: SAM deployment fails
- Check AWS credentials: `aws sts get-caller-identity`
- Validate template: `sam validate --lint`
- Check for stack errors: `aws cloudformation describe-stack-events --stack-name STACK_NAME`

**Issue**: CI/CD pipeline failing
- Check GitHub Actions logs for specific error
- Verify AWS_ROLE_ARN secret is set correctly
- Ensure OIDC provider is deployed

**Issue**: API returns 502 Bad Gateway
- Check Lambda logs for errors
- Verify Lambda function is not timing out
- Check Lambda handler code for unhandled exceptions

**For detailed troubleshooting**: See `docs/RUNBOOK.md`

## Cost Optimization

**Current Configuration** (optimized for low cost):
- Minimal Lambda memory (128MB)
- Short timeout (3 seconds)
- 7-day log retention
- S3 lifecycle policy (delete old versions)
- No reserved capacity

**Estimated Monthly Cost**:
- Development: ~$5/month
- Staging: ~$10/month
- Production: ~$14/month (based on 1M requests)

See `docs/ARCHITECTURE.md` for detailed cost analysis.

## Documentation

- **RUNBOOK.md**: Operational procedures, deployment steps, monitoring, troubleshooting
- **ARCHITECTURE.md**: Detailed system architecture, data flow, security model, scalability
- **README.md**: Project overview and quick start guide

## Important Files Reference

| File | Purpose | Key Lines |
|------|---------|-----------|
| template.yaml | SAM infrastructure | All (226 lines) |
| .github/workflows/deploy.yml | CI/CD pipeline | All (320 lines) |
| src/handlers/hello.js | Main API handler | - |
| src/handlers/health.js | Health check | - |
| cloudformation/github-oidc.yaml | OIDC authentication | 44-144 (IAM role) |
| samconfig.toml.example | Environment configs | All |
| package.json | Dependencies and scripts | All |

## Next Steps for New Developers

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd aws-hello-world-api
   npm install
   ```

2. **Copy SAM config** (if deploying):
   ```bash
   cp samconfig.toml.example samconfig.toml
   # Edit samconfig.toml with your AWS account details
   ```

3. **Run tests**: `npm test`

4. **Test locally**: `sam build && sam local start-api`

5. **Read documentation**:
   - Start with README.md for overview
   - Review docs/ARCHITECTURE.md for system design
   - Consult docs/RUNBOOK.md for operations

6. **Create feature branch**: `git checkout develop && git checkout -b feature/your-feature`

7. **Make changes, test, commit, push, create PR**

## Support & Resources

- **AWS SAM Documentation**: https://docs.aws.amazon.com/serverless-application-model/
- **GitHub Actions Documentation**: https://docs.github.com/en/actions
- **CloudWatch Documentation**: https://docs.aws.amazon.com/cloudwatch/
- **AWS Lambda Best Practices**: https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html
