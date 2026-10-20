# フリック数式パッド

肢体不自由の学生が、大きなキーのフリック操作で数式を入力し、Wordなどに貼り付けるためのWebアプリ（PWA）。
入力内容や設定はブラウザの中だけに保存し、サーバーには送りません。

- 公開URL（GitHub Pages）：https://winmow.github.io/flick-math/
- 仕様：[SPEC.md](SPEC.md)　開発の進め方：[CLAUDE.md](CLAUDE.md)　デプロイ：[docs/deploy.md](docs/deploy.md)
- Word互換テストの記録：[docs/word-compat.md](docs/word-compat.md)

## 開発

```bash
npm ci
npm run dev        # 開発サーバー
npm test           # ユニットテスト
npm run test:e2e   # E2E・アクセシビリティ検査
npm run test:pwa   # 本番ビルドでオフライン起動などを検査
npm run build      # dist/ に本番ビルド
```

`prototype/` は操作感の見本（1ファイルの試作）で、本番ビルドには含まれません。
