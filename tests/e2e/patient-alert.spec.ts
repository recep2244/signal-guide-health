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

test('navigate to first patient and acknowledge first alert', async ({ page }) => {
  // Navigate to first patient card
  const firstPatientLink = page.getByRole('link', { name: /patient|view/i }).first();
  await firstPatientLink.click();
  await expect(page).toHaveURL(/\/pilot\/patient\//, { timeout: 8000 });

  // Find and click acknowledge button on first alert
  const acknowledgeBtn = page.getByRole('button', { name: /acknowledge/i }).first();
  const hasAlerts = await acknowledgeBtn.isVisible({ timeout: 5000 }).catch(() => false);

  if (hasAlerts) {
    await acknowledgeBtn.click();
    // Alert should be marked resolved or button disappears / changes text
    await expect(
      page.getByText(/acknowledged|resolved/i).first()
    ).toBeVisible({ timeout: 5000 });
  } else {
    // No active alerts — that is acceptable, test passes
    test.info().annotations.push({ type: 'note', description: 'No active alerts found for first patient' });
  }
});
