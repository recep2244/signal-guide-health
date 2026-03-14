/**
 * Zod validation schema for POST /patients/:id/cardiac-metrics input.
 * Exported separately so it can be imported both by the route handler
 * and the unit tests.
 */

import { z } from 'zod';

export const cardiacMetricSchema = z.object({
  ejectionFraction: z.number().min(0).max(100).optional(),
  nyhaClass: z.number().int().min(1).max(4).optional(),
  ntProBnp: z.number().min(0).optional(),
  bnp: z.number().min(0).optional(),
  hsTroponinI: z.number().min(0).optional(),
  hsTroponinT: z.number().min(0).optional(),
  creatinine: z.number().min(0).optional(),
  killipClass: z.number().int().min(1).max(4).optional(),
  notes: z.string().max(1000).optional(),
});
