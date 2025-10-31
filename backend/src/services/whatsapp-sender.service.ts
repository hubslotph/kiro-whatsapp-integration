import { whatsappClient } from './whatsapp-client.service';

const MAX_MESSAGE_LENGTH = 4096;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000; // 1 second

interface SendMessageOptions {
  retry?: boolean;
  maxRetries?: number;
}

class WhatsAppSender {
  /**
   * Send a text message to a WhatsApp user
   * Automatically chunks messages that exceed the maximum length
   * @param phoneNumber Recipient phone number
   * @param message Message text
   * @param options Send options
   */
  async sendMessage(
    phoneNumber: string,
    message: string,
    options: SendMessageOptions = {}
  ): Promise<boolean> {
    const { retry = true, maxRetries = MAX_RETRY_ATTEMPTS } = options;

    try {
      // Check if message needs to be chunked
      if (message.length <= MAX_MESSAGE_LENGTH) {
        // Send single message
        return await this.sendSingleMessage(phoneNumber, message, retry ? maxRetries : 1);
      } else {
        // Chunk and send multiple messages
        return await this.sendChunkedMessage(phoneNumber, message, retry ? maxRetries : 1);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  /**
   * Send an error message with friendly formatting
   * @param phoneNumber Recipient phone number
   * @param error Error message or Error object
   */
  async sendErrorMessage(
    phoneNumber: string,
    error: string | Error
  ): Promise<boolean> {
    const errorMessage = error instanceof Error ? error.message : error;
    const formattedMessage = this.formatErrorMessage(errorMessage);
    
    return await this.sendMessage(phoneNumber, formattedMessage, { retry: true });
  }

  /**
   * Send a success message with friendly formatting
   * @param phoneNumber Recipient phone number
   * @param message Success message
   */
  async sendSuccessMessage(
    phoneNumber: string,
    message: string
  ): Promise<boolean> {
    const formattedMessage = `✅ ${message}`;
    return await this.sendMessage(phoneNumber, formattedMessage, { retry: true });
  }

  /**
   * Send a single message with retry logic
   * @param phoneNumber Recipient phone number
   * @param message Message text
   * @param maxAttempts Maximum number of attempts
   */
  private async sendSingleMessage(
    phoneNumber: string,
    message: string,
    maxAttempts: number
  ): Promise<boolean> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await whatsappClient.sendMessage(phoneNumber, message);
        
        if (attempt > 1) {
          console.log(`Message sent successfully on attempt ${attempt}`);
        }
        
        return true;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`Attempt ${attempt}/${maxAttempts} failed:`, lastError.message);

        // Wait before retrying (exponential backoff)
        if (attempt < maxAttempts) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    console.error(`Failed to send message after ${maxAttempts} attempts:`, lastError);
    return false;
  }

  /**
   * Send a message in chunks if it exceeds the maximum length
   * @param phoneNumber Recipient phone number
   * @param message Message text
   * @param maxAttempts Maximum number of attempts per chunk
   */
  private async sendChunkedMessage(
    phoneNumber: string,
    message: string,
    maxAttempts: number
  ): Promise<boolean> {
    const chunks = this.chunkMessage(message);
    
    console.log(`Sending message in ${chunks.length} chunks`);

    let allSuccessful = true;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkHeader = chunks.length > 1 ? `[Part ${i + 1}/${chunks.length}]\n\n` : '';
      const chunkMessage = chunkHeader + chunk;

      const success = await this.sendSingleMessage(
        phoneNumber,
        chunkMessage,
        maxAttempts
      );

      if (!success) {
        allSuccessful = false;
        console.error(`Failed to send chunk ${i + 1}/${chunks.length}`);
        
        // Send error notification about incomplete message
        if (i > 0) {
          await this.sendSingleMessage(
            phoneNumber,
            `⚠️ Message delivery incomplete. Received ${i} of ${chunks.length} parts.`,
            1
          );
        }
        
        break;
      }

      // Small delay between chunks to avoid rate limiting
      if (i < chunks.length - 1) {
        await this.sleep(500);
      }
    }

    return allSuccessful;
  }

  /**
   * Chunk a message into smaller parts
   * Tries to split at natural boundaries (newlines, spaces)
   * @param message Message text
   * @returns Array of message chunks
   */
  private chunkMessage(message: string): string[] {
    const chunks: string[] = [];
    let remaining = message;

    while (remaining.length > 0) {
      if (remaining.length <= MAX_MESSAGE_LENGTH) {
        chunks.push(remaining);
        break;
      }

      // Find a good split point
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

      // Extract chunk and update remaining
      chunks.push(remaining.substring(0, splitIndex).trim());
      remaining = remaining.substring(splitIndex).trim();
    }

    return chunks;
  }

  /**
   * Format an error message with friendly styling
   * @param error Error message
   * @returns Formatted error message
   */
  private formatErrorMessage(error: string): string {
    // Clean up technical error messages
    let cleanError = error;

    // Remove stack traces
    const stackTraceIndex = cleanError.indexOf('\n    at ');
    if (stackTraceIndex > 0) {
      cleanError = cleanError.substring(0, stackTraceIndex);
    }

    // Add error emoji and formatting
    return `❌ *Error*\n\n${cleanError}\n\nPlease try again or type "help" for available commands.`;
  }

  /**
   * Sleep for a specified duration
   * @param ms Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Send a notification message (for workspace events)
   * @param phoneNumber Recipient phone number
   * @param title Notification title
   * @param message Notification message
   */
  async sendNotification(
    phoneNumber: string,
    title: string,
    message: string
  ): Promise<boolean> {
    const formattedMessage = `🔔 *${title}*\n\n${message}`;
    return await this.sendMessage(phoneNumber, formattedMessage, { retry: true });
  }
}

// Export singleton instance
export const whatsappSender = new WhatsAppSender();
