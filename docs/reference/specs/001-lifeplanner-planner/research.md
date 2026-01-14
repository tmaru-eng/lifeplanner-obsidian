# Research: LifePlanner プラグイン

## Decision 1: Markdownのみで運用する

- **Decision**: すべてのデータをObsidian Vault内のMarkdownに保存する。
- **Rationale**: 憲章でMarkdown統一が必須であり、可搬性と検索性を最優先するため。
- **Alternatives considered**: ローカルDBやJSONの併用 (可視性と編集性が下がるため採用しない)

## Decision 2: 週間計画タブを既定ダッシュボードにする

- **Decision**: 起動時に週間計画タブを表示し、タスク配置を最短導線にする。
- **Rationale**: 週次運用が中心であり、最初に価値を感じる体験だから。
- **Alternatives considered**: 目標タブやInboxの既定化 (週次計画の即時性が下がるため採用しない)

## Decision 3: 目標階層を固定の7階層で扱う

- **Decision**: 人生→長期→中期→年間→四半期→月間→週間の階層を固定で管理する。
- **Rationale**: フランクリンプランナー的な運用を明確にし、迷いを減らすため。
- **Alternatives considered**: 任意階層のカスタム構造 (使い方が分岐しすぎるため採用しない)

## Decision 4: タスクは目標からのブレイクダウンを必須とする

- **Decision**: タスクは目標に紐づけて作成し、週間計画に配置できるようにする。
- **Rationale**: 目標と行動の断絶を防ぎ、週次運用の質を高めるため。
- **Alternatives considered**: 目標と無関係のタスク作成 (優先順位が散漫になるため採用しない)

## Decision 5: 主要タブ構成を固定する

- **Decision**: 週間計画、Inbox、目標ゴール、目標→タスク切り出し、演習を基本タブにする。
- **Rationale**: 利用導線を安定させ、学習コストを下げるため。
- **Alternatives considered**: タブの自由追加/削除 (初期体験が不安定になるため採用しない)
