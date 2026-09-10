import { defineConfig } from "vitest/config";

// 単体テスト用。アプリのビルド設定(vite.config.ts の base や PWA)は読み込まない。
// DOM を使わない純粋な処理だけを対象にしている。
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
