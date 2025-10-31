/**
 * Resilient WhatsApp Service
 * Wraps WhatsApp operations with retry logic and circuit breaker
 */

import { whatsappClient } from './whatsapp-client.service';
import { retryService } from './retry.service';
import { circuitBreakerManager, CircuitState } from './circuit-breaker.service';
import { errorHandler } from './error-handler.service';

const WHATSAPP_CIRCUIT_BREAKER = 'whatsapp-api';
const MAX_MESSAGE_LENGTH = 4096;

/**
 * Resilient WhatsApp Service
 * Provides fault-tolerant WhatsApp messaging with retry and circuit breaker
 */
export class ResilientWhatsAppService {
  private circuitBreaker = circuitBreakerManager.getBreaker(WHATSAPP_CIRCUIT_BREAKER, {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000, // 1 minute
    resetTimeout: 300000, // 5 minutes
    onStateChange: (oldState, newState) => {
      console.log(`WhatsApp Circuit Breaker: ${oldState} -> ${newState}`);
    },
    onCircuitOpen: () => {
      console.error('WhatsApp Circuit Breaker OPENED - Service may be unavailable');
    },
    onCircuitClose: () => {
      console.log('WhatsApp Circuit Breaker CLOSED - Service recovered');
    },
  });

  /**
   * Send a message with retry and circuit breaker protection
   */
  async sendMessage(phoneNumber: string, message: string): Promise<boolean> {
    try {
      // Check if message needs chunking
      if (message.length <= MAX_MESSAGE_LENGTH) {
        return await this.sendSingleMessage(phoneNumber, message);
      } else {
        return await this.sendChunkedMessage(phoneNumber, message);
      }
    } catch (error) {
      const appError = errorHandler.handleError(error, {
        operation: 'sendMessage',
      });

      // If circuit is open, return fallback response
      if (this.circuitBreaker.isOpen()) {
        console.warn('WhatsApp service unavailable (circuit open)');
        return false;
      }

      throw appError;
    }
  }

  /**
   * Send a single message with retry and circuit breaker
   */
  private async sendSingleMessage(phoneNumber: string, message: string): Promise<boolean> {
    try {
      // Execute with circuit breaker
      await this.circuitBreaker.execute(async () => {
        // Execute with retry
        await retryService.executeWithRetry(
          async () => {
            await whatsappClient.sendMessage(phoneNumber, message);
          },
          {
            maxAttempts: 3,
            initialDelayMs: 1000,
            backoffMultiplier: 2,
            retryableErrors: ['network', 'timeout', 'econnrefused', 'etimedout'],
            onRetry: (attempt, error) => {
              console.log(
                `Retrying WhatsApp message send (attempt ${attempt}): ${error.message}`
              );
            },
          }
        );
      });

      return true;
    } catch (error) {
      console.error('Failed to send WhatsApp message:', error);
      return false;
    }
  }

  /**
   * Send a chunked message
   */
  private async sendChunkedMessage(phoneNumber: string, message: string): Promise<boolean> {
    const chunks = this.chunkMessage(message);
    console.log(`Sending message in ${chunks.length} chunks`);

    let allSuccessful = true;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkHeader = chunks.length > 1 ? `[Part ${i + 1}/${chunks.length}]\n\n` : '';
      const chunkMessage = chunkHeader + chunk;

      const success = await this.sendSingleMessage(phoneNumber, chunkMessage);

      if (!success) {
        allSuccessful = false;
        console.error(`Failed to send chunk ${i + 1}/${chunks.length}`);

        // Notify about incomplete message
        if (i > 0) {
          await this.sendSingleMessage(
            phoneNumber,
            `⚠️ Message delivery incomplete. Received ${i} of ${chunks.length} parts.`
          );
        }

        break;
      }

      // Small delay between chunks
      if (i < chunks.length - 1) {
        await this.sleep(500);
      }
    }

    return allSuccessful;
  }

  /**
   * Send an error message with fallback
   */
  async sendErrorMessage(phoneNumber: string, error: string | Error): Promise<boolean> {
    const errorMessage = error instanceof Error ? error.message : error;
    const formattedMessage = this.formatErrorMessage(errorMessage);

    try {
      return await this.sendMessage(phoneNumber, formattedMessage);
    } catch (sendError) {
      console.error('Failed to send error message:', sendError);
      
      // Try to send a simplified fallback message
      return await this.sendFallbackMessage(phoneNumber);
    }
  }

  /**
   * Send a fallback message when normal sending fails
   */
  private async sendFallbackMessage(phoneNumber: string): Promise<boolean> {
    const fallbackMessage = '❌ An error occurred. Please try again later.';
    
    try {
      // Try one more time with minimal retry
      await retryService.executeWithRetry(
        async () => {
          await whatsappClient.sendMessage(phoneNumber, fallbackMessage);
        },
        {
          maxAttempts: 2,
          initialDelayMs: 500,
        }
      );
      return true;
    } catch (error) {
      console.error('Failed to send fallback message:', error);
      return false;
    }
  }

  /**
   * Send a success message
   */
  async sendSuccessMessage(phoneNumber: string, message: string): Promise<boolean> {
    const formattedMessage = `✅ ${message}`;
    return await this.sendMessage(phoneNumber, formattedMessage);
  }

  /**
   * Send a notification message
   */
  async sendNotification(
    phoneNumber: string,
    title: string,
    message: string
  ): Promise<boolean> {
    const formattedMessage = `🔔 *${title}*\n\n${message}`;
    return await this.sendMessage(phoneNumber, formattedMessage);
  }

  /**
   * Check if WhatsApp service is available
   */
  isAvailable(): boolean {
    return this.circuitBreaker.getState() !== CircuitState.OPEN;
  }

  /**
   * Get service health status
   */
  getHealthStatus(): {
    available: boolean;
    circuitState: CircuitState;
    stats: any;
  } {
    const stats = this.circuitBreaker.getStats();
    return {
      available: this.isAvailable(),
      circuitState: stats.state,
      stats,
    };
  }

  /**
   * Chunk a message into smaller parts
   */
  private chunkMessage(message: string): string[] {
    const chunks: string[] = [];
    let remaining = message;

    while (remaining.length > 0) {
      if (remaining.length <= MAX_MESSAGE_LENGTH) {
        chunks.push(remaining);
        break;
      }

      let splitIndex = MAX_MESSAGE_LENGTH;

      // Try to split at a newline
      const lastNewline = remaining.lastIndexOf('\n', MAX_MESSAGE_LENGTH);
      if (lastNewline > MAX_MESSAGE_LENGTH * 0.7) {
        splitIndex = lastNewline + 1;
      } else {
        // Try to split at a space
        const lastSpace = remaining.lastIndexOf(' ', MAX_MESSAGE_LENGTH);
        if (lastSpace > MAX_MESSAGE_LENGTH * 0.7) {
          splitIndex = lastSpace + 1;
        }
      }

      chunks.push(remaining.substring(0, splitIndex).trim());
      remaining = remaining.substring(splitIndex).trim();
    }

    return chunks;
  }

  /**
   * Format an error message
   */
  private formatErrorMessage(error: string): string {
    let cleanError = error;

    // Remove stack traces
    const stackTraceIndex = cleanError.indexOf('\n    at ');
    if (stackTraceIndex > 0) {
      cleanError = cleanError.substring(0, stackTraceIndex);
    }

    return `❌ *Error*\n\n${cleanError}\n\nPlease try again or type "help" for available commands.`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Manually reset circuit breaker (for admin use)
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.close();
    console.log('WhatsApp circuit breaker manually reset');
  }
}

// Export singleton instance
export const resilientWhatsApp = new ResilientWhatsAppService();
