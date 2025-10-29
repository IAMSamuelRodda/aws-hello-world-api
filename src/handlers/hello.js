/**
 * Hello World Lambda Handler
 * Returns a JSON response with a greeting message and timestamp
 */

// Structured logging helper
const log = (level, message, data = {}) => {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        ...data
    }));
};

/**
 * Lambda handler for the Hello World endpoint
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 * @returns {Object} - API Gateway Lambda Proxy Output Format
 */
exports.handler = async (event) => {
    const requestId = event.requestContext?.requestId || 'unknown';

    try {
        // Log incoming request
        log('INFO', 'Processing Hello World request', {
            requestId,
            path: event.path,
            method: event.httpMethod,
            sourceIp: event.requestContext?.identity?.sourceIp
        });

        // Simulate processing time for realistic metrics
        const startTime = Date.now();

        // Prepare response data
        const responseData = {
            message: 'Hello World!',
            timestamp: new Date().toISOString(),
            requestId,
            version: process.env.API_VERSION || '1.0.0',
            environment: process.env.ENVIRONMENT || 'dev'
        };

        // Calculate processing time
        const processingTime = Date.now() - startTime;

        // Log successful response
        log('INFO', 'Successfully processed request', {
            requestId,
            processingTime
        });

        // Return successful response with CORS headers
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'GET,OPTIONS',
                'X-Request-Id': requestId,
                'X-Processing-Time': `${processingTime}ms`
            },
            body: JSON.stringify(responseData)
        };

    } catch (error) {
        // Log error details
        log('ERROR', 'Failed to process request', {
            requestId,
            error: error.message,
            stack: error.stack
        });

        // Return error response
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'X-Request-Id': requestId
            },
            body: JSON.stringify({
                error: 'Internal Server Error',
                message: 'An error occurred while processing your request',
                requestId
            })
        };
    }
};