import { test, expect } from '../fixtures/isolated-test';

test('URLs on note cards open separately without opening the editor', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New note' }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill('Read https://example.com/docs');
  await page.getByRole('textbox', { name: 'Note', exact: true }).fill('Also www.example.org/path, thanks.');
  await page.getByRole('button', { name: 'Close note' }).click();
  const card = page.getByRole('button', { name: 'Open note: Read https://example.com/docs' });
  await expect(card).toBeVisible();
  const titleLink = page.getByRole('link', { name: 'https://example.com/docs' });
  const bodyLink = page.getByRole('link', { name: 'www.example.org/path' });
  await expect(bodyLink).toHaveAttribute('href', 'https://www.example.org/path');
  await expect(titleLink).toHaveAttribute('target', '_blank');
  await expect(card.locator('a')).toHaveCount(0);
  // Avoid navigating to the external site while verifying click handling.
  await titleLink.evaluate(element => element.addEventListener('click', event => event.preventDefault(), { once: true }));
  await titleLink.click();
  await expect(page.getByRole('dialog', { name: 'Edit note' })).toHaveCount(0);
  await card.click({ position: { x: 10, y: 10 } });
  await expect(page.getByRole('dialog', { name: 'Edit note' })).toBeVisible();
});
