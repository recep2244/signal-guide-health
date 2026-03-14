/**
 * Unit tests for cardiac metric input validation schema.
 * Tests the Zod schema constraints for POST /patients/:id/cardiac-metrics.
 *
 * TDD RED: These tests import from a module that does not exist yet.
 * They will fail with "Cannot find module" until the schema is extracted.
 */

import { describe, it, expect } from 'vitest';
import { cardiacMetricSchema } from './cardiacMetric.schema';

describe('cardiacMetricSchema', () => {
  describe('ejectionFraction', () => {
    it('accepts a valid ejection fraction of 55', () => {
      const result = cardiacMetricSchema.safeParse({ ejectionFraction: 55 });
      expect(result.success).toBe(true);
    });

    it('accepts ejection fraction of 0 (boundary)', () => {
      const result = cardiacMetricSchema.safeParse({ ejectionFraction: 0 });
      expect(result.success).toBe(true);
    });

    it('accepts ejection fraction of 100 (boundary)', () => {
      const result = cardiacMetricSchema.safeParse({ ejectionFraction: 100 });
      expect(result.success).toBe(true);
    });

    it('rejects ejection fraction > 100', () => {
      const result = cardiacMetricSchema.safeParse({ ejectionFraction: 101 });
      expect(result.success).toBe(false);
    });

    it('rejects negative ejection fraction', () => {
      const result = cardiacMetricSchema.safeParse({ ejectionFraction: -1 });
      expect(result.success).toBe(false);
    });
  });

  describe('nyhaClass', () => {
    it('accepts nyhaClass 1 through 4', () => {
      for (const v of [1, 2, 3, 4]) {
        const result = cardiacMetricSchema.safeParse({ nyhaClass: v });
        expect(result.success).toBe(true);
      }
    });

    it('rejects nyhaClass 5', () => {
      const result = cardiacMetricSchema.safeParse({ nyhaClass: 5 });
      expect(result.success).toBe(false);
    });

    it('rejects nyhaClass 0', () => {
      const result = cardiacMetricSchema.safeParse({ nyhaClass: 0 });
      expect(result.success).toBe(false);
    });

    it('rejects non-integer nyhaClass', () => {
      const result = cardiacMetricSchema.safeParse({ nyhaClass: 2.5 });
      expect(result.success).toBe(false);
    });
  });

  describe('notes', () => {
    it('accepts notes up to 1000 characters', () => {
      const result = cardiacMetricSchema.safeParse({ notes: 'a'.repeat(1000) });
      expect(result.success).toBe(true);
    });

    it('rejects notes exceeding 1000 characters', () => {
      const result = cardiacMetricSchema.safeParse({ notes: 'a'.repeat(1001) });
      expect(result.success).toBe(false);
    });
  });

  describe('valid payloads', () => {
    it('accepts a complete valid payload', () => {
      const result = cardiacMetricSchema.safeParse({
        ejectionFraction: 55,
        nyhaClass: 2,
        ntProBnp: 450.5,
        bnp: 120,
        hsTroponinI: 0.04,
        creatinine: 1.1,
        notes: 'Post-discharge follow-up',
      });
      expect(result.success).toBe(true);
    });

    it('accepts an empty object (all fields optional)', () => {
      const result = cardiacMetricSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});
