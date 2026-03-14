import { describe, it, expect } from 'vitest';
import { computeGrace, computeCha2ds2vasc } from './riskScores';

describe('computeGrace', () => {
  it('returns null when age is not provided', () => {
    // @ts-expect-error testing missing age
    expect(computeGrace({})).toBeNull();
  });

  it('returns null when age is NaN', () => {
    expect(computeGrace({ age: NaN })).toBeNull();
  });

  it('returns correct score for 65yr male, HR=85, SBP=130', () => {
    // age 65 → 60-69 bucket → 58 pts
    // HR 85 → 70-89 bucket → 9 pts
    // SBP 130 → 120-139 bucket → 34 pts
    // Total = 101
    expect(computeGrace({ age: 65, heartRate: 85, systolicBP: 130 })).toBe(101);
  });

  it('uses only age when HR and SBP are not provided', () => {
    // age 40 → 40-49 bucket → 25 pts
    expect(computeGrace({ age: 40 })).toBe(25);
  });

  it('adds creatinine points when provided', () => {
    // age 50 → 50-59 → 41 pts; no HR, no SBP; creatinine 1.0 mg/dL → 0.8-1.19 → 7 pts
    expect(computeGrace({ age: 50, creatinine: 1.0 })).toBe(48);
  });

  it('returns 0 for very low-risk profile (age <30, optimal vitals)', () => {
    // age 20 → <30 → 0; HR 60-69 → 3; SBP 140-159 → 24 → total 27
    expect(computeGrace({ age: 20, heartRate: 65, systolicBP: 145 })).toBe(27);
  });
});

describe('computeCha2ds2vasc', () => {
  it('returns 0 for male, age 50, no conditions', () => {
    expect(
      computeCha2ds2vasc({
        dateOfBirth: new Date('1975-01-01'),
        gender: 'male',
        chronicConditions: [],
      }),
    ).toBe(0);
  });

  it('returns 4 for female 70yr with heart failure and hypertension', () => {
    // age 70 → >=65 → +1; female → +1; heart failure → +1; hypertension → +1
    // Total = 4
    expect(
      computeCha2ds2vasc({
        dateOfBirth: new Date('1955-01-01'), // ~70yr in 2026
        gender: 'female',
        chronicConditions: ['Chronic heart failure', 'Hypertension'],
      }),
    ).toBe(4);
  });

  it('adds 2 points for age >= 75', () => {
    // age 80 → +2
    expect(
      computeCha2ds2vasc({
        dateOfBirth: new Date('1945-01-01'), // ~80yr in 2026
        gender: 'male',
        chronicConditions: [],
      }),
    ).toBe(2);
  });

  it('adds stroke/TIA points (+2)', () => {
    expect(
      computeCha2ds2vasc({
        dateOfBirth: new Date('1975-01-01'),
        gender: 'male',
        chronicConditions: ['History of stroke/TIA'],
      }),
    ).toBe(2);
  });

  it('adds vascular disease point (+1)', () => {
    expect(
      computeCha2ds2vasc({
        dateOfBirth: new Date('1975-01-01'),
        gender: 'male',
        chronicConditions: ['Peripheral arterial disease'],
      }),
    ).toBe(1);
  });

  it('adds diabetes point (+1)', () => {
    expect(
      computeCha2ds2vasc({
        dateOfBirth: new Date('1975-01-01'),
        gender: 'male',
        chronicConditions: ['Type 2 diabetes'],
      }),
    ).toBe(1);
  });
});
