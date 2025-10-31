/**
 * Authentication Integration Service
 * Wires together authentication flow components:
 * - Verification code generation → WhatsApp sender
 * - Code verification → Session creation
 * - Session validation → Command authorization
 */

import { requestVerificationCode, verifyCodeAndCreateSession, validateSession } from './auth.service';
import { whatsappSender } from './whatsapp-sender.service';
import { db } from '../db/prisma';

/**
 * Request verification code and send it via WhatsApp
 * Integrates: Verification code generation → WhatsApp sender
 */
export async function requestVerificationCodeViaWhatsApp(
  phoneNumber: string,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate verification code
    const code = await requestVerificationCode(phoneNumber, workspaceId);

    // Send code via WhatsApp
    const message = `🔐 *Kiro WhatsApp Integration*\n\nYour verification code is: *${code}*\n\nThis code will expire in 10 minutes.\n\nReply with this code to complete authentication.`;
    
    await whatsappSender.sendMessage(phoneNumber, message);

    return { success: true };
  } catch (error) {
    console.error('Error requesting verification code via WhatsApp:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send verification code'
    };
  }
}

/**
 * Verify code and create session, then notify user via WhatsApp
 * Integrates: Code verification → Session creation → WhatsApp notification
 */
export async function verifyCodeAndNotify(
  phoneNumber: string,
  code: string
): Promise<{ success: boolean; token?: string; userId?: string; error?: string }> {
  try {
    // Verify code and create session
    const result = await verifyCodeAndCreateSession(phoneNumber, code);

    if (!result) {
      // Send error message via WhatsApp
      await whatsappSender.sendErrorMessage(
        phoneNumber,
        'Invalid or expired verification code. Please request a new code from Kiro IDE.'
      );

      return {
        success: false,
        error: 'Invalid or expired verification code'
      };
    }

    // Send success message via WhatsApp
    const successMessage = `✅ *Authentication Successful*\n\nYou are now connected to your Kiro workspace!\n\nYou can now send commands like:\n• \`read <file>\`\n• \`list <directory>\`\n• \`search <query>\`\n• \`status\`\n• \`help\``;
    
    await whatsappSender.sendMessage(phoneNumber, successMessage);

    return {
      success: true,
      token: result.token,
      userId: result.userId
    };
  } catch (error) {
    console.error('Error verifying code:', error);
    
    // Send error message via WhatsApp
    await whatsappSender.sendErrorMessage(
      phoneNumber,
      'An error occurred during authentication. Please try again.'
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    };
  }
}

/**
 * Validate session for command authorization
 * Integrates: Session validation → Command authorization
 */
export async function authorizeCommand(
  token: string
): Promise<{ authorized: boolean; userId?: string; phoneNumber?: string; error?: string }> {
  try {
    // Validate session
    const validation = await validateSession(token);

    if (!validation.valid) {
      return {
        authorized: false,
        error: 'Invalid or expired session'
      };
    }

    // Check if user exists and has active session
    const user = await db.user.findUnique({
      where: { id: validation.userId },
      include: {
        sessions: {
          where: {
            token,
            expiresAt: {
              gt: new Date()
            }
          }
        }
      }
    });

    if (!user || user.sessions.length === 0) {
      return {
        authorized: false,
        error: 'User not found or session expired'
      };
    }

    return {
      authorized: true,
      userId: validation.userId,
      phoneNumber: validation.phoneNumber
    };
  } catch (error) {
    console.error('Error authorizing command:', error);
    return {
      authorized: false,
      error: error instanceof Error ? error.message : 'Authorization failed'
    };
  }
}

/**
 * Validate user session by phone number (for WhatsApp messages)
 * Integrates: Phone number → Session validation → Command authorization
 */
export async function authorizeCommandByPhoneNumber(
  phoneNumber: string
): Promise<{ authorized: boolean; userId?: string; token?: string; error?: string }> {
  try {
    // Find user by phone number
    const user = await db.user.findUnique({
      where: { phoneNumber },
      include: {
        sessions: {
          where: {
            expiresAt: {
              gt: new Date()
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });

    if (!user) {
      return {
        authorized: false,
        error: 'User not found'
      };
    }

    if (user.sessions.length === 0) {
      return {
        authorized: false,
        error: 'No active session found'
      };
    }

    const session = user.sessions[0];

    // Validate the session token
    const validation = await validateSession(session.token);

    if (!validation.valid) {
      return {
        authorized: false,
        error: 'Session validation failed'
      };
    }

    return {
      authorized: true,
      userId: user.id,
      token: session.token
    };
  } catch (error) {
    console.error('Error authorizing command by phone number:', error);
    return {
      authorized: false,
      error: error instanceof Error ? error.message : 'Authorization failed'
    };
  }
}

/**
 * Send session expiration notification via WhatsApp
 */
export async function notifySessionExpired(phoneNumber: string): Promise<void> {
  try {
    const message = `⏰ *Session Expired*\n\nYour Kiro WhatsApp session has expired.\n\nPlease authenticate again from Kiro IDE to continue using WhatsApp commands.`;
    
    await whatsappSender.sendMessage(phoneNumber, message);
  } catch (error) {
    console.error('Error sending session expiration notification:', error);
  }
}

/**
 * Send authentication required notification via WhatsApp
 */
export async function notifyAuthenticationRequired(phoneNumber: string): Promise<void> {
  try {
    const message = `🔒 *Authentication Required*\n\nYou need to authenticate before using Kiro WhatsApp commands.\n\nPlease open Kiro IDE and use the WhatsApp Integration extension to authenticate.`;
    
    await whatsappSender.sendMessage(phoneNumber, message);
  } catch (error) {
    console.error('Error sending authentication required notification:', error);
  }
}
