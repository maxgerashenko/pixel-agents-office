import type { Page } from '@playwright/test';

import { expect, test } from '../../fixtures/standalone';

/**
 * Home-Screen iPad mini: in view mode the office is fitted — whole layout,
 * between the top and bottom panels, nothing to zoom or pan; editing frees the
 * camera. Portrait (744x1133) gets the mobile shell, landscape (1133x744) the
 * desktop one.
 */

const PORTRAIT = { width: 744, height: 1133 };
const LANDSCAPE = { width: 1133, height: 744 };

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The drawn office (first..last non-VOID tile) and the panels, in CSS px. */
async function measure(
  page: Page,
): Promise<{ office: Box; topPanel: number; bottomPanel: number }> {
  return page.evaluate(() => {
    const hooks = window.__pixelAgentsTestHooks;
    const grid = hooks?.getTiles?.();
    if (!grid || !hooks?.getTileCenter) throw new Error('test hooks missing');
    let minC = Infinity;
    let maxC = -1;
    let minR = Infinity;
    let maxR = -1;
    grid.tiles.forEach((t, i) => {
      if (t === 255) return; // VOID
      const c = i % grid.cols;
      const r = Math.floor(i / grid.cols);
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
    });
    const a = hooks.getTileCenter(minC, minR);
    const b = hooks.getTileCenter(maxC, maxR);
    if (!a || !b) throw new Error('no projection');
    const canvas = document.querySelector('canvas')!.getBoundingClientRect();
    let topPanel = canvas.top;
    let bottomPanel = canvas.bottom;
    document.querySelectorAll('[data-fit-obstacle]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      if (el.getAttribute('data-fit-obstacle') === 'top') topPanel = Math.max(topPanel, r.bottom);
      else bottomPanel = Math.min(bottomPanel, r.top);
    });
    // Tile centres → half a tile of the zoomed grid beyond them is drawn.
    const tile = Math.abs(
      (hooks.getTileCenter(1, 0)?.x ?? 0) - (hooks.getTileCenter(0, 0)?.x ?? 0),
    );
    return {
      office: {
        left: a.x - tile / 2,
        top: a.y - tile / 2,
        right: b.x + tile / 2,
        bottom: b.y + tile / 2,
      },
      topPanel,
      bottomPanel,
    };
  });
}

async function expectFitted(page: Page) {
  // The test hooks register once the layout has loaded.
  await page.waitForFunction(() => !!window.__pixelAgentsTestHooks?.getTileCenter?.(0, 0));
  await expect
    .poll(async () => {
      const m = await measure(page);
      const vp = page.viewportSize()!;
      return (
        m.office.left >= -1 &&
        m.office.right <= vp.width + 1 &&
        m.office.top >= m.topPanel - 1 &&
        m.office.bottom <= m.bottomPanel + 1
      );
    })
    .toBe(true);
}

for (const [name, viewport] of [
  ['portrait', PORTRAIT],
  ['landscape', LANDSCAPE],
] as const) {
  test.describe(`Standalone / iPad mini ${name}`, () => {
    test.use({
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
      standaloneOptions: { viewport },
    });

    test(`the office is fitted between the panels and the camera is locked @area:standalone`, async ({
      page,
      standalone,
    }) => {
      void standalone;
      await expectFitted(page);
      const before = await measure(page);
      // A wheel pan and a ctrl+wheel zoom move nothing in view mode.
      await page.mouse.move(viewport.width / 2, viewport.height / 2);
      await page.mouse.wheel(0, 300);
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, -400);
      await page.keyboard.up('Control');
      await page.waitForTimeout(400);
      expect(await measure(page)).toEqual(before);
      // Anchored to the bottom: a ~25px gap above the bottom panels.
      expect(before.bottomPanel - before.office.bottom).toBeLessThan(29);
      expect(before.bottomPanel - before.office.bottom).toBeGreaterThanOrEqual(21);
      // Open space above for the sky: at least 10% of the viewport height.
      expect(before.office.top).toBeGreaterThanOrEqual(viewport.height * 0.1 - 2);
      // Landscape fills about half the side space the previous fit left: whole zoom 5 (40 CSS px per 16px tile at 2x).
      if (name === 'landscape') {
        const tile = await page.evaluate(() => {
          const h = window.__pixelAgentsTestHooks!;
          return h.getTileCenter!(1, 0)!.x - h.getTileCenter!(0, 0)!.x;
        });
        expect(tile).toBe(40);
      }
      await page.screenshot({ path: test.info().outputPath(`ipad-${name}.png`) });
    });
  });
}
