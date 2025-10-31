import { Router, Request, Response } from 'express';
import { whatsappClient } from '../services/whatsapp-client.service';
import { whatsappHandler } from '../services/whatsapp-handler.service';
import { rateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { WhatsAppWebhookPayload } from '../types/whatsapp.types';

const router = Router();

/**
 * GET /webhook - Webhook verification endpoint
 * WhatsApp will call this endpoint to verify the webhook URL
 */
router.get('/webhook', (req: Request, res: Response) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Check if mode and token are present
    if (mode === 'subscribe' && token) {
      // Verify the token
      if (whatsappClient.verifyWebhookToken(token as string)) {
        console.log('Webhook verified successfully');
        res.status(200).send(challenge);
      } else {
        console.warn('Webhook verification failed: invalid token');
        res.status(403).json({ error: 'Invalid verify token' });
      }
    } else {
      console.warn('Webhook verification failed: missing parameters');
      res.status(400).json({ error: 'Missing parameters' });
    }
  } catch (error) {
    console.error('Error in webhook verification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /webhook - Webhook endpoint for incoming messages
 * WhatsApp will send incoming messages to this endpoint
 */
router.post(
  '/webhook',
  rateLimitMiddleware,
  async (req: Request, res: Response) => {
    try {
      // Get raw body for signature verification
      const signature = req.headers['x-hub-signature-256'] as string;
      
      if (!signature) {
        console.warn('Missing webhook signature');
        res.status(401).json({ error: 'Missing signature' });
        return;
      }

      // Verify webhook signature
      const rawBody = JSON.stringify(req.body);
      const isValid = whatsappClient.verifyWebhookSignature(signature, rawBody);

      if (!isValid) {
        console.warn('Invalid webhook signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      // Process the webhook payload
      const payload = req.body as WhatsAppWebhookPayload;
      
      // Respond immediately to WhatsApp (they expect 200 within 20 seconds)
      res.status(200).json({ success: true });

      // Process the webhook asynchronously
      // This prevents blocking the response
      setImmediate(async () => {
        try {
          await whatsappHandler.handleIncomingWebhook(payload);
        } catch (error) {
          console.error('Error processing webhook asynchronously:', error);
        }
      });
    } catch (error) {
      console.error('Error in webhook handler:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
