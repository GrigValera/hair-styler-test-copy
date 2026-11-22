import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const url = 'http://127.0.0.1:4173';
const output = 'test-results/mobile';
const widths = [320, 360, 375, 390, 414, 430, 480, 600, 767];
const expectedHeights = [717, 936, 920];

const server = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
  'run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'
], { stdio: 'inherit', shell: process.platform === 'win32' });

let browser;

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Сервер ещё запускается.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Сервер production preview не запустился');
}

async function inspectMobile(page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, (img) => img.decode()));

    const slides = Array.from(document.querySelectorAll('[data-slide]'));
    const rect = (element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };

    // Определяем фактические строки текста по геометрии слов.
    function lines(selector) {
      const root = document.querySelector(selector);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const rows = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        for (const match of node.textContent.matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          const box = range.getBoundingClientRect();
          if (!box.width || !box.height) continue;
          let row = rows.find((item) => Math.abs(item.y - box.y) < 2);
          if (!row) {
            row = { y: box.y, words: [], left: box.left, right: box.right };
            rows.push(row);
          }
          row.words.push(match[0]);
          row.left = Math.min(row.left, box.left);
          row.right = Math.max(row.right, box.right);
        }
      }
      return rows.sort((a, b) => a.y - b.y).map((row) => ({
        text: row.words.join(' '),
        left: row.left,
        right: row.right
      }));
    }

    return {
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      wheelDisplay: getComputedStyle(document.querySelector('[data-wheel]')).display,
      slides: slides.map((slide) => ({
        ...rect(slide),
        hidden: slide.hidden,
        inert: slide.inert,
        display: getComputedStyle(slide).display
      })),
      images: Array.from(document.images, (img) => ({
        src: new URL(img.currentSrc).pathname,
        loaded: img.complete && img.naturalWidth > 0
      })),
      firstTitle: lines('.slide-01__title'),
      description: lines('.slide-02__description'),
      title: lines('.slide-03__mobile-title'),
      feature: lines('.slide-03__mobile-feature-text'),
      subtitle: lines('.slide-03__subtitle'),
      technology: rect(document.querySelector('.slide-03__technology')),
      star: rect(document.querySelector('.slide-03__star'))
    };
  });
}

function closeTo(actual, expected, label, tolerance = 2) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    label + ': ' + actual + ' вместо ' + expected);
}

try {
  await mkdir(output, { recursive: true });
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(() => window.scrollY === 0);
    const data = await inspectMobile(page);
    const scale = width / 320;

    if ([320, 390, 767].includes(width)) {
      await page.screenshot({ path: output + '/mobile-' + width + '.png', fullPage: true });
    }

    assert.equal(data.viewport, width);
    assert.equal(data.wheelDisplay, 'none');
    assert.equal(data.slides.length, 3);
    assert.ok(data.scrollWidth <= width, 'Горизонтальное переполнение: ' + width);

    let top = 0;
    for (let index = 0; index < data.slides.length; index += 1) {
      const slide = data.slides[index];
      assert.ok(!slide.hidden && !slide.inert && slide.display !== 'none');
      closeTo(slide.width, width, 'Ширина слайда');
      closeTo(slide.y, top, 'Положение слайда');
      closeTo(slide.height, expectedHeights[index] * scale, 'Высота слайда');
      top += expectedHeights[index] * scale;
    }
    closeTo(data.scrollHeight, top, 'Высота презентации');

    assert.ok(data.images.every((img) => img.loaded), 'Не загружены изображения');
    for (const src of [
      '/images/slide-01/slide-01-background-mobile.png',
      '/images/slide-02/slide-02-model-mobile.png',
      '/images/slide-03/slide-03-technology-mobile.png'
    ]) {
      assert.ok(data.images.some((img) => img.src === src), 'Не выбран мобильный ресурс: ' + src);
    }

    assert.deepEqual(data.firstTitle.map((line) => line.text), [
      'ФЕН И СТАЙЛЕР',
      'в уникальном дизайне'
    ]);
    assert.deepEqual(data.description.map((line) => line.text), [
      'Уменьшает усталость рук',
      'при сушке волос, делая',
      'процедуру удобной и приятной',
      'даже после напряжённого',
      'рабочего дня.'
    ]);
    assert.deepEqual(data.title.map((line) => line.text), [
      'ДЛЯ ЦЕНИТЕЛЕЙ',
      'КОМФОРТА',
      'И КАЧЕСТВА',
      'В УХОДЕ ЗА ВОЛОСАМИ'
    ]);
    assert.deepEqual(data.feature.map((line) => line.text), [
      'ИННОВАЦИОННЫЙ',
      'ЯПОНСКИЙ МОТОР'
    ]);
    assert.deepEqual(data.subtitle.map((line) => line.text), [
      'Бесщеточный',
      'мотор BLDC'
    ]);
    for (const line of [...data.firstTitle, ...data.description, ...data.title, ...data.feature, ...data.subtitle]) {
      assert.ok(line.left >= -1 && line.right <= width + 1,
        'Текст выходит за границы: ' + line.text + ' (' + width + ')');
    }

    closeTo(data.technology.y - data.slides[2].y, 347 * scale, 'Положение двигателя');
    closeTo(data.technology.height, 407 * scale, 'Высота двигателя');
    closeTo(data.star.y - data.slides[2].y, 697 * scale, 'Положение звезды');
    closeTo(data.star.width, 180 * scale, 'Размер звезды');

    await page.mouse.move(width / 2, 400);
    await page.mouse.wheel(0, 500);
    await page.waitForFunction(() => window.scrollY > 0);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction(() => {
      const last = document.querySelector('#slide-03').getBoundingClientRect();
      return last.bottom <= innerHeight + 2;
    });

    console.log('Мобильная ширина ' + width + ': проверка пройдена');
  }

  // Проверяем переключение режимов на одном экземпляре страницы.
  await page.setViewportSize({ width: 768, height: 900 });
  await page.waitForFunction(() => {
    const slides = [...document.querySelectorAll('[data-slide]')];
    return slides.filter((slide) => !slide.hidden).length === 1 &&
      getComputedStyle(document.querySelector('[data-wheel]')).display !== 'none';
  });

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => document.querySelector('#slide-01').hidden &&
    !document.querySelector('#slide-02').inert);
  await page.keyboard.press('End');
  await page.waitForFunction(() => document.querySelector('#slide-02').hidden &&
    !document.querySelector('#slide-03').inert);

  await page.setViewportSize({ width: 767, height: 900 });
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[data-slide]')].every((slide) =>
      !slide.hidden && !slide.inert && getComputedStyle(slide).display !== 'none') &&
    getComputedStyle(document.querySelector('[data-wheel]')).display === 'none'
  );

  assert.deepEqual(errors, [], 'Ошибки консоли браузера');
  console.log('Переходы между режимами и отсутствие ошибок: проверка пройдена');
} finally {
  await browser?.close();
  server.kill();
}
