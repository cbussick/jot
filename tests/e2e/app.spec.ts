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
  await expect(page.getByRole('dialog', { name: 'A little note' })).not.toBeVisible();
  await page.getByRole('searchbox').fill('edited private');
  await expect(page.getByText('An edited private thought.')).toBeVisible();
  await page.getByRole('searchbox').fill('');
  await page.getByRole('button', { name: 'Open note: Keep this close' }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill('');
  await page.getByRole('textbox', { name: 'Note', exact: true }).fill('');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'A little note' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Open note: Image note' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Open note: Image note' }).click();
  await page.getByRole('button', { name: 'Delete note' }).click();
  await page.getByRole('dialog', { name: 'Delete this note?' }).getByRole('button', { name: 'Delete note' }).click();
  await expect(page.getByRole('button', { name: 'Open note: Image note' })).not.toBeVisible();
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
  await expect(page.getByRole('dialog', { name: 'A little note' })).not.toBeVisible();
});

test('drags notes into a persistent order and supports keyboard reordering', async ({ page }) => {
  await page.goto('/');
  for (const title of ['Order one', 'Order two', 'Order three']) {
    await page.getByRole('button', { name: 'A thought worth keeping…' }).click();
    await page.getByRole('textbox', { name: 'Title' }).fill(title);
    await page.getByRole('button', { name: 'Close note' }).click();
  }
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 10_000 });
  const board = page.getByRole('list', { name: 'Notes' });
  const titles = async () => (await board.getByRole('button', { name: /^Open note:/ }).allTextContents()).filter(text => text.includes('Order '));
  const first = page.getByRole('button', { name: 'Move note: Order one. Drag or use arrow keys' });
  const start = await first.boundingBox();
  const end = await page.getByRole('button', { name: 'Open note: Order three' }).boundingBox();
  await page.mouse.move(start!.x + 18, start!.y + 18);
  await page.mouse.down();
  await page.mouse.move(end!.x + end!.width / 2, end!.y + end!.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await titles()).map(text => text.includes('Order one') ? 'one' : text.includes('Order two') ? 'two' : 'three')).toEqual(['one', 'three', 'two']);
  await expect(page.getByRole('button', { name: 'Synced' })).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect.poll(async () => (await titles()).map(text => text.includes('Order one') ? 'one' : text.includes('Order two') ? 'two' : 'three')).toEqual(['one', 'three', 'two']);
  await first.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await titles()).map(text => text.includes('Order one') ? 'one' : text.includes('Order two') ? 'two' : 'three')).toEqual(['three', 'one', 'two']);
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
  await expect(page.getByRole('dialog', { name: 'Something worth keeping' })).not.toBeVisible();
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
    await expect(page.getByRole('dialog', { name: 'A little note' })).toBeVisible();
  });
}

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
  await expect(page.getByRole('dialog', { name: 'Something worth keeping' }).getByRole('img')).toHaveCount(1);
  await page.getByRole('button', { name: 'Close note' }).click();
  await expect(page.getByRole('dialog', { name: 'Leave without saving?' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Something worth keeping' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Open note: image.jpg' })).toBeVisible();
  expect(new URL(page.url()).search).toBe('');
  await page.goto(first);
  await expect(page.getByRole('status')).toContainText('no longer available');

  const second = await share();
  await page.goto(second);
  await page.getByRole('textbox', { name: 'Note', exact: true }).fill('Shared screenshot note');
  await page.getByRole('button', { name: 'Attach an image' }).click();
  await page.locator('input[type=file]').last().setInputFiles('tests/fixtures/image.jpg');
  await expect(page.getByRole('dialog', { name: 'Something worth keeping' }).getByRole('img')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Something worth keeping' })).not.toBeVisible();
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
  await expect(page.getByRole('dialog', { name: 'Something worth keeping' }).getByRole('img')).toHaveCount(1);
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

test('mobile create controls never cover notes while scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'New note' }).click();
  await page.getByRole('textbox', { name: 'Title' }).fill('Tall mobile note');
  await page.getByRole('textbox', { name: 'Note', exact: true }).fill('Long thought. '.repeat(180));
  await page.getByRole('button', { name: 'Close note' }).click();
  await expect(page.getByRole('button', { name: 'Open note: Tall mobile note' })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 200));
  const overlap = await page.evaluate(() => {
    const nav = document.querySelector<HTMLElement>('nav[aria-label="Create a note"]')!.getBoundingClientRect();
    const cards = [...document.querySelectorAll<HTMLElement>('[data-note-id]')].map(card => card.getBoundingClientRect());
    return cards.some(card => card.left < nav.right && card.right > nav.left && card.top < nav.bottom && card.bottom > nav.top);
  });
  expect(overlap).toBe(false);
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

test('requires the owner password in a new browser profile', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4273/');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.getByLabel('Password').fill('incorrect password value');
  await page.getByRole('button', { name: 'Open jot.' }).click();
  await expect(page.getByRole('alert')).toContainText('Incorrect password');
  await page.getByLabel('Password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Open jot.' }).click();
  await expect(page.getByRole('heading', { name: 'Your notes' })).toBeVisible();
  await context.close();
});
