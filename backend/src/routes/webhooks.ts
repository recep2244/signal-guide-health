/**
 * Webhook Routes
 * External service callbacks (WhatsApp, Wearables)
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';

const router = Router();

// WhatsApp webhook verification
router.get('/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_SECRET) {
    logger.info({ message: 'WhatsApp webhook verified' });
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// WhatsApp incoming messages
router.post('/whatsapp', (req: Request, res: Response) => {
  // Verify signature
  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) {
    res.sendStatus(401);
    return;
  }

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', process.env.WHATSAPP_WEBHOOK_SECRET || '')
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (signature !== expectedSignature) {
    logger.warn({ message: 'Invalid WhatsApp webhook signature' });
    res.sendStatus(401);
    return;
  }

  // Process message (queue for async processing)
  logger.info({ message: 'WhatsApp message received', body: req.body });

  // Always respond 200 quickly
  res.sendStatus(200);
});

// Fitbit webhook
router.post('/fitbit', (req: Request, res: Response) => {
  // Verify and process Fitbit data
  logger.info({ message: 'Fitbit webhook received' });
  res.sendStatus(200);
});

// Garmin webhook
router.post('/garmin', (req: Request, res: Response) => {
  logger.info({ message: 'Garmin webhook received' });
  res.sendStatus(200);
});

export default router;
