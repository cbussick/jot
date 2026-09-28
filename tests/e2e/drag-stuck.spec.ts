import { test, expect } from '@playwright/test';

test('release after a reordered card loses capture clears the floating preview', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto('/');
  for (const title of ['First', 'Second', 'Third']) {
    await page.getByRole('button', { name: 'A thought worth keeping…' }).click();
    await page.getByRole('textbox', { name: 'Title' }).fill(title);
    await page.getByRole('button', { name: 'Close note' }).click();
  }
  const board = page.getByRole('list', { name: 'Notes' });
  const order = async () => (await board.locator('[data-note-id]').allTextContents()).map(text => text.split('Today')[0]).filter(text => ['First', 'Second', 'Third'].includes(text));
  const source = page.getByRole('button', { name: 'Open note: Third' });
  const from = (await source.boundingBox())!;
  const to = (await page.getByRole('button', { name: 'Open note: First' }).boundingBox())!;
  await page.mouse.move(from.x + 20, from.y + 20);
  await page.mouse.down();
  await page.mouse.move(to.x + 20, to.y + 20, { steps: 5 });
  const floating = page.locator('body > button[aria-hidden="true"]');
  await expect(floating).toBeVisible();
  await expect.poll(order).toEqual(['Second', 'First', 'Third']);
  // Reparenting a captured card can drop capture (notably on Safari).
  await source.evaluate(button => {
    if (button.hasPointerCapture(1)) button.releasePointerCapture(1);
  });
  // Release in the gap at the edge of the proposed slot, not on another card.
  await page.mouse.move(from.x + from.width + 8, from.y + 20);
  await page.mouse.up();
  await expect(floating).toHaveCount(0);
  await expect.poll(order).toEqual(['Second', 'First', 'Third']);
});
