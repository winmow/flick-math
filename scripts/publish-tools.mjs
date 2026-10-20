// 本番ビルド(dist)を tools-portal の flick-math/ フォルダへコピーする。
//   npm run publish:tools -- /Users/omae/dev/tools-portal
// 公開先は https://tools.studio-ray.org/flick-math/ 。ヘッダー(CSP)は tools-portal 直下の _headers に書く。
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const target = process.argv[2];
if (!target) {
  console.error('使い方: npm run publish:tools -- <tools-portal のパス>');
  process.exit(1);
}
const portal = resolve(target);
if (!existsSync(join(portal, 'index.html'))) {
  console.error(`tools-portal ではないようです: ${portal}`);
  process.exit(1);
}
const out = join(portal, 'flick-math');
rmSync(out, { recursive: true, force: true });
cpSync('dist', out, {
  recursive: true,
  // _headers は Cloudflare Pages のサイト直下でしか効かないので、ここには置かない
  filter: (src) => !src.endsWith('/_headers'),
});
console.log(`コピーしました: ${out} (${readdirSync(out).length} 項目)`);
