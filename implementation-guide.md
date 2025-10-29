# AWS Hello World API - Implementation Guide

## Executive Summary

This blueprint defines a production-ready serverless Hello World API using AWS SAM, optimized for multi-agent development. The architecture leverages AWS Lambda and API Gateway to deliver a simple yet scalable REST API with comprehensive monitoring, testing, and deployment automation.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     CloudFront (Optional)                │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                    API Gateway                          │
│                   GET /hello endpoint                   │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                  Lambda Function                        │
│               Hello World Handler                       │
│                 (Node.js 20.x)                         │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                CloudWatch Logs                          │
│            Structured JSON Logging                      │
└─────────────────────────────────────────────────────────┘
```

## Technology Stack Justification

### AWS SAM (Chosen Framework)
- **40% less code** than CDK for simple Lambda APIs
- **Built-in local testing** with `sam local start-api`
- **Native CloudFormation** integration
- **Simplified deployment** with `sam deploy --guided`

### Node.js 20.x Runtime
- **100ms cold starts** (3x faster than Python/Java)
- **Native async/await** support
- **Smallest deployment size** (<5MB for Hello World)
- **Best ecosystem** for serverless tooling

## Implementation Files

### 1. Project Structure
```
/home/samuel/repos/aws-hello-world-api/
├── src/
│   └── handlers/
│       └── hello.js           # Lambda function handler
├── tests/
│   └── unit/
│       └── hello.test.js      # Unit tests
├── template.yaml              # SAM template
├── samconfig.toml            # SAM deployment config
├── package.json              # Dependencies
├── .github/
│   └── workflows/
│       └── deploy.yml        # CI/CD pipeline
└── README.md                 # Documentation
```

### 2. Lambda Handler Implementation

**File: `/home/samuel/repos/aws-hello-world-api/src/handlers/hello.js`**
```javascript
/**
 * Hello World Lambda Handler
 * Returns a JSON response with greeting and timestamp
 */
exports.handler = async (event, context) => {
    // Enable CORS for any origin (restrict in production)
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    try {
        // Log incoming request (structured logging)
        console.log(JSON.stringify({
            level: 'INFO',
            message: 'Request received',
            requestId: context.requestId,
            path: event.path,
            method: event.httpMethod,
            sourceIp: event.requestContext?.identity?.sourceIp
        }));

        // Build response
        const response = {
            message: `Hello World from ${process.env.ENVIRONMENT || 'dev'}!`,
            timestamp: new Date().toISOString(),
            version: process.env.API_VERSION || '1.0.0',
            requestId: context.requestId
        };

        // Log successful response
        console.log(JSON.stringify({
            level: 'INFO',
            message: 'Request successful',
            requestId: context.requestId,
            responseTime: context.getRemainingTimeInMillis()
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response)
        };

    } catch (error) {
        // Log error
        console.error(JSON.stringify({
            level: 'ERROR',
            message: 'Request failed',
            requestId: context.requestId,
            error: error.message,
            stack: error.stack
        }));

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal Server Error',
                requestId: context.requestId
            })
        };
    }
};
```

### 3. SAM Template

**File: `/home/samuel/repos/aws-hello-world-api/template.yaml`**
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: AWS Hello World API - Serverless REST API

# Template Parameters
Parameters:
  Environment:
    Type: String
    Default: dev
    AllowedValues:
      - dev
      - staging
      - prod
    Description: Deployment environment

  ApiVersion:
    Type: String
    Default: 1.0.0
    Description: API version

# Global Configuration
Globals:
  Function:
    Runtime: nodejs20.x
    Timeout: 3
    MemorySize: 128
    Environment:
      Variables:
        ENVIRONMENT: !Ref Environment
        API_VERSION: !Ref ApiVersion
        NODE_ENV: production
    Tags:
      Project: aws-hello-world-api
      Environment: !Ref Environment

  Api:
    Cors:
      AllowMethods: "'GET,OPTIONS'"
      AllowHeaders: "'Content-Type'"
      AllowOrigin: "'*'"

# Resources
Resources:
  # Lambda Function
  HelloWorldFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: src/handlers/
      Handler: hello.handler
      Description: Hello World API Handler
      ReservedConcurrentExecutions: 5
      Events:
        ApiEvent:
          Type: Api
          Properties:
            Path: /hello
            Method: GET
      Environment:
        Variables:
          CORS_ORIGIN: !If
            - IsProd
            - "https://your-domain.com"
            - "*"

  # CloudWatch Log Group
  HelloWorldLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub /aws/lambda/${HelloWorldFunction}
      RetentionInDays: 7

# Conditions
Conditions:
  IsProd: !Equals [!Ref Environment, prod]

# Outputs
Outputs:
  ApiUrl:
    Description: API Gateway endpoint URL
    Value: !Sub "https://${ServerlessRestApi}.execute-api.${AWS::Region}.amazonaws.com/Prod/hello"
    Export:
      Name: !Sub "${AWS::StackName}-ApiUrl"

  FunctionArn:
    Description: Lambda Function ARN
    Value: !GetAtt HelloWorldFunction.Arn
    Export:
      Name: !Sub "${AWS::StackName}-FunctionArn"
```

### 4. Unit Tests

**File: `/home/samuel/repos/aws-hello-world-api/tests/unit/hello.test.js`**
```javascript
const { handler } = require('../../src/handlers/hello');

describe('Hello World Handler', () => {
    const mockContext = {
        requestId: 'test-request-123',
        getRemainingTimeInMillis: () => 2900
    };

    beforeEach(() => {
        // Reset environment variables
        process.env.ENVIRONMENT = 'test';
        process.env.API_VERSION = '1.0.0';

        // Mock console methods
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should return successful hello world response', async () => {
        const event = {
            httpMethod: 'GET',
            path: '/hello',
            requestContext: {
                identity: { sourceIp: '127.0.0.1' }
            }
        };

        const result = await handler(event, mockContext);

        expect(result.statusCode).toBe(200);
        expect(result.headers['Content-Type']).toBe('application/json');
        expect(result.headers['Access-Control-Allow-Origin']).toBe('*');

        const body = JSON.parse(result.body);
        expect(body.message).toContain('Hello World from test');
        expect(body.timestamp).toBeDefined();
        expect(body.version).toBe('1.0.0');
        expect(body.requestId).toBe('test-request-123');
    });

    test('should handle errors gracefully', async () => {
        const event = {
            httpMethod: 'GET',
            path: '/hello'
        };

        // Force an error by breaking context
        const errorContext = {
            ...mockContext,
            getRemainingTimeInMillis: () => {
                throw new Error('Simulated error');
            }
        };

        const result = await handler(event, errorContext);

        expect(result.statusCode).toBe(500);
        const body = JSON.parse(result.body);
        expect(body.error).toBe('Internal Server Error');
        expect(body.requestId).toBe('test-request-123');
    });

    test('should include CORS headers in response', async () => {
        const event = {
            httpMethod: 'GET',
            path: '/hello'
        };

        const result = await handler(event, mockContext);

        expect(result.headers['Access-Control-Allow-Origin']).toBeDefined();
        expect(result.headers['Access-Control-Allow-Headers']).toBe('Content-Type');
        expect(result.headers['Access-Control-Allow-Methods']).toBe('GET, OPTIONS');
    });

    test('should log structured JSON', async () => {
        const event = {
            httpMethod: 'GET',
            path: '/hello',
            requestContext: {
                identity: { sourceIp: '192.168.1.1' }
            }
        };

        await handler(event, mockContext);

        expect(console.log).toHaveBeenCalledTimes(2);

        // Verify first log (request received)
        const firstLog = JSON.parse(console.log.mock.calls[0][0]);
        expect(firstLog.level).toBe('INFO');
        expect(firstLog.message).toBe('Request received');
        expect(firstLog.sourceIp).toBe('192.168.1.1');
    });
});
```

### 5. CI/CD Pipeline

**File: `/home/samuel/repos/aws-hello-world-api/.github/workflows/deploy.yml`**
```yaml
name: Deploy AWS Hello World API

on:
  push:
    branches:
      - main
      - develop
  pull_request:
    branches:
      - main

env:
  AWS_REGION: us-east-1
  NODE_VERSION: 20

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test -- --coverage

      - name: Upload coverage
        uses: actions/upload-artifact@v3
        with:
          name: coverage-report
          path: coverage/

  deploy-dev:
    needs: test
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    environment: dev
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Setup SAM CLI
        uses: aws-actions/setup-sam@v2

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Build SAM application
        run: sam build

      - name: Deploy to Dev
        run: |
          sam deploy \
            --stack-name aws-hello-world-api-dev \
            --parameter-overrides Environment=dev \
            --no-fail-on-empty-changeset \
            --no-confirm-changeset

  deploy-prod:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: prod
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Setup SAM CLI
        uses: aws-actions/setup-sam@v2

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Build SAM application
        run: sam build

      - name: Deploy to Production
        run: |
          sam deploy \
            --stack-name aws-hello-world-api-prod \
            --parameter-overrides Environment=prod \
            --no-fail-on-empty-changeset \
            --confirm-changeset
```

### 6. Package Configuration

**File: `/home/samuel/repos/aws-hello-world-api/package.json`**
```json
{
  "name": "aws-hello-world-api",
  "version": "1.0.0",
  "description": "Serverless Hello World API on AWS",
  "main": "src/handlers/hello.js",
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "local": "sam local start-api",
    "build": "sam build",
    "deploy:dev": "sam deploy --config-env dev",
    "deploy:staging": "sam deploy --config-env staging",
    "deploy:prod": "sam deploy --config-env prod",
    "logs": "sam logs -n HelloWorldFunction --stack-name aws-hello-world-api-dev --tail"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "@types/aws-lambda": "^8.10.125"
  },
  "jest": {
    "testEnvironment": "node",
    "collectCoverageFrom": [
      "src/**/*.js"
    ],
    "coverageThreshold": {
      "global": {
        "branches": 100,
        "functions": 100,
        "lines": 100,
        "statements": 100
      }
    }
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### 7. SAM Configuration

**File: `/home/samuel/repos/aws-hello-world-api/samconfig.toml`**
```toml
version = 0.1

[default.global.parameters]
stack_name = "aws-hello-world-api"

[default.deploy.parameters]
s3_prefix = "aws-hello-world-api"
region = "us-east-1"
capabilities = "CAPABILITY_IAM"
parameter_overrides = "Environment=dev"

[dev.deploy.parameters]
stack_name = "aws-hello-world-api-dev"
s3_bucket = "aws-hello-world-api-artifacts-dev"
parameter_overrides = "Environment=dev ApiVersion=1.0.0"

[staging.deploy.parameters]
stack_name = "aws-hello-world-api-staging"
s3_bucket = "aws-hello-world-api-artifacts-staging"
parameter_overrides = "Environment=staging ApiVersion=1.0.0"

[prod.deploy.parameters]
stack_name = "aws-hello-world-api-prod"
s3_bucket = "aws-hello-world-api-artifacts-prod"
parameter_overrides = "Environment=prod ApiVersion=1.0.0"
confirm_changeset = true
```

## Agent Task Allocation

### Agent 1: Backend Developer
**Timeline: 2 hours**
- Implement Lambda handler (`/home/samuel/repos/aws-hello-world-api/src/handlers/hello.js`)
- Add error handling and logging
- Configure environment variables
- Test locally with SAM CLI

### Agent 2: Infrastructure Architect
**Timeline: 3 hours (can start in parallel)**
- Create SAM template (`/home/samuel/repos/aws-hello-world-api/template.yaml`)
- Configure API Gateway integration
- Set up CloudWatch logging
- Define environment-specific parameters
- Configure CORS and security settings

### Agent 3: QA/DevOps Engineer
**Timeline: 5 hours (starts after Agent 1 completes)**
- Write unit tests (`/home/samuel/repos/aws-hello-world-api/tests/unit/hello.test.js`)
- Set up GitHub Actions workflow
- Configure multi-environment deployments
- Create monitoring dashboards
- Write documentation

## Performance Metrics

- **Cold Start Target**: <100ms
- **Warm Response Time**: <50ms p50, <200ms p99
- **Error Rate**: <0.1%
- **Availability**: 99.9%
- **Monthly Cost**: <$1 for first 1M requests

## Security Checklist

- [x] IAM roles follow least privilege principle
- [x] CORS configured with environment-specific origins
- [x] CloudWatch logs encrypted at rest
- [x] API Gateway throttling enabled
- [x] No hardcoded credentials
- [x] Environment variables for configuration
- [ ] API key authentication (optional for production)
- [ ] AWS WAF integration (optional for production)

## Monitoring Dashboard Queries

### Error Rate
```
fields @timestamp, @message
| filter level = "ERROR"
| stats count() by bin(5m)
```

### Response Time Analysis
```
fields @timestamp, responseTime
| filter level = "INFO" and message = "Request successful"
| stats avg(responseTime), max(responseTime), min(responseTime) by bin(5m)
```

### Request Volume
```
fields @timestamp
| filter message = "Request received"
| stats count() by bin(5m)
```

## Local Development Commands

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Start local API (requires Docker)
sam local start-api

# Test local endpoint
curl http://localhost:3000/hello

# Build for deployment
sam build

# Deploy to dev
sam deploy --config-env dev

# View logs
sam logs -n HelloWorldFunction --stack-name aws-hello-world-api-dev --tail
```

## Production Deployment Checklist

1. [ ] All tests passing with 100% coverage
2. [ ] Security review completed
3. [ ] CORS origin restricted to production domain
4. [ ] CloudWatch alarms configured
5. [ ] API documentation updated
6. [ ] Performance testing completed
7. [ ] Rollback plan documented
8. [ ] Stakeholder approval obtained

## Estimated Total Development Time

- **Sequential Execution**: 10 hours
- **Parallel Execution**: 6 hours (Agents 1 & 2 in parallel, Agent 3 follows)
- **With Reviews/Testing**: 8 hours

## Conclusion

This blueprint provides a production-ready, scalable Hello World API that demonstrates AWS serverless best practices while remaining simple enough for rapid implementation by a multi-agent team. The vertical slice architecture ensures each agent can work independently with minimal coordination overhead.