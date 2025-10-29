# AWS Hello World API

A production-ready serverless "Hello World" API built with AWS SAM, featuring automated CI/CD, comprehensive testing, and multi-environment support.

## 🚀 Features

- **Serverless Architecture**: Built with AWS Lambda and API Gateway
- **Infrastructure as Code**: AWS SAM for reproducible deployments
- **Multi-Environment Support**: Dev, Staging, and Production environments
- **Automated CI/CD**: GitHub Actions with OIDC authentication
- **Comprehensive Testing**: Unit tests with 100% coverage target
- **Monitoring**: CloudWatch logs and dashboards
- **Security**: OIDC authentication, least-privilege IAM roles
- **Performance**: <100ms cold starts, <50ms response times

## 📋 Prerequisites

- AWS Account with appropriate permissions
- AWS CLI configured (`aws configure`)
- SAM CLI installed (`brew install aws-sam-cli` on macOS)
- Node.js 20.x or later
- GitHub account (for CI/CD)

## 🏗️ Project Structure

```
aws-hello-world-api/
├── src/
│   └── handlers/
│       ├── hello.js          # Main API handler
│       └── health.js         # Health check handler
├── tests/
│   └── unit/
│       ├── hello.test.js     # Handler tests
│       └── health.test.js    # Health check tests
├── .github/
│   └── workflows/
│       └── deploy.yml        # CI/CD pipeline
├── cloudformation/
│   └── github-oidc.yaml      # OIDC provider setup
├── template.yaml             # SAM infrastructure
├── samconfig.toml.example    # SAM deployment config
├── package.json              # Node dependencies
└── README.md                 # This file
```

## 🛠️ Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_ORG/aws-hello-world-api.git
cd aws-hello-world-api
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure SAM

Copy the example configuration and update with your settings:

```bash
cp samconfig.toml.example samconfig.toml
# Edit samconfig.toml with your AWS region and S3 bucket
```

### 4. Setup GitHub OIDC (One-time setup)

Deploy the OIDC provider to your AWS account:

```bash
# Replace YOUR_GITHUB_ORG with your GitHub organization/username
aws cloudformation create-stack \
  --stack-name github-oidc-provider \
  --template-body file://cloudformation/github-oidc.yaml \
  --parameters ParameterKey=GitHubOrganization,ParameterValue=YOUR_GITHUB_ORG \
  --capabilities CAPABILITY_IAM
```

Get the IAM role ARN from the stack outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name github-oidc-provider \
  --query 'Stacks[0].Outputs[?OutputKey==`GitHubActionsRoleArn`].OutputValue' \
  --output text
```

Add this ARN as a secret in your GitHub repository:
- Go to Settings → Secrets and variables → Actions
- Add new secret: `AWS_ROLE_ARN` with the ARN value

## 🚀 Deployment

### Local Development

```bash
# Build the application
sam build

# Start local API
sam local start-api

# Test locally
curl http://localhost:3000/hello
curl http://localhost:3000/health
```

### Deploy to AWS

#### Deploy to Development

```bash
sam deploy --config-env dev
```

#### Deploy to Staging

```bash
sam deploy --config-env staging
```

#### Deploy to Production

```bash
sam deploy --config-env prod
```

### CI/CD Deployment

The GitHub Actions workflow automatically deploys:
- **develop** branch → Development environment
- **main** branch → Staging → Production (with manual approval)

## 📡 API Endpoints

### GET /hello

Returns a Hello World message with timestamp.

**Request:**
```bash
curl https://your-api-gateway-url/dev/hello
```

**Response:**
```json
{
  "message": "Hello World!",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "requestId": "abc123",
  "version": "1.0.0",
  "environment": "dev"
}
```

**Status Codes:**
- `200 OK`: Successful response
- `500 Internal Server Error`: Server error

### GET /health

Health check endpoint for monitoring.

**Request:**
```bash
curl https://your-api-gateway-url/dev/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "checks": {
    "lambda": "healthy",
    "memory": "healthy",
    "environment": "dev",
    "region": "us-east-1"
  },
  "version": "1.0.0"
}
```

**Status Codes:**
- `200 OK`: Service is healthy
- `503 Service Unavailable`: Service is unhealthy

## 🧪 Testing

### Run Unit Tests

```bash
npm test
```

### Run Tests with Coverage

```bash
npm run coverage
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

## 📊 Monitoring

### CloudWatch Logs

View Lambda logs:

```bash
# Hello function logs
sam logs -n HelloWorldFunction --stack-name aws-hello-world-api-dev --tail

# Health check logs
sam logs -n HealthCheckFunction --stack-name aws-hello-world-api-dev --tail
```

### CloudWatch Dashboard

Access the dashboard in AWS Console:
1. Go to CloudWatch → Dashboards
2. Select `hello-world-api-{environment}`

Metrics tracked:
- Lambda invocations
- Error rates
- Response times
- API Gateway requests
- 4XX/5XX errors

## 🔒 Security

### OIDC Authentication

GitHub Actions uses OIDC for secure, temporary AWS credentials:
- No long-lived AWS access keys
- Automatic credential rotation
- Least-privilege IAM roles

### API Security

- CORS headers configured for browser access
- API Gateway throttling (1000 req/s burst, 500 req/s rate)
- CloudWatch monitoring for anomaly detection

## 🎯 Performance

### Optimization Strategies

1. **Minimal Dependencies**: No production dependencies for faster cold starts
2. **Small Bundle Size**: Handlers under 1KB each
3. **Reserved Concurrency**: Predictable performance
4. **Memory Configuration**: 128MB optimized for simple operations

### Performance Metrics

- **Cold Start**: <100ms
- **Warm Response**: <50ms p50, <200ms p99
- **Concurrent Executions**: 10 (reserved)
- **Monthly Cost**: <$1 for first 1M requests

## 🚧 Troubleshooting

### Common Issues

#### SAM Build Fails

```bash
# Clear SAM cache
rm -rf .aws-sam/

# Rebuild
sam build --use-container
```

#### Deployment Fails

```bash
# Check CloudFormation events
aws cloudformation describe-stack-events \
  --stack-name aws-hello-world-api-dev \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]'
```

#### OIDC Authentication Fails

1. Verify the OIDC provider is deployed
2. Check the IAM role trust relationship
3. Ensure GitHub secret `AWS_ROLE_ARN` is correct

### Debug Mode

Enable detailed logging:

```bash
# Set log level in template.yaml
Environment:
  Variables:
    LOG_LEVEL: DEBUG
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Workflow

1. Write tests first (TDD approach)
2. Implement feature
3. Ensure 100% test coverage
4. Run local tests
5. Deploy to dev environment
6. Create PR for review

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- AWS SAM team for the excellent framework
- GitHub Actions for CI/CD capabilities
- Contributors and maintainers

## 📞 Support

For issues, questions, or suggestions:
1. Check the [Troubleshooting](#-troubleshooting) section
2. Search existing [GitHub Issues](https://github.com/YOUR_ORG/aws-hello-world-api/issues)
3. Create a new issue with detailed information

## 📈 Roadmap

- [ ] Add request validation middleware
- [ ] Implement rate limiting per API key
- [ ] Add OpenAPI documentation
- [ ] Create Terraform alternative
- [ ] Add container image support
- [ ] Implement X-Ray tracing
- [ ] Add DynamoDB integration example
- [ ] Create AWS CDK version

---

Built with ❤️ using AWS SAM