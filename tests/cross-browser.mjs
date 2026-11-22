import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { firefox, webkit } from 'playwright';

const url = 'http://127.0.0.1:4175';
const browsers = { firefox, webkit };
const output = 'test-results/cross-browser';

const server = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
  'run', 'preview', '--', '--host', '127.0.0.1', '--port', '4175', '--strictPort'
], { stdio: 'inherit', shell: process.platform === 'win32' });

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Ожидаем запуска сервера.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Production preview не запустился');
}

async function waitForSlide(page, current) {
  await page.waitForFunction((index) => {
    const slides = [...document.querySelectorAll('[data-slide]')];
    return slides.length === 3 && slides.every((slide, i) =>
      i === index
        ? !slide.hidden && slide.classList.contains('is-active')
        : slide.hidden && !slide.classList.contains('is-active')
    );
  }, current, { timeout: 7000 });
}

try {
  await mkdir(output, { recursive: true });
  await waitForServer();

  for (const [name, launcher] of Object.entries(browsers)) {
    const browser = await launcher.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 320, height: 900 }
      });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));

      await page.goto(url, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const mobile = await page.evaluate(() => {
        const slides = [...document.querySelectorAll('[data-slide]')];
        return {
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
          heights: slides.map(el => el.getBoundingClientRect().height),
          hidden: slides.map(el => el.hidden),
          wheel: getComputedStyle(document.querySelector('[data-wheel]')).display
        };
      });

      assert.equal(mobile.horizontalOverflow, false);
      assert.deepEqual(mobile.hidden, [false, false, false]);
      assert.equal(mobile.wheel, 'none');
      for (const [index, height] of [717, 936, 920].entries()) {
        assert.ok(Math.abs(mobile.heights[index] - height) <= 2,
          name + ': высота мобильного слайда ' + (index + 1));
      }

      await page.screenshot({
        path: output + '/' + name + '-mobile-320.png',
        fullPage: true
      });

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForFunction(() => {
        const slides = [...document.querySelectorAll('[data-slide]')];
        return slides.filter(el => !el.hidden).length === 1 &&
          getComputedStyle(document.querySelector('[data-wheel]')).display !== 'none';
      });
      await waitForSlide(page, 0);
      await page.keyboard.press('End');
      await waitForSlide(page, 2);
      assert.equal(await page.locator('.wheel__button[aria-current="step"]')
        .getAttribute('data-slide-target'), '2');

      await page.screenshot({ path: output + '/' + name + '-desktop-1280.png' });

      await page.keyboard.press('Home');
      await waitForSlide(page, 0);
      await page.locator('.wheel__button.is-visible[data-slide-target="1"]').first().click();
      await waitForSlide(page, 1);

      await page.setViewportSize({ width: 390, height: 900 });
      await page.waitForFunction(() =>
        [...document.querySelectorAll('[data-slide]')].every(el => !el.hidden));
      assert.deepEqual(errors, [], name + ': ошибки JavaScript');
      await page.close();
      console.log(name + ': мобильная и десктопная проверка пройдена');
    } finally {
      await browser.close();
    }
  }
} finally {
  server.kill();
}
