# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AWS Hello World API project. The repository is currently empty and needs to be initialized with a basic serverless API setup.

## Initial Setup Commands

### For AWS Lambda with API Gateway (Serverless Framework)
```bash
# Install Serverless Framework globally
npm install -g serverless

# Create a new serverless service
serverless create --template aws-nodejs --path .

# Install dependencies
npm install

# Deploy to AWS
serverless deploy

# Test the deployed function
serverless invoke -f hello

# Remove from AWS
serverless remove
```

### For AWS SAM (Serverless Application Model)
```bash
# Initialize SAM application
sam init --runtime nodejs18.x --name aws-hello-world-api

# Build the application
sam build

# Deploy (first time - guided)
sam deploy --guided

# Deploy (subsequent times)
sam deploy

# Local testing
sam local start-api

# Delete stack
sam delete
```

### For CDK (Cloud Development Kit)
```bash
# Install CDK CLI
npm install -g aws-cdk

# Initialize CDK app
cdk init app --language typescript

# Install dependencies
npm install

# Bootstrap CDK (first time only per AWS account/region)
cdk bootstrap

# Deploy
cdk deploy

# Destroy
cdk destroy
```

## Recommended Architecture

For a Hello World API, consider this structure:

```
aws-hello-world-api/
├── src/
│   └── handlers/
│       └── hello.js        # Lambda function handler
├── tests/
│   └── unit/
│       └── hello.test.js   # Unit tests
├── template.yaml           # SAM template (if using SAM)
├── serverless.yml          # Serverless config (if using Serverless)
├── package.json            # Node.js dependencies
└── README.md               # Documentation
```

## Key Implementation Details

### Lambda Handler Pattern
```javascript
// src/handlers/hello.js
exports.handler = async (event) => {
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            message: 'Hello World!',
            timestamp: new Date().toISOString()
        })
    };
};
```

## Testing Commands

```bash
# Run unit tests
npm test

# Run integration tests (if using SAM)
sam local start-api
curl http://localhost:3000/hello

# Test deployed endpoint
curl https://YOUR_API_ENDPOINT/hello
```

## AWS Configuration

Ensure AWS credentials are configured:
```bash
# Configure AWS CLI
aws configure

# Verify configuration
aws sts get-caller-identity
```

## Common Development Tasks

1. **Adding a new endpoint**: Create new handler in `src/handlers/`, update SAM/Serverless template
2. **Environment variables**: Define in template.yaml or serverless.yml under Environment/Variables
3. **API Gateway configuration**: Modify in template under Events section
4. **IAM permissions**: Update Policies section in template

## Deployment Considerations

- Use environment-specific configuration files (dev, staging, prod)
- Enable CloudWatch logging for debugging
- Set up proper CORS configuration for frontend access
- Consider using API keys or AWS Cognito for authentication