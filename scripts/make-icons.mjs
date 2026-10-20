// 仮のアイコン（アプリ名・アイコンは SPEC §11 の未決事項）。差し替えるときはこのSVGを直して再実行する。
//   node scripts/make-icons.mjs
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const bg = '#0B6B86';
// 中央のキーと、上下左右へのフリックを表す4つの三角。safe: マスカブル用に中央80%へ収める
const glyph = (scale) => `
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)" fill="#fff">
    <rect x="176" y="176" width="160" height="160" rx="36"/>
    <path d="M256 52 l56 72 h-112 z"/>
    <path d="M256 460 l56 -72 h-112 z"/>
    <path d="M52 256 l72 -56 v112 z"/>
    <path d="M460 256 l-72 -56 v112 z"/>
  </g>`;
const svg = (scale, round) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" ${round ? 'rx="96"' : ''} fill="${bg}"/>${glyph(scale)}</svg>`;

writeFileSync('public/icons/icon.svg', svg(0.9, true));

const browser = await chromium.launch();
const jobs = [
  ['public/icons/icon-192.png', 192, svg(0.9, true)],
  ['public/icons/icon-512.png', 512, svg(0.9, true)],
  ['public/icons/maskable-512.png', 512, svg(0.62, false)],
  ['public/icons/apple-touch-icon.png', 180, svg(0.78, false)],
];
for (const [path, size, markup] of jobs) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${markup}`);
  await page.screenshot({ path, omitBackground: true });
  await page.close();
}
await browser.close();
