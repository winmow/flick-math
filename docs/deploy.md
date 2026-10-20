# デプロイ

本番ビルド（`npm run build`）は `dist/` に静的ファイルを作ります。サーバー側の処理はありません。
ビルドは相対パス（`base: './'`）なので、サブパス配信（GitHub Pages）にもルート配信（Cloudflare Pages）にもそのまま使えます。

## GitHub Pages（現在の配信）
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
Service Worker は、すべてのタブを閉じて開き直したときに新しい版へ切り替わります
（入力中に勝手に再読み込みしないため）。支援室の共用タブレットでは、アプリを一度完全に終了してから開き直してください。
