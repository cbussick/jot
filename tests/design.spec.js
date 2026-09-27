import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const [width, height, columns] of [[320,740,2],[390,844,2],[768,1024,3],[834,1194,3],[1024,768,3],[1440,1000,4]]) {
  test(`layout at ${width} × ${height}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every(image => image.complete));
    await expect(page.locator('.note-card')).toHaveCount(12);
    for (const board of await page.locator('.note-board').all()) {
      await expect(board).toHaveCSS('--columns', String(columns));
    }
    const typography = await page.locator('.note-title, .note-body, .note-date').evaluateAll(elements => elements.map(element => ({
      type: element.className, size: parseFloat(getComputedStyle(element).fontSize), font: getComputedStyle(element).fontFamily,
    })));
    for (const text of typography) {
      expect(text.font).toContain('Manrope');
      const expectedSize = text.type === 'note-date' ? 12 : text.type === 'note-title' ? (width <= 360 ? 14 : width <= 700 ? 15 : 17) : (width <= 360 ? 13 : 14);
      expect(text.size).toBe(expectedSize);
    }
    await expect(page.locator('.board-footer, .prototype-notice, .handwritten, .capture-bar kbd, .note-date svg, .heading-spark, .page-heading p')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Your notes', exact: true })).toBeVisible();
    await expect(page.locator('[data-action="new"]:visible')).toHaveCount(1);
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const boxes = await page.locator('.note-card').evaluateAll(cards => cards.map(card => {
      const {x,y,width,height} = card.getBoundingClientRect(); return {x,y,width,height};
    }));
    for (let i=0;i<boxes.length;i++) for (let j=i+1;j<boxes.length;j++) {
      const a=boxes[i], b=boxes[j];
      expect(a.x+a.width <= b.x+.5 || b.x+b.width <= a.x+.5 || a.y+a.height <= b.y+.5 || b.y+b.height <= a.y+.5).toBe(true);
    }
    await page.getByRole('button', { name: 'Open note: A tiny idea', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'A little note', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.querySelector('#editor').scrollWidth <= document.querySelector('#editor').clientWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('#editor')).not.toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('single capture entry point works across devices without prototype copy', async ({ page }) => {
  for (const width of [390, 834, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.locator('body')).not.toContainText(/prototype|preview/i);
    const capture = page.locator('[data-action="new"]:visible');
    await expect(capture).toHaveCount(1);
    await capture.click();
    await expect(page.locator('#editor')).toBeVisible();
    await page.getByRole('textbox', { name: 'Note', exact: true }).fill('A new thought');
    await page.getByRole('button', { name: 'Save note', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Note added');
  }
});

test('search and empty state', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox').fill('pasta');
  await expect(page.locator('.note-card')).toHaveCount(1);
  await page.getByRole('searchbox').fill('nonexistent');
  await expect(page.getByRole('heading', { name: 'Nothing here just yet.' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.locator('.note-card')).toHaveCount(12);
});

test('create, edit, color, cancel and permanently delete', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('n');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Add some text');
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Test thought');
  await page.getByRole('textbox', { name: 'Note', exact: true }).fill('<img src=x onerror=alert(1)> is plain text');
  await page.getByRole('radio', { name: 'Butter', exact: true }).check();
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.locator('.note-card')).toHaveCount(13);
  const card = page.getByRole('button', { name: 'Open note: Test thought', exact: true });
  await expect(card).toHaveClass(/butter/);
  await expect(card.locator('img')).toHaveCount(0);
  await card.click();
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Unsaved');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Leave without saving?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await page.getByRole('button', { name: 'Open note: Unsaved', exact: true }).click();
  await page.getByRole('button', { name: 'Delete note', exact: true }).click();
  await page.getByRole('button', { name: 'Keep note', exact: true }).click();
  await expect(page.locator('#editor')).toBeVisible();
  await page.getByRole('button', { name: 'Delete note', exact: true }).click();
  await page.locator('#confirm-dialog').getByRole('button', { name: 'Delete note', exact: true }).click();
  await expect(page.locator('.note-card')).toHaveCount(12);
});

test('image note and invalid upload', async ({ page }) => {
  await page.goto('/');
  await page.locator('#image-input').setInputFiles('assets/coffee.jpg');
  await expect(page.locator('#editor-images img')).toHaveCount(1);
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.locator('.note-card')).toHaveCount(13);
  await expect(page.locator('#note-board .note-card').first().locator('img')).toBeVisible();
  await page.keyboard.press('n');
  await page.locator('#image-input').setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.getByRole('alert')).toContainText('Choose a JPG');
  await expect(page.locator('#editor-images img')).toHaveCount(0);
});

test('sync status reflects the actual disconnected state', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Not connected', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Device sync isn’t available yet');
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

for (const width of [390,834,1440]) {
  test(`accessibility at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
    await page.getByRole('button', { name: 'Open note: A tiny idea', exact: true }).click();
    const editorResults = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(editorResults.violations).toEqual([]);
  });
}

test('design review switches all three viewports', async ({ page }) => {
  await page.goto('/designs.html');
  await expect(page.locator('body')).not.toContainText(/prototype/i);
  for (const [device,width] of [['iPad',834],['Phone',390],['Desktop',1440]]) {
    await page.getByRole('button', { name: device, exact: true }).click();
    await expect(page.locator('#preview')).toHaveAttribute('width', String(width));
    await expect(page.getByRole('button', { name: device, exact: true })).toHaveAttribute('aria-pressed','true');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Phone', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
