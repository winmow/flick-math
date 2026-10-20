# デプロイ

本番ビルド（`npm run build`）は `dist/` に静的ファイルを作ります。サーバー側の処理はありません。
ビルドは相対パス（`base: './'`）なので、サブパス配信（GitHub Pages）にもルート配信（Cloudflare Pages）にもそのまま使えます。

## tools.studio-ray.org/flick-math/（正式な公開URL）
別リポジトリ winmow/tools-portal（Cloudflare Pages、`main` へのpushで自動デプロイ）の `flick-math/` フォルダに、ビルド結果をコピーして公開します。

```bash
npm run publish:tools -- /Users/omae/dev/tools-portal
cd /Users/omae/dev/tools-portal && git add -A && git commit -m "flick-math を更新" && git push
```

ヘッダー（CSP）は tools-portal 直下の `_headers`（`/flick-math/*`）に書いてあります。内容を変えるときは、このリポジトリの `public/_headers` と合わせてください。

## GitHub Pages（バックアップの配信）
`.github/workflows/deploy.yml` が、`main` へのpushで次を実行します。

1. 型検査、ユニットテスト、E2E（axe含む）、PWA検査（オフライン起動・外部通信なし・CSP）
2. すべて通ったら `dist/` をGitHub Pagesへ公開

初回だけ、リポジトリの Settings → Pages → Build and deployment の Source を **GitHub Actions** にします
（CLIなら `gh api -X PUT repos/<owner>/<repo>/pages -f build_type=workflow`）。
プルリクエストではテストだけが走り、公開はされません。

GitHub Pages は HTTP ヘッダーを設定できないため、`public/_headers` のCSPなどは効きません。

## Cloudflare Pages（SPEC §2 の想定配信先）
1. Cloudflare Pages でGitHubリポジトリを連携
2. ビルドコマンド `npm run build`、出力ディレクトリ `dist`、環境変数 `NODE_VERSION=22`
3. `public/_headers` が配信時のヘッダーになります
   - CSP：自分のサイト以外への通信・読み込みを禁止（`connect-src 'self'`）。利用者の入力を外に出さない方針の最後の砦
   - `sw.js` と `index.html` は `no-cache`（新しい版を見つけられるように）

### 公開範囲（SPEC §11 の未決事項）
- 誰でも使える公開URL：上記のままでよい
- 学内限定：Cloudflare Access（Zero Trust）で、このPagesプロジェクトに対して学内のメールドメイン等のポリシーを設定する。アプリ側の変更は不要

## 新しい版の反映
Service Worker は、新しい版を見つけ次第、古い版と入れ替わります（`skipWaiting` と `clientsClaim`）。
ただし開いているページは自動で再読み込みしないので、入力中の数式は消えません。
**次にアプリを開いた・再読み込みしたときから**新しい版になります。どの版が出ているかは、設定画面の最下部「アプリの版」で確かめられます。

古い版のままになったとき（この仕組みを入れる前の版を使っている端末など）：
- ホーム画面のアプリ：アプリを完全に終了して開き直す。直らなければ、もう一度繰り返す
- Safari：タブをすべて閉じて開き直す。直らなければ、設定 → Safari → 詳細 → Webサイトデータ から、このサイトのデータを消す
