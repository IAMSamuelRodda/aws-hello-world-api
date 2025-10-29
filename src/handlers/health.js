/**
 * Health Check Lambda Handler
 * Returns the health status of the API
 */

// Structured logging helper (same as in hello.js for consistency)
const log = (level, message, data = {}) => {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        ...data
    }));
};

/**
 * Lambda handler for the health check endpoint
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 * @returns {Object} - API Gateway Lambda Proxy Output Format
 */
exports.handler = async (event) => {
    const requestId = event.requestContext?.requestId || 'unknown';

    try {
        // Log health check request
        log('INFO', 'Health check requested', {
            requestId,
            path: event.path,
            method: event.httpMethod
        });

        // Perform basic health checks
        const healthChecks = {
            lambda: 'healthy',
            memory: checkMemory(),
            environment: process.env.ENVIRONMENT || 'dev',
            region: process.env.AWS_REGION || 'unknown'
        };

        // Check if all services are healthy
        const isHealthy = Object.values(healthChecks).every(
            status => status !== 'unhealthy'
        );

        const responseData = {
            status: isHealthy ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            checks: healthChecks,
            version: process.env.API_VERSION || '1.0.0'
        };

        // Log health check result
        log('INFO', 'Health check completed', {
            requestId,
            status: responseData.status
        });

        // Return health status
        return {
            statusCode: isHealthy ? 200 : 503,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'X-Request-Id': requestId
            },
            body: JSON.stringify(responseData)
        };

    } catch (error) {
        // Log error
        log('ERROR', 'Health check failed', {
            requestId,
            error: error.message,
            stack: error.stack
        });

        // Return unhealthy status
        return {
            statusCode: 503,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'X-Request-Id': requestId
            },
            body: JSON.stringify({
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: 'Health check encountered an error',
                requestId
            })
        };
    }
};

/**
 * Check memory usage
 * @returns {string} Memory status
 */
function checkMemory() {
    const used = process.memoryUsage();
    const maxMemory = 128 * 1024 * 1024; // 128MB in bytes (Lambda configured memory)
    const percentUsed = (used.heapUsed / maxMemory) * 100;

    if (percentUsed > 90) {
        return 'unhealthy';
    } else if (percentUsed > 70) {
        return 'warning';
    }
    return 'healthy';
}