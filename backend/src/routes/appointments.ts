/**
 * Appointment Routes
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response) => {
  res.json({ status: 'success', data: { appointments: [] } });
});

router.get('/:id', async (req: Request, res: Response) => {
  res.json({ status: 'success', data: { appointment: null } });
});

router.post('/', requireRole('doctor', 'nurse', 'admin'), async (req: Request, res: Response) => {
  res.status(201).json({ status: 'success', data: { appointment: null } });
});

router.put('/:id', requireRole('doctor', 'nurse', 'admin'), async (req: Request, res: Response) => {
  res.json({ status: 'success', data: { appointment: null } });
});

router.post('/:id/cancel', async (req: Request, res: Response) => {
  res.json({ status: 'success', message: 'Appointment cancelled' });
});

router.post('/:id/confirm', async (req: Request, res: Response) => {
  res.json({ status: 'success', message: 'Appointment confirmed' });
});

export default router;
