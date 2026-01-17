/**
 * Wearable Routes
 * Device connection and data sync
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/devices', async (req: Request, res: Response) => {
  res.json({ status: 'success', data: { devices: [] } });
});

router.post('/connect/:provider', async (req: Request, res: Response) => {
  const { provider } = req.params; // apple_watch, fitbit, garmin
  res.json({ status: 'success', data: { authUrl: '' } });
});

router.post('/callback/:provider', async (req: Request, res: Response) => {
  res.json({ status: 'success', message: 'Device connected' });
});

router.delete('/disconnect/:deviceId', async (req: Request, res: Response) => {
  res.json({ status: 'success', message: 'Device disconnected' });
});

router.post('/sync/:deviceId', async (req: Request, res: Response) => {
  res.json({ status: 'success', message: 'Sync initiated' });
});

router.get('/readings/:patientId', requireRole('doctor', 'nurse', 'admin'), async (req: Request, res: Response) => {
  res.json({ status: 'success', data: { readings: [] } });
});

export default router;
