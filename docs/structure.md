# Repository Structure

本リポジトリは「開発用だが公開しても見せられる」前提で、
実装と参考資料を分離しています。

## Top-level

- `src/` プラグイン実装
- `styles.css` UIスタイル
- `scripts/` ビルド/デプロイ
- `docs/` ドキュメントと参考資料
- `tests/` 手動検証メモ

## docs/

- `docs/lifeplanner.md` プラグイン概要
- `docs/structure.md` 構成ガイド（本ファイル）
- `docs/reference/` 参考資料まとめ
  - `specs/` 仕様・計画・タスク
  - `sheets/` 変換したシートMarkdown
  - `source/` 元データ（xlsx等）
  - `notes/` 作業メモ

## Local-only

- `.codex/` ローカル支援データ（Git管理対象外）
- `.local/` ローカル保存用ディレクトリ（Git管理対象外）
