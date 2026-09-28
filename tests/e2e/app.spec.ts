import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile } from 'node:fs/promises';

test.describe.configure({ mode: 'serial' });

test('creates, edits, pins, searches, and deletes a note', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your notes' })).toBeVisible();
  await page.keyboard.press('n');
  await page.getByRole('textbox', { name: 'Title' }).fill('Keep this close');
  await page.getByRole('textbox', { name: 'Note', exact: true }).fill('A private thought.');
  await page.getByRole('radio', { name: 'Mint' }).check();
  await page.getByRole('button', { name: 'Pin note' }).click();
  await expect(page.getByRole('button', { name: 'Save note' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close note' }).click();
  const card = page.getByRole('button', { name: 'Open note: Keep this close' });
  await expect(card).toBeVisible();
  await expect(card).toHaveCSS('background-color', 'rgb(219, 235, 225)');
  await expect(card).toHaveCSS('border-style', 'solid');
  await expect(page.getByRole('heading', { name: 'Pinned', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Open note: Keep this close' }).click();
  await page.getByRole('textbox', { name: 'Note', exact: true }).fill('An edited private thought.');
  await page.getByRole('button', { name: 'Close note' }).click();
  await expect(page.getByRole('dialog', { name: 'Leave without saving?' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Edit note' })).not.toBeVisible();
  await page.getByRole('searchbox').fill('edited private');
  await expect(page.getByText('An edited private thought.')).toBeVisible();
  await page.getByRole('searchbox').fill('');
  await page.getByRole('button', { name: 'Open note: Keep this close' }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill('');
  await page.getByRole('textbox', { name: 'Note', exact: true }).fill('');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Edit note' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Open note: Image note' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Open note: Image note' }).click();
  await page.getByRole('button', { name: 'Delete note' }).click();
  await page.getByRole('dialog', { name: 'Delete this note?' }).getByRole('button', { name: 'Delete note' }).click();
  await expect(page.getByRole('button', { name: 'Open note: Image note' })).not.toBeVisible();
});

test('shows the simplified copy and gives sync its own dismissible dialog', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('searchbox')).toHaveAttribute('placeholder', 'Search your notes');
  await expect(page.getByRole('button', { name: 'Add a note' })).toBeVisible();
  await expect(page.getByText('Drag to reorder')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await page.getByRole('button', { name: 'Synced' }).click();
  const syncDialog = page.getByRole('dialog', { name: 'Synced' });
  await expect(syncDialog).toBeVisible();
  await expect(syncDialog.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
  await syncDialog.getByRole('button', { name: 'Back' }).click();
  await expect(syncDialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Synced' }).click();
  await syncDialog.getByRole('button', { name: 'Sync now' }).click();
  await expect(syncDialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Synced' }).click();
  await page.keyboard.press('Escape');
  await expect(syncDialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Add a note' }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill('Copy check');
  await page.getByRole('button', { name: 'Close note' }).click();
  await page.getByRole('button', { name: 'Open note: Copy check' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit note' });
  await expect(editor).toBeVisible();
  await expect(editor.getByText('A little note')).toHaveCount(0);
  await expect(editor.getByRole('button', { name: 'Pin note' })).toHaveText('');
  await editor.getByRole('button', { name: 'Delete note' }).click();
  await page.getByRole('dialog', { name: 'Delete this note?' }).getByRole('button', { name: 'Delete note' }).click();
});

test('pins from the board and keeps pinned controls visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your notes' })).toBeVisible();
  await page.keyboard.press('n');
  await page.getByRole('textbox', { name: 'Title' }).fill('Board pin test');
  await page.getByRole('button', { name: 'Close note' }).click();

  const card = page.getByRole('button', { name: 'Open note: Board pin test' });
  const pin = page.getByRole('button', { name: 'Pin note: Board pin test' });
  await page.mouse.move(0, 0);
  await expect(pin).toHaveCSS('opacity', '0');
  await card.hover();
  await expect(pin).toHaveCSS('opacity', '1');
  await pin.hover();
  await expect(pin).toHaveCSS('background-color', 'rgb(230, 235, 232)');
  const cardBox = await card.boundingBox();
  const pinBox = await pin.boundingBox();
  expect(pinBox!.x).toBeGreaterThan(cardBox!.x + cardBox!.width / 2);
  expect(pinBox!.y).toBeLessThan(cardBox!.y + cardBox!.height / 2);

  await pin.click();
  const unpin = page.getByRole('button', { name: 'Unpin note: Board pin test' });
  await page.mouse.move(0, 0);
  await expect(unpin).toHaveCSS('opacity', '1');
  await expect(page.getByRole('heading', { name: 'Pinned', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(unpin).toHaveCSS('opacity', '1');
  await unpin.click();
  await page.getByRole('heading', { name: 'Your notes' }).click();
  await page.mouse.move(0, 0);
  await expect(pin).toHaveCSS('opacity', '0');
  await expect(page.getByRole('dialog', { name: 'Edit note' })).not.toBeVisible();
});

test('drags notes into a persistent order and supports keyboard reordering', async ({ page }) => {
  await page.goto('/');
  for (const title of ['Order one', 'Order two', 'Order three']) {
    await page.getByRole('button', { name: 'Add a note' }).click();
    await page.getByRole('textbox', { name: 'Title' }).fill(title);
    await page.getByRole('button', { name: 'Close note' }).click();
  }
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 10_000 });
  const board = page.getByRole('list', { name: 'Notes' });
  const titles = async () => (await board.getByRole('button', { name: /^Open note:/ }).allTextContents()).filter(text => text.includes('Order '));
  const first = page.getByRole('button', { name: 'Open note: Order one' });
  const from = await first.boundingBox();
  const to = await page.getByRole('button', { name: 'Open note: Order three' }).boundingBox();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 8 });
  await expect(page.locator('body > button[aria-hidden="true"]')).toBeVisible();
  await expect.poll(async () => (await titles()).map(text => text.includes('Order one') ? 'one' : text.includes('Order two') ? 'two' : 'three')).toEqual(['one', 'three', 'two']);
  await page.mouse.up();
  await expect(page.getByRole('dialog', { name: 'Edit note' })).not.toBeVisible();
  await expect.poll(async () => (await titles()).map(text => text.includes('Order one') ? 'one' : text.includes('Order two') ? 'two' : 'three')).toEqual(['one', 'three', 'two']);
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect.poll(async () => (await titles()).map(text => text.includes('Order one') ? 'one' : text.includes('Order two') ? 'two' : 'three')).toEqual(['one', 'three', 'two']);
  await first.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await titles()).map(text => text.includes('Order one') ? 'one' : text.includes('Order two') ? 'two' : 'three')).toEqual(['three', 'one', 'two']);
});

test.describe('touch reordering', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test('holds a note to drag it without opening the editor or a context menu', async ({ page }) => {
    await page.goto('/');
    for (const title of ['Touch one', 'Touch two']) {
      await page.getByRole('button', { name: 'New note' }).click();
      await page.getByRole('textbox', { name: 'Title' }).fill(title);
      await page.getByRole('button', { name: 'Close note' }).click();
    }
    const first = page.getByRole('button', { name: 'Open note: Touch one' });
    const second = page.getByRole('button', { name: 'Open note: Touch two' });
    const from = await first.boundingBox();
    const to = await second.boundingBox();
    const x = from!.x + from!.width / 2;
    const y = from!.y + from!.height / 2;
    const destination = { x: to!.x + to!.width / 2, y: to!.y + to!.height / 2 };
    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await page.waitForTimeout(500);
    for (let step = 1; step <= 5; step++) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (destination.x - x) * step / 5, y: y + (destination.y - y) * step / 5 }] });
    }
    const board = page.getByRole('list', { name: 'Notes' });
    const order = async () => (await board.locator('[data-item-id]').allTextContents()).filter(text => text.includes('Touch ')).map(text => text.includes('Touch one') ? 'one' : 'two');
    await expect.poll(order).toEqual(['one', 'two']); // Preview before releasing.
    const floating = page.locator('body > button[aria-hidden="true"]');
    await expect(floating).toBeVisible();
    expect(Math.abs((await floating.boundingBox())!.x - from!.x)).toBeGreaterThan(10);
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(order).toEqual(['one', 'two']);
    await expect(floating).toHaveCount(0);
    await expect(page.getByRole('dialog')).not.toBeVisible();
    const held = await first.boundingBox();
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: held!.x + held!.width / 2, y: held!.y + held!.height / 2 }] });
    await page.waitForTimeout(500);
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await first.tap();
    await expect(page.getByRole('dialog', { name: 'Edit note' })).toBeVisible();
  });
});

test('saves a new text note when closed', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your notes' })).toBeVisible();
  await page.keyboard.press('n');
  await page.getByRole('textbox', { name: 'Note', exact: true }).fill('Saved by closing');
  await page.getByRole('button', { name: 'Close note' }).click();
  await expect(page.getByRole('button', { name: 'Open note: Saved by closing' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 10_000 });
});

test('closes empty drafts without creating a note', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 10_000 });
  const count = await page.getByRole('button', { name: 'Open note:', exact: false }).count();
  await page.keyboard.press('n');
  await page.getByRole('button', { name: 'Close note' }).click();
  await expect(page.getByRole('dialog', { name: 'Add note' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Open note:', exact: false })).toHaveCount(count);
});

test('accepts an image and keeps the editor textarea fixed', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Add an image' }).first().click();
  await page.locator('input[type=file]').last().setInputFiles('tests/fixtures/image.jpg');
  const textarea = page.getByRole('textbox', { name: 'Note', exact: true });
  const before = await textarea.boundingBox();
  await textarea.fill('Coffee first.');
  const after = await textarea.boundingBox();
  expect(after?.width).toBe(before?.width);
  expect(after?.height).toBe(before?.height);
  await page.getByRole('button', { name: 'Close note' }).click();
  await expect(page.getByRole('button', { name: 'Open note: Coffee first.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 10_000 });
});

test('closes notes from the footer or backdrop, and keeps destructive actions in the header', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add a note' }).click();
  const editor = page.getByRole('dialog', { name: 'Add note' });
  await expect(editor.getByText('Something worth keeping')).toHaveCount(0);
  await editor.getByRole('textbox', { name: 'Title' }).fill('Dismissible note');
  await editor.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(editor).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Open note: Dismissible note' }).click();
  const saved = page.getByRole('dialog', { name: 'Edit note' });
  const deleteBox = await saved.getByRole('button', { name: 'Delete note' }).boundingBox();
  const pinBox = await saved.getByRole('button', { name: 'Pin note' }).boundingBox();
  expect(deleteBox!.x).toBeLessThan(pinBox!.x);
  await saved.getByRole('textbox', { name: 'Note', exact: true }).fill('Saved from backdrop');
  await page.mouse.click(5, 5);
  await expect(saved).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Open note: Dismissible note' }).click();
  await expect(saved.getByRole('textbox', { name: 'Note', exact: true })).toHaveValue('Saved from backdrop');
  await saved.getByRole('button', { name: 'Delete note' }).click();
  await page.getByRole('dialog', { name: 'Delete this note?' }).getByRole('button', { name: 'Delete note' }).click();
});

test('confirms removal of draft and saved images without removing them on cancel', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add a note' }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill('Image removal test');
  await page.getByRole('button', { name: 'Attach an image' }).click();
  await page.locator('input[type=file]').last().setInputFiles('tests/fixtures/image.jpg');
  const confirmation = page.getByRole('dialog', { name: 'Remove this image?' });
  await page.getByRole('button', { name: 'Remove image 1' }).click();
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Keep image' }).click();
  await expect(page.getByRole('button', { name: 'View image 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove image 1' }).click();
  await confirmation.getByRole('button', { name: 'Remove image' }).click();
  await expect(page.getByRole('button', { name: 'View image 1' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Attach an image' }).click();
  await page.locator('input[type=file]').last().setInputFiles('tests/fixtures/image.jpg');
  await page.getByRole('button', { name: 'Close note' }).click();
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Open note: Image removal test' }).click();
  await page.getByRole('button', { name: 'Remove image 1' }).click();
  await expect(confirmation).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'View image 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove image 1' }).click();
  await confirmation.getByRole('button', { name: 'Remove image' }).click();
  await expect(page.getByRole('button', { name: 'View image 1' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close note' }).click();
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Open note: Image removal test' }).click();
  await expect(page.getByRole('button', { name: 'View image 1' })).toHaveCount(0);
});

for (const width of [390, 1440]) {
  test(`opens draft and saved images in a lightbox at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Your notes' })).toBeVisible();
    await page.keyboard.press('n');
    await page.getByRole('textbox', { name: 'Title' }).fill(`Photo preview ${width}`);
    await page.getByRole('button', { name: 'Attach an image' }).click();
    await page.locator('input[type=file]').last().setInputFiles('tests/fixtures/image.jpg');
    const preview = page.getByRole('dialog', { name: 'Image preview' });
    await page.getByRole('button', { name: 'View image 1' }).click();
    await expect(preview.getByRole('img')).toBeVisible();
    const imageBox = await preview.getByRole('img').boundingBox();
    const removeBox = await preview.getByRole('button', { name: 'Remove image 1' }).boundingBox();
    expect(removeBox!.x).toBeGreaterThan(imageBox!.x + imageBox!.width / 2);
    expect(removeBox!.x + removeBox!.width).toBeLessThanOrEqual(imageBox!.x + imageBox!.width);
    expect(removeBox!.y).toBeLessThan(imageBox!.y + 16);
    const bounds = await preview.boundingBox();
    if (width === 390) expect(bounds?.width).toBe(width);
    else expect(bounds?.width).toBeGreaterThan(800);
    await page.keyboard.press('Escape');
    await expect(preview).not.toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue(`Photo preview ${width}`);
    await page.getByRole('button', { name: 'Close note' }).click();
    await page.getByRole('button', { name: `Open note: Photo preview ${width}` }).click();
    await page.getByRole('button', { name: 'View image 1' }).click();
    await expect(preview.getByRole('img')).toBeVisible();
    await preview.getByRole('button', { name: 'Close image preview' }).click();
    await expect(preview).not.toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Edit note' })).toBeVisible();
  });
}

test('centers images and navigates and removes mixed gallery images', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add a note' }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill('Gallery note');
  await page.getByRole('button', { name: 'Attach an image' }).click();
  await page.locator('input[type=file]').last().setInputFiles('tests/fixtures/image.jpg');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Open note: Gallery note' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit note' });
  const bounds = await editor.boundingBox();
  const photo = await editor.getByRole('button', { name: 'View image 1' }).boundingBox();
  expect(Math.abs(photo!.x + photo!.width / 2 - (bounds!.x + bounds!.width / 2))).toBeLessThan(8);
  await page.getByRole('button', { name: 'Attach an image' }).click();
  await page.locator('input[type=file]').last().setInputFiles('tests/fixtures/image.jpg');
  await editor.getByRole('button', { name: 'View image 1' }).click();
  const gallery = page.getByRole('dialog', { name: 'Image preview' });
  await expect(gallery.getByText('1 / 2')).toBeVisible();
  await gallery.getByRole('button', { name: 'Next image' }).click();
  await expect(gallery.getByText('2 / 2')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(gallery.getByText('1 / 2')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(gallery.getByText('2 / 2')).toBeVisible();
  await gallery.getByRole('button', { name: 'Remove image 2' }).click();
  const confirmation = page.getByRole('dialog', { name: 'Remove this image?' });
  await confirmation.getByRole('button', { name: 'Keep image' }).click();
  await expect(gallery.getByText('2 / 2')).toBeVisible();
  await gallery.getByRole('button', { name: 'Remove image 2' }).click();
  await confirmation.getByRole('button', { name: 'Remove image' }).click();
  await expect(gallery).toBeVisible();
  await expect(gallery.getByRole('button', { name: 'Next image' })).toHaveCount(0);
  await gallery.getByRole('button', { name: 'Remove image 1' }).click();
  await confirmation.getByRole('button', { name: 'Remove image' }).click();
  await expect(gallery).not.toBeVisible();
  await expect(editor.getByRole('button', { name: 'View image 1' })).toHaveCount(0);
  await editor.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Open note: Gallery note' }).click();
  await expect(page.getByRole('button', { name: 'View image 1' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Delete note' }).click();
  await page.getByRole('dialog', { name: 'Delete this note?' }).getByRole('button', { name: 'Delete note' }).click();
});

test('receives an Android share as a draft and saves it on close', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  const share = async () => {
    const chooser = await page.evaluateHandle(() => {
      const input = document.createElement('input');
      input.type = 'file';
      document.body.append(input);
      return input;
    });
    await chooser.asElement()!.setInputFiles('tests/fixtures/image.jpg');
    return page.evaluate(async () => {
      const input = document.querySelector('body > input[type=file]') as HTMLInputElement;
      const form = new FormData();
      form.append('images', input.files![0]);
      input.remove();
      const response = await fetch('/share-target', { method: 'POST', body: form });
      return response.url;
    });
  };

  const first = await share();
  expect(first).toContain('share=');
  await page.goto(first);
  await expect(page.getByRole('dialog', { name: 'Add note' }).getByRole('img')).toHaveCount(1);
  await page.getByRole('button', { name: 'Close note' }).click();
  await expect(page.getByRole('dialog', { name: 'Leave without saving?' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Add note' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Open note: image.jpg' })).toBeVisible();
  expect(new URL(page.url()).search).toBe('');
  await page.goto(first);
  await expect(page.getByRole('status')).toContainText('no longer available');

  const second = await share();
  await page.goto(second);
  await page.getByRole('textbox', { name: 'Note', exact: true }).fill('Shared screenshot note');
  await page.getByRole('button', { name: 'Attach an image' }).click();
  await page.locator('input[type=file]').last().setInputFiles('tests/fixtures/image.jpg');
  await expect(page.getByRole('dialog', { name: 'Add note' }).getByRole('img')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Add note' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Open note: Shared screenshot note' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 10_000 });
  await page.goto(second);
  await expect(page.getByRole('status')).toContainText('no longer available');
});

test('can receive and save a shared screenshot offline', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const picker = await page.evaluateHandle(() => {
    const input = document.createElement('input');
    input.type = 'file';
    document.body.append(input);
    return input;
  });
  await picker.asElement()!.setInputFiles('tests/fixtures/image.jpg');
  await context.setOffline(true);
  await page.evaluate(() => {
    const picker = document.querySelector('body > input[type=file]') as HTMLInputElement;
    const form = document.createElement('form');
    form.action = '/share-target';
    form.method = 'POST';
    form.enctype = 'multipart/form-data';
    picker.name = 'images';
    form.append(picker);
    document.body.append(form);
    form.submit();
  });
  await expect(page).toHaveURL(/share=/);
  await expect(page.getByRole('dialog', { name: 'Add note' }).getByRole('img')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Title' }).fill('Shared while offline');
  await page.getByRole('button', { name: 'Close note' }).click();
  await expect(page.getByRole('button', { name: 'Open note: Shared while offline' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Saved on device' })).toBeVisible();
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 15_000 });
});

test('works offline after the first online visit and syncs on reconnect', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your notes' })).toBeVisible();
  await page.keyboard.press('n');
  await page.getByRole('textbox', { name: 'Title' }).fill('Written offline');
  await page.getByRole('button', { name: 'Close note' }).click();
  await expect(page.getByRole('button', { name: 'Open note: Written offline' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Saved on device' })).toBeVisible();
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 15_000 });
});

for (const width of [390, 834, 1440]) {
  test(`layout and accessibility at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Your notes' })).toBeVisible();
    const violations = await new AxeBuilder({ page }).analyze();
    expect(violations.violations).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
}

test('mobile create controls float while leaving the last notes clear at the bottom', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'New note' }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill('Tall mobile note');
  await page.getByRole('textbox', { name: 'Note', exact: true }).fill('Long thought. '.repeat(180));
  await page.getByRole('button', { name: 'Close note' }).click();
  await expect(page.getByRole('button', { name: 'Open note: Tall mobile note' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Create a note' });
  await expect(nav).toHaveCSS('position', 'fixed');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const clearance = await page.evaluate(() => {
    const navTop = document.querySelector<HTMLElement>('nav[aria-label="Create a note"]')!.getBoundingClientRect().top;
    const lastCardBottom = Math.max(...[...document.querySelectorAll<HTMLElement>('[data-note-id]')].map(card => card.getBoundingClientRect().bottom));
    return { gap: navTop - lastCardBottom, scrolled: scrollY > 0 };
  });
  expect(clearance.scrolled).toBe(true);
  expect(clearance.gap).toBeGreaterThanOrEqual(12);
});

test('serves the service worker and page shell without browser HTTP caching', async ({ request }) => {
  for (const path of ['/sw.js', '/', '/share-target']) {
    const response = await request.get(path);
    expect(response.ok()).toBe(true);
    expect(response.headers()['cache-control']).toContain('no-store');
  }
});

test('GET share-target bypasses cached navigation for older installed versions', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const response = await page.goto('/share-target');
  expect(response?.fromServiceWorker()).toBe(false);
  await expect(page.getByRole('heading', { name: 'Your notes' })).toBeVisible();
});

test('offers a refresh when a new offline app version is waiting', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your notes' })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const workerPath = 'dist/client/sw.js';
  const original = await readFile(workerPath, 'utf8');
  try {
    await writeFile(workerPath, `${original}\n// test update ${Date.now()}\n`);
    await page.evaluate(async () => (await navigator.serviceWorker.ready).update());
    await expect(page.getByRole('button', { name: 'Refresh app' })).toBeVisible({ timeout: 10_000 });
    const reloaded = page.waitForEvent('load', { timeout: 10_000 });
    await page.getByRole('button', { name: 'Refresh app' }).click();
    await reloaded;
    await expect(page.getByRole('heading', { name: 'Your notes' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Refresh app' })).toHaveCount(0, { timeout: 10_000 });
  } finally {
    await writeFile(workerPath, original);
  }
});

test('requires the owner password in a new browser profile', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto(baseURL!);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.getByLabel('Password').fill('incorrect password value');
  await page.getByRole('button', { name: 'Open jot.' }).click();
  await expect(page.getByRole('alert')).toContainText('Incorrect password');
  await page.getByLabel('Password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Open jot.' }).click();
  await expect(page.getByRole('heading', { name: 'Your notes' })).toBeVisible();
  await context.close();
});
