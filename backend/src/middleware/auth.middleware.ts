import { Request, Response, NextFunction } from 'express';
import { validateSession } from '../services/auth.service';

export interface AuthRequest extends Request {
  userId?: string;
  phoneNumber?: string;
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No authorization token provided',
      });
      return;
    }

    const token = authHeader.substring(7);
    const validation = await validateSession(token);

    if (!validation.valid) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired session',
      });
      return;
    }

    req.userId = validation.userId;
    req.phoneNumber = validation.phoneNumber;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error',
    });
  }
}
