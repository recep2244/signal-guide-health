import { test, expect } from '@playwright/test';

const PILOT_EMAIL = process.env['PILOT_EMAIL'] || 'doctor@cardiowatch.pilot';
const PILOT_PASSWORD = process.env['PILOT_PASSWORD'] || 'PilotDoc2024!';

test.beforeEach(async ({ page }) => {
  await page.goto('/pilot/login');
  await page.getByLabel(/email/i).fill(PILOT_EMAIL);
  await page.getByLabel(/password/i).fill(PILOT_PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\/pilot\/dashboard/, { timeout: 10000 });
});

test('navigate to patient and open device pairing modal with QR/Manual/DeepLink tabs', async ({ page }) => {
  // Navigate to first patient
  const firstPatientLink = page.getByRole('link', { name: /patient|view/i }).first();
  await firstPatientLink.click();
  await expect(page).toHaveURL(/\/pilot\/patient\//, { timeout: 8000 });

  // Click Connect Device button
  const connectBtn = page.getByRole('button', { name: /connect device|pair device/i });
  await expect(connectBtn).toBeVisible({ timeout: 8000 });
  await connectBtn.click();

  // Modal should open
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible({ timeout: 5000 });

  // Verify QR tab is present (default)
  await expect(modal.getByRole('tab', { name: /qr/i })).toBeVisible({ timeout: 3000 });

  // Click Manual tab
  await modal.getByRole('tab', { name: /manual/i }).click();
  await expect(modal.getByRole('tabpanel')).toBeVisible();

  // Click DeepLink tab
  await modal.getByRole('tab', { name: /deep.?link|app link/i }).click();
  await expect(modal.getByRole('tabpanel')).toBeVisible();
});
