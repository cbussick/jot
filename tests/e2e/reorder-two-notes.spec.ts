import { test, expect } from '@playwright/test';

test('two notes can be dragged to swap and dragged back', async ({ page }) => {
  await page.goto('/');
  for (const title of ['First', 'Second']) {
    await page.getByRole('button', { name: 'Add a note' }).click();
    await page.getByRole('textbox', { name: 'Title' }).fill(title);
    await page.getByRole('button', { name: 'Close note' }).click();
  }
  const board = page.getByRole('list', { name: 'Notes' });
  const order = async () => board.locator('[data-note-id]').evaluateAll(buttons => buttons.map(button => button.textContent?.includes('First') ? 'First' : 'Second'));
  await expect.poll(order).toEqual(['Second', 'First']);

  async function drag(source: string, target: string) {
    const from = (await page.getByRole('button', { name: `Open note: ${source}` }).boundingBox())!;
    const to = (await page.getByRole('button', { name: `Open note: ${target}` }).boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
    await page.mouse.up();
  }
  const from = (await page.getByRole('button', { name: 'Open note: Second' }).boundingBox())!;
  const to = (await page.getByRole('button', { name: 'Open note: First' }).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await expect.poll(order).toEqual(['First', 'Second']);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2, { steps: 8 });
  await expect.poll(order).toEqual(['Second', 'First']); // Return within the same drag.
  await page.mouse.up();
  await expect.poll(order).toEqual(['Second', 'First']);

  await drag('Second', 'First');
  await expect.poll(order).toEqual(['First', 'Second']);
  await drag('First', 'Second');
  await expect.poll(order).toEqual(['Second', 'First']);
});
