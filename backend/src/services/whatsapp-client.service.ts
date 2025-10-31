import crypto from 'crypto';
import { getWhatsAppConfig } from '../config/whatsapp.config';
import {
  WhatsAppSendMessageRequest,
  WhatsAppSendMessageResponse,
} from '../types/whatsapp.types';

class WhatsAppClient {
  private config = getWhatsAppConfig();

  /**
   * Verify webhook signature from WhatsApp
   * @param signature The X-Hub-Signature-256 header value
   * @param body The raw request body
   * @returns true if signature is valid
   */
  verifyWebhookSignature(signature: string, body: string): boolean {
    try {
      // Remove 'sha256=' prefix if present
      const signatureHash = signature.startsWith('sha256=')
        ? signature.substring(7)
        : signature;

      // Calculate expected signature
      const expectedSignature = crypto
        .createHmac('sha256', this.config.webhookSecret)
        .update(body)
        .digest('hex');

      // Use timing-safe comparison
      return crypto.timingSafeEqual(
        Buffer.from(signatureHash, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Verify webhook verification token for initial setup
   * @param token The hub.verify_token from query params
   * @returns true if token matches configured token
   */
  verifyWebhookToken(token: string): boolean {
    return token === this.config.webhookVerifyToken;
  }

  /**
   * Send a text message via WhatsApp Business API
   * @param to Recipient phone number (with country code, no + sign)
   * @param message Message text
   * @returns Response from WhatsApp API
   */
  async sendMessage(
    to: string,
    message: string
  ): Promise<WhatsAppSendMessageResponse> {
    const url = `${this.config.apiUrl}/${this.config.phoneNumberId}/messages`;

    const payload: WhatsAppSendMessageRequest = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/\+/g, ''), // Remove + if present
      type: 'text',
      text: {
        preview_url: false,
        body: message,
      },
    };

    try {
      // Using native fetch (Node.js 18+) or we'll need to install axios
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          `WhatsApp API error: ${response.status} - ${JSON.stringify(errorData)}`
        );
      }

      return (await response.json()) as WhatsAppSendMessageResponse;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }

  /**
   * Get configuration (for testing/debugging)
   */
  getConfig() {
    return {
      apiUrl: this.config.apiUrl,
      phoneNumberId: this.config.phoneNumberId,
      // Don't expose sensitive tokens
    };
  }
}

// Export singleton instance
export const whatsappClient = new WhatsAppClient();
