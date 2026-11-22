import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = 'http://127.0.0.1:4174';
const output = 'test-results/desktop';
const sizes = [
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 }
];

const server = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
  'run', 'preview', '--', '--host', '127.0.0.1', '--port', '4174', '--strictPort'
], { stdio: 'inherit', shell: process.platform === 'win32' });

let browser;

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Ожидаем запуска сервера.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Production preview не запустился');
}

function activeSlide(page, index) {
  return page.waitForFunction((i) => {
    const slides = [...document.querySelectorAll('[data-slide]')];
    return slides.length === 3 && slides.every((slide, n) =>
      n === i ? (!slide.hidden && slide.classList.contains('is-active')) :
        (slide.hidden && !slide.classList.contains('is-active')));
  }, index);
}

async function waitForTransition(page, index) {
  await page.waitForFunction((i) => {
    const slides = [...document.querySelectorAll('[data-slide]')];
    return slides.length === 3 && slides.every((slide, n) =>
      n === i ? (!slide.hidden && slide.classList.contains('is-active')) :
        (slide.hidden && !slide.classList.contains('is-active')));
  }, index, { timeout: 6000 });
}

async function textLines(page, selector) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const rows = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      for (const match of node.textContent.matchAll(/\S+/g)) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const rect = range.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        let row = rows.find((r) => Math.abs(r.y - rect.y) < 2);
        if (!row) {
          row = { y: rect.y, words: [] };
          rows.push(row);
        }
        row.words.push(match[0]);
      }
    }
    return rows.sort((a, b) => a.y - b.y).map((r) => r.words.join(' '));
  }, selector);
}

try {
  await mkdir(output, { recursive: true });
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  for (const size of sizes) {
    const page = await browser.newPage({ viewport: size });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await waitForTransition(page, 0);
    assert.equal(await page.locator('[data-wheel] .wheel__button').count(), 18);
    assert.notEqual(await page.locator('[data-wheel]').evaluate((node) =>
      getComputedStyle(node).display), 'none');

    // На десктопе должна существовать ровно одна центральная иконка.
    async function expectWheel(index) {
      const centers = await page.locator('.wheel__button[aria-current="step"]').all();
      assert.equal(centers.length, 1);
      assert.equal(Number(await centers[0].getAttribute('data-slide-target')), index);
    }

    await expectWheel(0);
    if (size.width >= 1280) {
      await page.screenshot({ path: output + '/slide-1-' + size.width + '.png' });
    }

    // Переход кликом и сверка переносов текста на втором слайде.
    await page.locator('.wheel__button.is-visible[data-slide-target="1"]').first().click();
    await waitForTransition(page, 1);
    await expectWheel(1);

    assert.deepEqual(await textLines(page, '.slide-02__description--desktop'), [
      'Уменьшает усталость рук',
      'при сушке волос, делая процедуру',
      'удобной и приятной даже после',
      'напряжённого рабочего дня.'
    ]);

    const loaded = await page.locator('.slide-02__model img').evaluate((img) => ({
      loaded: img.complete && img.naturalWidth > 0,
      src: new URL(img.currentSrc).pathname
    }));
    assert.equal(loaded.loaded, true);
    assert.equal(loaded.src, '/images/slide-02/slide-02-model.webp');

    if (size.width >= 1280) {
      await page.screenshot({ path: output + '/slide-2-' + size.width + '.png' });
    }

    // Движение колеса мыши и переключение третьего слайда.
    await page.mouse.wheel(0, 110);
    await waitForTransition(page, 2);
    await expectWheel(2);
    if (size.width >= 1280) {
      await page.screenshot({ path: output + '/slide-3-' + size.width + '.png' });
    }

    // Клавиатура: переход в начало и в конец.
    await page.keyboard.press('Home');
    await waitForTransition(page, 0);
    await expectWheel(0);
    await page.keyboard.press('End');
    await waitForTransition(page, 2);
    await expectWheel(2);

    assert.deepEqual(errors, [], 'Ошибки браузера');
    console.log('Десктоп ' + size.width + ' × ' + size.height + ': проверка пройдена');
    await page.close();
  }

  // Уменьшение движения и быстрые события проверяем отдельно.
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.keyboard.press('End');
  await waitForTransition(page, 2);
  await page.keyboard.press('Home');
  await waitForTransition(page, 0);
  await page.close();
  console.log('Отключение анимации: проверка пройдена');
} finally {
  await browser?.close();
  server.kill();
}
