import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../db/redis';

const RATE_LIMIT_PREFIX = 'rate_limit:';
const RATE_LIMIT_WINDOW = 60; // 60 seconds
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_PER_MINUTE || '60');

/**
 * Rate limiting middleware using Redis
 * Limits requests per user (identified by phone number or user ID)
 */
export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract identifier from request
    // For WhatsApp webhooks, we'll extract phone number from the payload
    const identifier = extractIdentifier(req);

    if (!identifier) {
      // If we can't identify the user, allow the request
      // (authentication middleware will handle unauthenticated requests)
      next();
      return;
    }

    const redis = await getRedisClient();
    const key = `${RATE_LIMIT_PREFIX}${identifier}`;

    // Get current count
    const current = await redis.get(key);
    const count = current ? parseInt(current) : 0;

    if (count >= MAX_REQUESTS) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Maximum ${MAX_REQUESTS} requests per minute allowed`,
        retryAfter: RATE_LIMIT_WINDOW,
      });
      return;
    }

    // Increment counter
    if (count === 0) {
      // First request in window - set with expiry
      await redis.setEx(key, RATE_LIMIT_WINDOW, '1');
    } else {
      // Increment existing counter
      await redis.incr(key);
    }

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS.toString());
    res.setHeader('X-RateLimit-Remaining', (MAX_REQUESTS - count - 1).toString());
    res.setHeader('X-RateLimit-Reset', (Date.now() + RATE_LIMIT_WINDOW * 1000).toString());

    next();
  } catch (error) {
    console.error('Error in rate limit middleware:', error);
    // On error, allow the request to proceed
    next();
  }
}

/**
 * Extract identifier from request for rate limiting
 * @param req Express request
 * @returns Identifier string or null
 */
function extractIdentifier(req: Request): string | null {
  // Try to get from authenticated user
  if (req.user && typeof req.user === 'object' && 'userId' in req.user) {
    return (req.user as { userId: string }).userId;
  }

  // Try to extract from WhatsApp webhook payload
  if (req.body && req.body.entry) {
    try {
      const entry = req.body.entry[0];
      const change = entry?.changes?.[0];
      const message = change?.value?.messages?.[0];
      
      if (message?.from) {
        return message.from;
      }
    } catch (error) {
      // Ignore parsing errors
    }
  }

  // Try to get from query params (for webhook verification)
  if (req.query && req.query.phone) {
    return req.query.phone as string;
  }

  return null;
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        phoneNumber: string;
      };
    }
  }
}
