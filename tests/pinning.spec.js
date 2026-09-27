import { test, expect } from '@playwright/test';

const pin = (page, id) => page.locator(`.note-pin[data-id="${id}"]`);
const card = (page, id) => page.locator(`.note-card[data-id="${id}"]`);
const ids = locator => locator.evaluateAll(cards => cards.map(card => card.dataset.id));

for (const width of [390, 834, 1440]) {
  test(`pin/unpin moves notes without changing dates or order at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    const originalOrder = await ids(page.locator('#note-board .note-card'));
    const originalDate = await card(page, '3').locator('.note-date').textContent();
    await pin(page, '3').click();
    await expect(page.locator('#editor')).not.toBeVisible();
    await expect(page.locator('#pinned-board .note-card[data-id="3"]')).toBeVisible();
    await expect(pin(page, '3')).toHaveAttribute('aria-pressed', 'true');
    await expect(pin(page, '3')).toBeFocused();
    await expect(card(page, '3').locator('.note-date')).toHaveText(originalDate);
    await expect(page.locator('#note-count')).toHaveText('12');
    await pin(page, '3').click();
    await expect(pin(page, '3')).toHaveAttribute('aria-pressed', 'false');
    expect(await ids(page.locator('#note-board .note-card'))).toEqual(originalOrder);
    await expect(page.locator('#toast')).toHaveText('Note unpinned');
  });
}

test('pin controls are keyboard operable and keep focus after moving', async ({ page }) => {
  await page.goto('/');
  await pin(page, '2').focus();
  await expect(pin(page, '2')).toHaveCSS('opacity', '1');
  await page.keyboard.press('Space');
  await expect(pin(page, '2')).toBeFocused();
  await expect(pin(page, '2')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#pinned-board .note-card[data-id="2"] img')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(pin(page, '2')).toBeFocused();
  await expect(pin(page, '2')).toHaveAttribute('aria-pressed', 'false');
});

test('touch users can see and use unpinned controls without hover', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4273/');
  await expect(pin(page, '3')).toHaveCSS('opacity', '1');
  const box = await pin(page, '3').boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await pin(page, '3').tap();
  await expect(pin(page, '3')).toHaveAttribute('aria-pressed', 'true');
  await context.close();
});

test('empty pinned section disappears and returns when needed', async ({ page }) => {
  await page.goto('/');
  await pin(page, '1').click();
  await pin(page, '12').click();
  await expect(page.locator('#pinned-section')).not.toBeVisible();
  await expect(page.locator('#other-heading')).not.toBeVisible();
  await expect(page.locator('#note-board .note-card')).toHaveCount(12);
  await pin(page, '3').click();
  await expect(page.getByRole('heading', { name: 'Pinned', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Other notes', exact: true })).toBeVisible();
});

test('search filters both groups and preserves pin state', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox').fill('making');
  await expect(page.locator('#pinned-board .note-card')).toHaveCount(1);
  await expect(page.locator('#other-section')).not.toBeVisible();
  await expect(page.locator('#note-count')).toHaveText('1');
  await pin(page, '12').click();
  await expect(page.getByRole('searchbox')).toHaveValue('making');
  await expect(page.locator('#pinned-section')).not.toBeVisible();
  await expect(page.locator('#note-board .note-card')).toHaveCount(1);
  await page.getByRole('searchbox').fill('nothing-matches-this');
  await expect(page.locator('#empty-state')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(pin(page, '12')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.note-card')).toHaveCount(12);
});

test('new notes can be pinned and retain pin state when edited', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('n');
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Keep close');
  await page.locator('#pin-note').click();
  await expect(page.locator('#pin-note')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  const note = page.getByRole('button', { name: 'Open note: Keep close', exact: true });
  await expect(page.locator('#pinned-board')).toContainText('Keep close');
  await note.click();
  await expect(page.locator('#pin-note')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('textbox', { name: 'Note', exact: true }).fill('Still pinned after editing.');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.locator('#pinned-board')).toContainText('Still pinned after editing.');
  await note.click();
  await page.locator('#pin-note').click();
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.locator('#note-board')).toContainText('Keep close');
});

test('discarding an editor pin change does not change the board', async ({ page }) => {
  await page.goto('/');
  await card(page, '3').click();
  await page.locator('#pin-note').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#discard-dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await expect(pin(page, '3')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#pinned-board .note-card')).toHaveCount(2);
});

test('deleting the last pinned note hides its section', async ({ page }) => {
  await page.goto('/');
  await pin(page, '12').click();
  await card(page, '1').click();
  await page.getByRole('button', { name: 'Delete note', exact: true }).click();
  await page.locator('#confirm-dialog').getByRole('button', { name: 'Delete note', exact: true }).click();
  await expect(page.locator('#pinned-section')).not.toBeVisible();
  await expect(page.locator('#note-count')).toHaveText('11');
});

test('all notes can be pinned without an empty Other notes section', async ({ page }) => {
  await page.goto('/');
  const unpinnedIds = await ids(page.locator('#note-board .note-card'));
  for (const id of unpinnedIds) await pin(page, id).click();
  await expect(page.locator('#pinned-board .note-card')).toHaveCount(12);
  await expect(page.locator('#other-section')).not.toBeVisible();
  await expect(page.locator('#empty-state')).not.toBeVisible();
});
