import crypto from 'crypto';

/**
 * Creates Express middleware that enforces API key authentication
 * via the Authorization: Bearer <key> header.
 *
 * - If OPENCLAWD_API_KEY is not set, all requests pass through (backwards-compatible).
 * - GET /api/health is always exempt from authentication.
 * - Uses constant-time comparison to prevent timing attacks.
 */
export function createAuthMiddleware() {
  return (req, res, next) => {
    const apiKey = process.env.OPENCLAWD_API_KEY;

    // If no API key is configured, skip authentication (backwards-compatible)
    if (!apiKey) {
      return next();
    }

    // Exempt the health endpoint from authentication
    if (req.path === '/api/health' && req.method === 'GET') {
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing Authorization header. Use: Authorization: Bearer <api-key>'
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid Authorization format. Use: Authorization: Bearer <api-key>'
      });
    }

    const providedKey = authHeader.slice(7); // Remove 'Bearer ' prefix

    if (!safeCompare(apiKey, providedKey)) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key'
      });
    }

    next();
  };
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeCompare(expected, provided) {
  if (typeof expected !== 'string' || typeof provided !== 'string') {
    return false;
  }

  // Ensure both buffers are the same length for timingSafeEqual
  const expectedBuf = Buffer.from(expected, 'utf-8');
  const providedBuf = Buffer.from(provided, 'utf-8');

  if (expectedBuf.length !== providedBuf.length) {
    // Still do a comparison to avoid leaking length info via timing
    const dummyBuf = Buffer.alloc(expectedBuf.length);
    crypto.timingSafeEqual(expectedBuf, dummyBuf);
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Generates a new API key with the 'oc_' prefix followed by 32 random hex bytes.
 * @returns {string} A new API key (e.g., 'oc_a1b2c3d4...')
 */
export function generateApiKey() {
  return 'oc_' + crypto.randomBytes(32).toString('hex');
}
