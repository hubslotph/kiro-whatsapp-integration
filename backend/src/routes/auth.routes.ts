import { Router, Request, Response } from 'express';
import {
  requestVerificationCode,
  verifyCodeAndCreateSession,
} from '../services/auth.service';
import {
  requestVerificationCodeViaWhatsApp,
  verifyCodeAndNotify,
} from '../services/auth-integration.service';

const router = Router();

/**
 * POST /api/auth/request-code
 * Request a verification code for authentication
 */
router.post('/request-code', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber, workspaceId, sendViaWhatsApp } = req.body;

    // Validate input
    if (!phoneNumber || !workspaceId) {
      res.status(400).json({
        success: false,
        error: 'Phone number and workspace ID are required',
      });
      return;
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      res.status(400).json({
        success: false,
        error: 'Invalid phone number format',
      });
      return;
    }

    // If sendViaWhatsApp is true, use integrated flow
    if (sendViaWhatsApp) {
      const result = await requestVerificationCodeViaWhatsApp(phoneNumber, workspaceId);
      
      if (!result.success) {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to send verification code via WhatsApp',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Verification code sent via WhatsApp',
      });
      return;
    }

    // Generate and store verification code (original flow)
    const code = await requestVerificationCode(phoneNumber, workspaceId);

    // In production, this code would be displayed in Kiro IDE
    // For development, we return it in the response
    res.status(200).json({
      success: true,
      message: 'Verification code generated',
      // TODO: Remove code from response in production
      code: process.env.NODE_ENV === 'development' ? code : undefined,
    });
  } catch (error) {
    console.error('Error requesting verification code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate verification code',
    });
  }
});

/**
 * POST /api/auth/verify-code
 * Verify code and create session
 */
router.post('/verify-code', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber, code, notifyViaWhatsApp } = req.body;

    // Validate input
    if (!phoneNumber || !code) {
      res.status(400).json({
        success: false,
        error: 'Phone number and verification code are required',
      });
      return;
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      res.status(400).json({
        success: false,
        error: 'Invalid verification code format',
      });
      return;
    }

    // If notifyViaWhatsApp is true, use integrated flow
    if (notifyViaWhatsApp) {
      const result = await verifyCodeAndNotify(phoneNumber, code);

      if (!result.success) {
        res.status(401).json({
          success: false,
          error: result.error || 'Invalid or expired verification code',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Authentication successful',
        data: {
          token: result.token,
          userId: result.userId,
        },
      });
      return;
    }

    // Verify code and create session (original flow)
    const result = await verifyCodeAndCreateSession(phoneNumber, code);

    if (!result) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired verification code',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Authentication successful',
      data: {
        token: result.token,
        userId: result.userId,
        expiresAt: result.expiresAt,
      },
    });
  } catch (error) {
    console.error('Error verifying code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify code',
    });
  }
});

/**
 * POST /api/auth/revoke
 * Revoke current session
 */
router.post('/revoke', async (req: Request, res: Response): Promise<void> => {
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
    const { revokeSession } = await import('../services/auth.service');
    const revoked = await revokeSession(token);

    if (!revoked) {
      res.status(404).json({
        success: false,
        error: 'Session not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Session revoked successfully',
    });
  } catch (error) {
    console.error('Error revoking session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke session',
    });
  }
});

export default router;
