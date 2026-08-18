# 踊り子ナビ(odoriko-navi)

よさこい祭り等に参加する踊り子が、祭り当日に「次に何時・どこへ行けばよいか」をスマートフォンからすぐ確認できる Web アプリ。

- **踊り子向け(共有用 URL)**: https://765konoha.github.io/odoriko-navi/
- **運営管理画面**: https://765konoha.github.io/odoriko-navi/#/admin(要ログイン)

main ブランチへの push で GitHub Actions が自動デプロイする。

- 設計書: [docs/DESIGN.md](docs/DESIGN.md)
- スタック: React 19 / TypeScript / Vite / Tailwind CSS v4 / React Router v7(HashRouter)/ Leaflet / Supabase / GitHub Pages

## 開発

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
```
