import { test, expect } from '@playwright/test';

for (const width of [390, 834, 1440]) {
  for (const mode of ['new', 'existing']) {
    test(`${mode} note textarea stays fixed at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      if (mode === 'new') {
        await page.locator('[data-action="new"]:visible').click();
      } else {
        await page.getByRole('button', { name: 'Open note: A tiny idea', exact: true }).click();
      }
      const textarea = page.getByRole('textbox', { name: 'Note', exact: true });
      await expect(textarea).toHaveCSS('resize', 'none');
      await expect(textarea).toHaveCSS('overflow-y', 'auto');
      const before = await textarea.boundingBox();
      await textarea.fill('A long note that needs scrolling.\n'.repeat(100));
      const after = await textarea.boundingBox();
      expect(after.width).toBe(before.width);
      expect(after.height).toBe(before.height);
      expect(await textarea.evaluate(element => {
        element.scrollTop = element.scrollHeight;
        return element.scrollHeight > element.clientHeight && element.scrollTop > 0;
      })).toBe(true);
      await expect(page.getByRole('button', { name: 'Save note', exact: true })).toBeVisible();
    });
  }
}
