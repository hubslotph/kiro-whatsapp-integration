import { WhatsAppConfig } from '../types/whatsapp.types';

export function getWhatsAppConfig(): WhatsAppConfig {
  const apiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
  const apiToken = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
  const webhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!apiToken) {
    throw new Error('WHATSAPP_API_TOKEN is required');
  }

  if (!phoneNumberId) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID is required');
  }

  if (!webhookSecret) {
    throw new Error('WHATSAPP_WEBHOOK_SECRET is required');
  }

  if (!webhookVerifyToken) {
    throw new Error('WHATSAPP_WEBHOOK_VERIFY_TOKEN is required');
  }

  return {
    apiUrl,
    apiToken,
    phoneNumberId,
    webhookSecret,
    webhookVerifyToken,
  };
}
