import { whatsappSender } from './whatsapp-sender.service';
import { db } from '../db/prisma';
import {
  WhatsAppMessage,
  WhatsAppWebhookPayload,
} from '../types/whatsapp.types';
import {
  authorizeCommandByPhoneNumber,
  notifySessionExpired,
  notifyAuthenticationRequired,
} from './auth-integration.service';
import { executeCommandFromWhatsApp } from './command-integration.service';

interface MessageContext {
  phoneNumber: string;
  messageId: string;
  timestamp: string;
  userId?: string;
}

class WhatsAppHandler {
  /**
   * Process incoming webhook payload from WhatsApp
   * @param payload The webhook payload
   */
  async handleIncomingWebhook(payload: WhatsAppWebhookPayload): Promise<void> {
    try {
      // Validate payload structure
      if (payload.object !== 'whatsapp_business_account') {
        console.warn('Received non-WhatsApp webhook:', payload.object);
        return;
      }

      // Process each entry in the webhook
      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages') {
            const messages = change.value.messages || [];
            
            for (const message of messages) {
              await this.handleIncomingMessage(message);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error handling incoming webhook:', error);
      throw error;
    }
  }

  /**
   * Process a single incoming message
   * @param message The WhatsApp message
   */
  private async handleIncomingMessage(message: WhatsAppMessage): Promise<void> {
    const context: MessageContext = {
      phoneNumber: message.from,
      messageId: message.id,
      timestamp: message.timestamp,
    };

    try {
      // Only process text messages
      if (message.type !== 'text' || !message.text?.body) {
        await this.logAuditEntry(context, 'UNSUPPORTED_TYPE', null, 'error', 'Unsupported message type');
        return;
      }

      const messageText = message.text.body.trim();

      // Authorize command using integrated authentication flow
      const authResult = await authorizeCommandByPhoneNumber(context.phoneNumber);

      if (!authResult.authorized) {
        // Determine the appropriate error message
        if (authResult.error === 'User not found') {
          await notifyAuthenticationRequired(context.phoneNumber);
          await this.logAuditEntry(context, 'UNAUTHENTICATED', messageText, 'error', 'User not found');
        } else if (authResult.error === 'No active session found' || authResult.error === 'Session validation failed') {
          await notifySessionExpired(context.phoneNumber);
          await this.logAuditEntry(context, 'SESSION_EXPIRED', messageText, 'error', authResult.error);
        } else {
          await whatsappSender.sendErrorMessage(
            context.phoneNumber,
            'Authorization failed. Please authenticate using the Kiro IDE.'
          );
          await this.logAuditEntry(context, 'AUTH_FAILED', messageText, 'error', authResult.error || 'Unknown error');
        }
        return;
      }

      context.userId = authResult.userId;

      // Process the command
      await this.processCommand(context, messageText, authResult.userId!);
    } catch (error) {
      console.error('Error handling message:', error);
      await whatsappSender.sendErrorMessage(
        context.phoneNumber,
        'An error occurred while processing your message. Please try again.'
      );
      await this.logAuditEntry(
        context,
        'PROCESSING_ERROR',
        message.text?.body || '',
        'error',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Process a command from the message text
   * @param context Message context
   * @param messageText The command text
   * @param userId The user ID
   */
  private async processCommand(
    context: MessageContext,
    messageText: string,
    userId: string
  ): Promise<void> {
    try {
      // Execute command using integrated command execution flow
      // This handles: parsing → validation → access control → execution → response
      const result = await executeCommandFromWhatsApp(
        context.phoneNumber,
        userId,
        messageText
      );

      // Log the result (audit logging is handled within executeCommandFromWhatsApp)
      if (result.success) {
        await this.logAuditEntry(context, 'COMMAND_SUCCESS', messageText, 'success', null);
      } else {
        await this.logAuditEntry(context, 'COMMAND_FAILED', messageText, 'error', result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error processing command:', error);
      await whatsappSender.sendErrorMessage(
        context.phoneNumber,
        'Failed to execute command. Please check your syntax and try again.'
      );
      await this.logAuditEntry(
        context,
        'COMMAND_ERROR',
        messageText,
        'error',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Log audit entry for the message
   * @param context Message context
   * @param commandType Command type
   * @param commandPayload Command payload
   * @param status Status (success/error)
   * @param errorMessage Error message if any
   */
  private async logAuditEntry(
    context: MessageContext,
    commandType: string,
    commandPayload: string | null,
    status: 'success' | 'error',
    errorMessage: string | null
  ): Promise<void> {
    try {
      if (!context.userId) {
        // Can't log without user ID
        return;
      }

      await db.auditLog.create({
        data: {
          userId: context.userId,
          commandType,
          commandPayload: commandPayload 
            ? { text: commandPayload, messageId: context.messageId } 
            : undefined,
          status,
          errorMessage,
        },
      });
    } catch (error) {
      console.error('Error logging audit entry:', error);
      // Don't throw - audit logging failure shouldn't break the flow
    }
  }
}

// Export singleton instance
export const whatsappHandler = new WhatsAppHandler();
