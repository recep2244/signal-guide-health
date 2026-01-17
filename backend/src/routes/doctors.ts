/**
 * Doctor Routes
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', requireRole('admin', 'super_admin'), async (_req: Request, res: Response) => {
  res.json({ status: 'success', data: { doctors: [] } });
});

router.get('/:id', requireRole('admin', 'super_admin', 'doctor'), async (req: Request, res: Response) => {
  res.json({ status: 'success', data: { doctor: null } });
});

router.get('/:id/patients', requireRole('doctor', 'admin'), async (req: Request, res: Response) => {
  res.json({ status: 'success', data: { patients: [] } });
});

router.get('/:id/schedule', requireRole('doctor', 'admin'), async (req: Request, res: Response) => {
  res.json({ status: 'success', data: { schedule: [] } });
});

export default router;
