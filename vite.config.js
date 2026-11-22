import { defineConfig } from 'vite';

// Локальная разработка остаётся в корне сайта; Pages размещает проект в подпапке.
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true'
    ? '/hair-styler-test-copy/'
    : '/',
});
