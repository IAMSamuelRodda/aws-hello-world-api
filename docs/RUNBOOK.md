# AWS Hello World API - Operations Runbook

## Table of Contents
1. [Quick Reference](#quick-reference)
2. [Deployment Procedures](#deployment-procedures)
3. [Rollback Procedures](#rollback-procedures)
4. [Monitoring & Alerting](#monitoring--alerting)
5. [Common Issues & Troubleshooting](#common-issues--troubleshooting)
6. [Emergency Procedures](#emergency-procedures)
7. [Contacts & Escalation](#contacts--escalation)

---

## Quick Reference

### Service URLs
- **Development**: https://API_ID.execute-api.REGION.amazonaws.com/dev
- **Staging**: https://API_ID.execute-api.REGION.amazonaws.com/staging
- **Production**: https://API_ID.execute-api.REGION.amazonaws.com/prod

### AWS Resources
```bash
# Get stack information
aws cloudformation describe-stacks --stack-name aws-hello-world-api-dev
aws cloudformation describe-stacks --stack-name aws-hello-world-api-staging
aws cloudformation describe-stacks --stack-name aws-hello-world-api-prod

# Get API Gateway ID
aws cloudformation describe-stacks --stack-name aws-hello-world-api-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text
```

### Health Check
```bash
# Check API health
curl https://YOUR_API_URL/health

# Expected response
{"status":"healthy","timestamp":"2024-01-01T12:00:00.000Z"}
```

---

## Deployment Procedures

### Standard Deployment (via CI/CD)

#### To Development Environment
1. Create a feature branch from `develop`
2. Make changes and commit
3. Push to GitHub
4. Create PR to `develop` branch
5. Wait for CI checks to pass
6. Merge PR
7. GitHub Actions automatically deploys to development

#### To Staging Environment
1. Create PR from `develop` to `main`
2. Wait for CI checks and approvals
3. Merge PR to `main`
4. GitHub Actions automatically deploys to staging
5. Verify staging deployment:
   ```bash
   curl https://YOUR_STAGING_API_URL/health
   curl https://YOUR_STAGING_API_URL/hello
   ```

#### To Production Environment
1. After staging deployment completes
2. Navigate to GitHub Actions → Latest workflow run
3. Review staging deployment results
4. Approve "Deploy to Production" step
5. Monitor deployment logs
6. Verify production deployment:
   ```bash
   curl https://YOUR_PRODUCTION_API_URL/health
   curl https://YOUR_PRODUCTION_API_URL/hello
   ```
7. Monitor CloudWatch metrics for 15 minutes

### Manual Deployment (Emergency)

**Use only in emergencies when CI/CD is unavailable**

```bash
# Ensure you're on the correct branch
git checkout main
git pull origin main

# Verify AWS credentials
aws sts get-caller-identity

# Build and deploy
sam build
sam deploy --config-env production

# Verify deployment
curl https://YOUR_PRODUCTION_API_URL/health
```

---

## Rollback Procedures

### Automatic Rollback (via CI/CD)

If deployment fails, the pipeline automatically rolls back. Monitor GitHub Actions for rollback status.

### Manual Rollback

#### Option 1: Rollback via SAM
```bash
# List available versions
aws cloudformation describe-stack-resources \
  --stack-name aws-hello-world-api-prod \
  --query 'StackResources[?ResourceType==`AWS::Lambda::Function`].PhysicalResourceId'

# Get previous version ARN
aws lambda list-versions-by-function \
  --function-name HelloWorldFunction \
  --query 'Versions[?Version!=`$LATEST`]'

# Publish previous version as alias
aws lambda update-alias \
  --function-name HelloWorldFunction \
  --name prod \
  --function-version PREVIOUS_VERSION
```

#### Option 2: Rollback via CloudFormation
```bash
# List stack events to find last successful deployment
aws cloudformation describe-stack-events \
  --stack-name aws-hello-world-api-prod \
  --max-items 50

# Rollback to previous stack state
aws cloudformation continue-update-rollback \
  --stack-name aws-hello-world-api-prod
```

#### Option 3: Redeploy Previous Git Commit
```bash
# Find last known good commit
git log --oneline -10

# Checkout previous commit
git checkout COMMIT_HASH

# Deploy previous version
sam build
sam deploy --config-env production

# Return to main branch
git checkout main
```

### Post-Rollback Verification
1. Test health endpoint: `curl https://YOUR_API_URL/health`
2. Test main endpoints
3. Check CloudWatch metrics
4. Verify error rates return to normal
5. Update incident documentation

---

## Monitoring & Alerting

### CloudWatch Dashboards

Access dashboards at: https://console.aws.amazon.com/cloudwatch/

#### Key Metrics to Monitor
- **Lambda Invocations**: Total requests
- **Lambda Errors**: Failed invocations
- **Lambda Duration**: Response time (p50, p99)
- **API Gateway 4XX/5XX**: Error rates
- **API Gateway Latency**: End-to-end response time

### CloudWatch Alarms

#### Critical Alarms
- Lambda error rate > 5% for 10 minutes → PagerDuty
- API Gateway 5XX errors > 10 in 5 minutes → PagerDuty
- API unavailable (0 requests for 5 minutes) → PagerDuty

#### Warning Alarms
- Lambda p99 latency > 200ms for 10 minutes → Slack
- Lambda throttles > 0 in 5 minutes → Slack
- API Gateway 4XX error rate > 10% → Slack

### Viewing Logs

```bash
# View Lambda logs (last 10 minutes)
aws logs tail /aws/lambda/HelloWorldFunction --since 10m --follow

# View API Gateway logs
aws logs tail /aws/apigateway/aws-hello-world-api --since 10m --follow

# Filter for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/HelloWorldFunction \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s)000
```

### X-Ray Tracing

View traces at: https://console.aws.amazon.com/xray/

```bash
# Get trace summaries
aws xray get-trace-summaries \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time $(date +%s)

# Get specific trace
aws xray batch-get-traces --trace-ids TRACE_ID
```

---

## Common Issues & Troubleshooting

### Issue: API Returns 502 Bad Gateway

**Symptoms**: API Gateway returns 502 error

**Possible Causes**:
1. Lambda function timeout (exceeds 30 seconds)
2. Lambda function crash or unhandled exception
3. Invalid response format from Lambda

**Resolution**:
```bash
# Check Lambda logs for errors
aws logs tail /aws/lambda/HelloWorldFunction --since 30m

# Check Lambda timeout configuration
aws lambda get-function-configuration \
  --function-name HelloWorldFunction \
  --query 'Timeout'

# Increase timeout if needed (max 900 seconds)
aws lambda update-function-configuration \
  --function-name HelloWorldFunction \
  --timeout 60
```

### Issue: API Returns 429 Too Many Requests

**Symptoms**: Clients receive 429 throttling errors

**Possible Causes**:
1. Exceeded API Gateway throttle limits
2. Exceeded Lambda concurrent execution limits
3. Rate limiting configuration too restrictive

**Resolution**:
```bash
# Check current throttle settings
aws apigateway get-stages \
  --rest-api-id API_ID

# Request throttle limit increase
# Contact AWS Support or update API Gateway settings

# Check Lambda concurrency
aws lambda get-function-configuration \
  --function-name HelloWorldFunction \
  --query 'ReservedConcurrentExecutions'
```

### Issue: High Lambda Error Rate

**Symptoms**: CloudWatch shows increased error rate

**Resolution**:
1. Check recent deployments - consider rollback
2. Review Lambda logs for error patterns
3. Check for dependency issues (npm packages)
4. Verify environment variables are set correctly
5. Test function locally with SAM CLI:
   ```bash
   sam local invoke HelloWorldFunction --event events/api-gateway.json
   ```

### Issue: Increased Response Latency

**Symptoms**: API Gateway latency metrics show increased p99

**Resolution**:
1. Check Lambda cold starts (increase provisioned concurrency)
2. Review code for inefficiencies
3. Check external API dependencies
4. Review database query performance (if applicable)
5. Enable Lambda X-Ray for detailed trace analysis

---

## Emergency Procedures

### Production Outage Response

1. **Assess Impact** (2 minutes)
   - Check health endpoint
   - Review CloudWatch metrics
   - Check CloudWatch alarms
   - Determine blast radius (all users or subset?)

2. **Communicate** (3 minutes)
   - Post incident in Slack #incidents channel
   - Update status page if available
   - Notify on-call manager

3. **Immediate Mitigation** (10 minutes)
   - If recent deployment: execute rollback
   - If API Gateway issue: check throttle limits
   - If Lambda issue: check logs and consider increasing timeout/memory
   - If AWS outage: check AWS Health Dashboard

4. **Investigate Root Cause** (30+ minutes)
   - Review recent changes
   - Analyze logs and traces
   - Test in non-production environment
   - Document findings in incident report

5. **Implement Fix** (varies)
   - Create hotfix branch
   - Implement and test fix
   - Fast-track PR review
   - Deploy to production via CI/CD or manual deployment

6. **Post-Incident** (24-48 hours)
   - Write postmortem document
   - Identify preventive measures
   - Update runbook with lessons learned
   - Schedule team retrospective

### Partial Outage Response

If only specific functionality is affected:
1. Assess which endpoints/features are impacted
2. Consider disabling affected endpoints temporarily
3. Route traffic to backup region if multi-region setup exists
4. Follow standard incident response procedures

---

## Contacts & Escalation

### On-Call Rotation
- **Primary On-Call**: [PagerDuty Schedule Link]
- **Secondary On-Call**: [PagerDuty Schedule Link]
- **Engineering Manager**: [Contact Info]

### Escalation Path
1. **Level 1**: On-call engineer (via PagerDuty)
2. **Level 2**: Engineering lead (after 30 minutes)
3. **Level 3**: Engineering manager (after 1 hour)
4. **Level 4**: CTO (for major incidents)

### Communication Channels
- **Critical Incidents**: #incidents (Slack)
- **Deployments**: #deployments (Slack)
- **Alerts**: #alerts-critical, #alerts-warning (Slack)
- **Status Updates**: [Status Page URL]

### AWS Support
- **Support Level**: [Basic/Developer/Business/Enterprise]
- **Support Console**: https://console.aws.amazon.com/support/
- **Emergency Contact**: [If Enterprise Support]

### External Dependencies
- **GitHub Status**: https://www.githubstatus.com/
- **AWS Status**: https://status.aws.amazon.com/
- **npm Status**: https://status.npmjs.org/

---

## Maintenance Windows

### Scheduled Maintenance
- **Day**: Tuesdays
- **Time**: 02:00-04:00 UTC (low traffic period)
- **Notification**: 48 hours advance notice in Slack
- **Status Page**: Update before maintenance begins

### Emergency Maintenance
- Notify #incidents channel immediately
- Update status page
- Follow abbreviated approval process
- Document in incident report

---

## Performance Baselines

### Expected Performance (Production)
- **Average Response Time**: 50-100ms
- **p99 Response Time**: 150-200ms
- **Error Rate**: < 0.1%
- **Availability**: 99.9% (monthly)

### Traffic Patterns
- **Peak Hours**: [Define based on your usage]
- **Low Traffic**: [Define based on your usage]
- **Expected Daily Requests**: [Define based on your usage]

---

## Change Log

| Date | Author | Changes |
|------|--------|---------|
| 2024-01-01 | DevOps Team | Initial runbook creation |

---

**Last Updated**: [Date]
**Next Review**: [Date + 3 months]
