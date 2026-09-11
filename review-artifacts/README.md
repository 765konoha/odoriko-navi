# レビュー受け渡し用の成果物

ネットワークの無いレビュー環境でも、レビュー対象を参照できるようにしたもの。
アプリの動作には一切関係しない（ビルド成果物には含まれない）。

## 中身

| ファイル | 内容 | SHA-256 |
| --- | --- | --- |
| `odoriko-navi-pwa-review.bundle` | `9d2e4bd` を含む完全な履歴付きの git bundle。HEAD は `fc308a0` | `870f5f14ea64f1407380073120017c5502f4883732a2dbd0bd74ae4649ae6566` |
| `odoriko-navi-pwa-review.diff` | `git diff --binary 9d2e4bd..fc308a0` | `aec5d73a332268441a9776f42b0888461b475087b79b7c8f02cc5a9510264421` |

レビュー対象は次の5コミット。

```
07157cf fix: 祭りを切り替えたあと、古い取得結果を反映しない
fa3e1dd fix: ログアウト時に管理画面のキャッシュだけを消す
bb2bfa2 fix: 管理画面の読込・削除の失敗を画面に出す
e8fb85d test: 取得の競合と管理キャッシュの分離を単体テストで押さえる
fc308a0 fix: レビューで見つかった3点を直す(ログアウト・削除の誤表示・祭り切替)
```

## 使い方1: bundle から履歴ごと取り出す（コミット単位で読みたいとき）

```sh
git clone --branch claude/odoriko-navi-pwa-review-gjw304 \
    review-artifacts/odoriko-navi-pwa-review.bundle /tmp/review
cd /tmp/review
git log --oneline 9d2e4bd..HEAD
git show 07157cf
```

bundle には基点 `9d2e4bd` も含まれているので、ネットワークなしで完結する。

## 使い方2: diff をこの作業ツリーへ当てる（差分だけ読みたいとき）

diff の基点 `9d2e4bd` は、`main`（`a303a9c`）とツリーが完全に同一。
そのため main の checkout に対してそのまま当てられる。

```sh
git apply --check --binary review-artifacts/odoriko-navi-pwa-review.diff
git apply --binary review-artifacts/odoriko-navi-pwa-review.diff
```

当てた結果のツリーは `fc308a0` のツリー `9726dc82fc9c1a6971a9dc6a704e5fe89eed3ff8` と一致する
（`git add -A && git write-tree` で確認できる）。

## 注意

この5コミットはまだ main へマージしていない。
このディレクトリは受け渡し専用なので、レビューが終わったら削除してよい。
