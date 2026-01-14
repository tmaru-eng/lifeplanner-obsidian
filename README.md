# LifePlanner (Obsidian Plugin)

人生を計画・実行するための管理アプリとして使える、Obsidian向けプラグインです。
週間計画・目標・アクションプラン・演習シートなどを同一UIで管理します。

## Features

- 週間計画（テーマ/ルーティン/役割/振り返り/日付メモ）
- 目標（ネスト/ドラッグ移動/期限/展開状態の保持）
- アクションプラン（目標タスクの編集と週間計画への紐付け）
- Inbox / Issues / 演習シート
- Obsidianサイドバーアイコンから起動

## Usage

全項目と使い方の整理は `docs/usage-map.md` を参照してください。

## Install

### From GitHub Release

1. Download `lifeplanner.zip` from the latest GitHub Release.
2. Extract to `.obsidian/plugins/lifeplanner/` in your vault.
3. Restart Obsidian or reload plugins.

### Local build

```sh
npm install
npm run build
./scripts/build-deploy.sh
```

## Repository Structure

- `src/` プラグイン本体
- `styles.css` UIスタイル
- `scripts/` ビルド/デプロイ
- `docs/` 仕様/メモ/参考資料
  - `docs/reference/specs/` 仕様・計画ドキュメント
  - `docs/reference/sheets/` 変換元のシートMarkdown
  - `docs/reference/source/` 元データ（xlsx等）
  - `docs/reference/notes/` 作業メモ

詳細は `docs/structure.md` を参照してください。

## Release

`docs/release.md` にパッケージ作成手順をまとめています。

## Notes

- `.codex/` はローカルの支援データのためGit管理対象外です。
- `docs/reference/` 配下は参考資料として保持しています。
