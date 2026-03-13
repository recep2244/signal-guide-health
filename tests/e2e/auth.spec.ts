import { test, expect } from '@playwright/test';

const PILOT_EMAIL = process.env['PILOT_EMAIL'] || 'doctor@cardiowatch.pilot';
const PILOT_PASSWORD = process.env['PILOT_PASSWORD'] || 'PilotDoc2024!';

test('login with pilot credentials loads dashboard then logout succeeds', async ({ page }) => {
  await page.goto('/pilot/login');
  await page.getByLabel(/email/i).fill(PILOT_EMAIL);
  await page.getByLabel(/password/i).fill(PILOT_PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  // Dashboard should load — wait for a known element
  await expect(page).toHaveURL(/\/pilot\/dashboard/, { timeout: 10000 });
  await expect(page.getByText(/patient|triage/i).first()).toBeVisible({ timeout: 10000 });

  // Logout
  const logoutBtn = page.getByRole('button', { name: /logout|sign out/i });
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
    await expect(page).toHaveURL(/\/pilot\/login/, { timeout: 5000 });
  }
});
