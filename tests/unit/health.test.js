/**
 * Unit tests for Health Check Lambda handler
 */

const { handler } = require('../../src/handlers/health');

describe('Health Check Handler', () => {
    // Mock console.log to prevent cluttering test output
    const originalConsoleLog = console.log;
    beforeAll(() => {
        console.log = jest.fn();
    });
    afterAll(() => {
        console.log = originalConsoleLog;
    });

    // Clear mocks and reset environment between tests
    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.ENVIRONMENT;
        delete process.env.AWS_REGION;
        delete process.env.API_VERSION;
    });

    describe('Successful health checks', () => {
        it('should return 200 when service is healthy', async () => {
            const event = {
                httpMethod: 'GET',
                path: '/health',
                requestContext: {
                    requestId: 'health-test-123'
                }
            };

            const response = await handler(event);

            expect(response.statusCode).toBe(200);
            expect(response.headers['Content-Type']).toBe('application/json');
            expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
            expect(response.headers['Cache-Control']).toBe('no-cache, no-store, must-revalidate');
            expect(response.headers['X-Request-Id']).toBe('health-test-123');

            const body = JSON.parse(response.body);
            expect(body.status).toBe('healthy');
            expect(body.timestamp).toBeDefined();
            expect(body.version).toBe('1.0.0');
            expect(body.checks).toBeDefined();
            expect(body.checks.lambda).toBe('healthy');
            expect(body.checks.memory).toBe('healthy');
            expect(body.checks.environment).toBe('dev');
        });

        it('should include environment variables in response', async () => {
            process.env.ENVIRONMENT = 'production';
            process.env.AWS_REGION = 'us-west-2';
            process.env.API_VERSION = '2.1.0';

            const event = {
                httpMethod: 'GET',
                path: '/health',
                requestContext: {
                    requestId: 'health-env-test'
                }
            };

            const response = await handler(event);
            const body = JSON.parse(response.body);

            expect(body.checks.environment).toBe('production');
            expect(body.checks.region).toBe('us-west-2');
            expect(body.version).toBe('2.1.0');
        });

        it('should handle missing requestContext gracefully', async () => {
            const event = {
                httpMethod: 'GET',
                path: '/health'
            };

            const response = await handler(event);

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.status).toBe('healthy');
        });

        it('should log health check requests', async () => {
            const event = {
                httpMethod: 'GET',
                path: '/health',
                requestContext: {
                    requestId: 'health-log-test'
                }
            };

            await handler(event);

            expect(console.log).toHaveBeenCalled();
            const logCalls = console.log.mock.calls;
            const requestLog = JSON.parse(logCalls[0][0]);
            expect(requestLog.level).toBe('INFO');
            expect(requestLog.message).toBe('Health check requested');
            expect(requestLog.requestId).toBe('health-log-test');
        });
    });

    describe('Memory health checks', () => {
        it('should report healthy when memory usage is low', async () => {
            // Mock process.memoryUsage to return low memory
            const originalMemoryUsage = process.memoryUsage;
            process.memoryUsage = jest.fn(() => ({
                heapUsed: 10 * 1024 * 1024, // 10MB
                rss: 50 * 1024 * 1024
            }));

            const event = {
                httpMethod: 'GET',
                path: '/health',
                requestContext: {
                    requestId: 'memory-low-test'
                }
            };

            const response = await handler(event);
            const body = JSON.parse(response.body);

            expect(body.checks.memory).toBe('healthy');
            expect(body.status).toBe('healthy');
            expect(response.statusCode).toBe(200);

            process.memoryUsage = originalMemoryUsage;
        });

        it('should report warning when memory usage is high', async () => {
            // Mock process.memoryUsage to return high memory
            const originalMemoryUsage = process.memoryUsage;
            process.memoryUsage = jest.fn(() => ({
                heapUsed: 95 * 1024 * 1024, // 95MB (>70% of 128MB)
                rss: 100 * 1024 * 1024
            }));

            const event = {
                httpMethod: 'GET',
                path: '/health',
                requestContext: {
                    requestId: 'memory-warning-test'
                }
            };

            const response = await handler(event);
            const body = JSON.parse(response.body);

            expect(body.checks.memory).toBe('warning');
            expect(body.status).toBe('healthy'); // Still healthy with warning
            expect(response.statusCode).toBe(200);

            process.memoryUsage = originalMemoryUsage;
        });

        it('should report unhealthy when memory usage is critical', async () => {
            // Mock process.memoryUsage to return critical memory
            const originalMemoryUsage = process.memoryUsage;
            process.memoryUsage = jest.fn(() => ({
                heapUsed: 120 * 1024 * 1024, // 120MB (>90% of 128MB)
                rss: 125 * 1024 * 1024
            }));

            const event = {
                httpMethod: 'GET',
                path: '/health',
                requestContext: {
                    requestId: 'memory-critical-test'
                }
            };

            const response = await handler(event);
            const body = JSON.parse(response.body);

            expect(body.checks.memory).toBe('unhealthy');
            expect(body.status).toBe('degraded');
            expect(response.statusCode).toBe(503);

            process.memoryUsage = originalMemoryUsage;
        });
    });

    describe('Error handling', () => {
        it('should return 503 when health check encounters an error', async () => {
            // Mock process.memoryUsage to throw an error
            const originalMemoryUsage = process.memoryUsage;
            process.memoryUsage = jest.fn(() => {
                throw new Error('Memory check failed');
            });

            const event = {
                httpMethod: 'GET',
                path: '/health',
                requestContext: {
                    requestId: 'health-error-test'
                }
            };

            const response = await handler(event);

            expect(response.statusCode).toBe(503);
            expect(response.headers['Content-Type']).toBe('application/json');
            expect(response.headers['Access-Control-Allow-Origin']).toBe('*');

            const body = JSON.parse(response.body);
            expect(body.status).toBe('unhealthy');
            expect(body.error).toBe('Health check encountered an error');
            expect(body.requestId).toBe('health-error-test');

            process.memoryUsage = originalMemoryUsage;
        });

        it('should log errors during health check', async () => {
            // Create an error scenario
            const originalMemoryUsage = process.memoryUsage;
            process.memoryUsage = jest.fn(() => {
                throw new Error('Test error');
            });

            const event = {
                httpMethod: 'GET',
                path: '/health',
                requestContext: {
                    requestId: 'health-error-log'
                }
            };

            await handler(event);

            // Check error was logged
            const logCalls = console.log.mock.calls;
            const errorLog = logCalls.find(call => {
                try {
                    const log = JSON.parse(call[0]);
                    return log.level === 'ERROR';
                } catch {
                    return false;
                }
            });

            expect(errorLog).toBeDefined();
            const errorLogData = JSON.parse(errorLog[0]);
            expect(errorLogData.message).toBe('Health check failed');
            expect(errorLogData.error).toBe('Test error');

            process.memoryUsage = originalMemoryUsage;
        });
    });

    describe('Cache control', () => {
        it('should include no-cache headers', async () => {
            const event = {
                httpMethod: 'GET',
                path: '/health',
                requestContext: {
                    requestId: 'cache-test'
                }
            };

            const response = await handler(event);

            expect(response.headers['Cache-Control']).toBe('no-cache, no-store, must-revalidate');
        });
    });

    describe('OPTIONS request handling', () => {
        it('should handle OPTIONS request for CORS preflight', async () => {
            const event = {
                httpMethod: 'OPTIONS',
                path: '/health',
                requestContext: {
                    requestId: 'options-test'
                }
            };

            const response = await handler(event);

            expect(response.statusCode).toBe(200);
            expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
        });
    });
});