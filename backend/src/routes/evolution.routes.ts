import { Router, Request, Response } from 'express';
import evolutionAPIService from '../services/evolution-api.service';

const router = Router();

/**
 * Initialize Evolution API instance
 */
router.post('/initialize', async (_req: Request, res: Response) => {
  try {
    await evolutionAPIService.initialize();
    res.json({
      success: true,
      message: 'Evolution API instance initialized',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get QR code for WhatsApp connection
 */
router.get('/qrcode', async (_req: Request, res: Response) => {
  try {
    const qrData = await evolutionAPIService.getQRCode();
    res.json({
      success: true,
      data: qrData,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get instance connection status
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = await evolutionAPIService.getInstanceStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Send test message
 */
router.post('/send-message', async (req: Request, res: Response) => {
  try {
    const { number, text } = req.body;
    
    if (!number || !text) {
      return res.status(400).json({
        success: false,
        error: 'Number and text are required',
      });
    }

    const result = await evolutionAPIService.sendTextMessage({ number, text });
    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
