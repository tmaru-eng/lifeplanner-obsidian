# Feature Specification: LifePlanner プラグイン

**Feature Branch**: `001-lifeplanner-planner`  
**Created**: 2026-01-07  
**Status**: Draft  
**Input**: User description: "LifePlanner for Obsidian plugin that manages Franklin-planner style notes in Markdown with tabs for weekly plan, Inbox, goal hierarchy, goal-to-task breakdown, and exercises; weekly plan dashboard with task placement from goals; plugin-first workflow."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 週間計画ダッシュボードでタスクを配置する (Priority: P1)

ユーザーはプラグインを開くと今週の週間計画タブが表示され、目標から切り出した
タスクを今週の枠に配置して、週次計画を完成させたい。

**Why this priority**: 週次運用が中心であり、最初に価値を感じる体験だから。

**Independent Test**: 週次計画タブだけを使って、タスク配置が完結し、週の計画が
作成できる。

**Acceptance Scenarios**:

1. **Given** 目標とタスクが存在する状態で、**When** 週間計画タブを開く、**Then**
   今週の週次枠が表示され、タスクを配置できる。
2. **Given** タスクを今週に配置した状態で、**When** 保存する、**Then**
   週間計画の内容がMarkdownに反映される。

---

### User Story 2 - 目標階層を作成・参照する (Priority: P2)

ユーザーは人生目標から週間目標までの階層を作成し、関連性を確認しながら
全体像を把握したい。

**Why this priority**: 目標→行動の一貫性を保つための基盤だから。

**Independent Test**: 目標タブのみで目標階層を作成し、階層表示が確認できる。

**Acceptance Scenarios**:

1. **Given** 目標が未登録の状態で、**When** 目標ゴールタブで新規目標を追加する、
   **Then** 人生/長期/中期/年間/四半期/月間/週間の階層に紐づいて保存される。

---

### User Story 3 - 目標からタスクを切り出す (Priority: P3)

ユーザーは目標ゴールタブで作成した目標から具体的なタスクを生成し、週間計画に
落とし込みたい。

**Why this priority**: 目標とタスクの断絶を防ぎ、行動に変換するため。

**Independent Test**: 目標→タスク切り出しタブだけでタスクを作成できる。

**Acceptance Scenarios**:

1. **Given** 目標が存在する状態で、**When** 目標→タスク切り出しタブでタスクを
   作成する、**Then** タスクが目標に紐づいて保存される。
2. **Given** 目標に紐づいたタスクがある状態で、**When** 週間計画タブへ移動する、
   **Then** そのタスクを今週に配置できる。

---

### User Story 4 - Inboxでメモし、各タブへ振り分ける (Priority: P4)

ユーザーは思いついた内容をInboxにメモし、目標やタスク、週間計画へ
すばやく振り分けたい。

**Why this priority**: 捕捉漏れを防ぎ、運用の入口を一本化するため。

**Independent Test**: Inboxタブのみでメモを追加し、目標/タスク/週間計画への
振り分けができる。

**Acceptance Scenarios**:

1. **Given** Inboxが空の状態で、**When** メモを追加する、**Then**
   Inbox一覧に表示される。
2. **Given** Inboxにメモがある状態で、**When** 目標またはタスクへ振り分ける、
   **Then** 目的のタブに移動した項目が反映される。

---

### User Story 5 - 演習タブで自己分析や内省を行う (Priority: P5)

ユーザーは演習タブで自己分析や価値観の整理などのワークを進めたい。

**Why this priority**: 目標の質を高める補助機能として必要だから。

**Independent Test**: 演習タブだけで新規ワークを作成し保存できる。

**Acceptance Scenarios**:

1. **Given** 演習が未作成の状態で、**When** 演習タブで新規ワークを作成する、
   **Then** Markdownとして保存され、一覧に表示される。

---

### Edge Cases

- 目標が未設定の状態でタスクを作成しようとした場合はどうするか？
- 週間計画にタスクを置かない週をどう扱うか？
- Inboxに記録したメモが振り分け先に該当しない場合はどう扱うか？
- 直接ファイル編集で項目名や構造が変わった場合にどう扱うか？

## Template/Schema Impact *(mandatory when schema changes)*

- **Affected refills**: Weekly plan, Inbox, Goals, Goal-to-Task, Exercises
- **Field changes**: 新規Markdownテンプレートの設計と項目定義
- **Impact note**: 既存運用との互換性は不要であり、最適な構造へ再設計する
- **Obsidian validation**: 各タブで作成したMarkdownをObsidianで開き、表示と編集を確認
- **Label language**: 日本語ラベルを採用する
- **File naming**: `LifePlanner - <Type>.md` に統一する
- **Markdown-only**: すべてMarkdownで出力する

## Assumptions

- 単一ユーザーの個人運用を前提とする。
- 目標階層は固定の7階層(人生/長期/中期/年間/四半期/月間/週間)とする。
- 演習タブは自由記述のワークを保存する場として扱う。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: システム MUST 週間計画タブを起動時の既定画面として表示する。
- **FR-002**: システム MUST 週間計画でタスクを配置し、保存内容をMarkdownに反映する。
- **FR-003**: システム MUST 目標階層(人生/長期/中期/年間/四半期/月間/週間)を
  作成・編集・参照できる。
- **FR-004**: システム MUST 目標からタスクを切り出し、目標とタスクの紐付けを保持する。
- **FR-005**: システム MUST 週間計画に目標由来のタスクを配置できる。
- **FR-006**: システム MUST Inboxでメモを追加し、目標/タスク/週間計画へ振り分けできる。
- **FR-007**: システム MUST 演習タブでワークを作成し、Markdownとして保存する。
- **FR-008**: システム MUST `LifePlanner - <Type>.md` の命名規則で保存する。
- **FR-009**: システム MUST Markdownのみでデータを管理し、UTF-8 + LFで保存する。
- **FR-010**: ユーザーが直接ファイル編集した内容を、次回表示時に反映できる。

### Key Entities *(include if feature involves data)*

- **Goal**: 目標。階層レベル、名称、期間、上位/下位の関連を持つ。
- **Task**: タスク。関連Goal、週次配置先、状態を持つ。
- **WeeklyPlan**: 週間計画。週の範囲と配置済みタスクの一覧を持つ。
- **InboxItem**: Inboxのメモ。内容と振り分け先を持つ。
- **ExerciseNote**: 演習ワーク。タイトルと本文を持つ。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 新規ユーザーが初回の週間計画を10分以内に作成できる。
- **SC-002**: 週間計画に配置されるタスクの80%以上が目標に紐づく。
- **SC-003**: Inboxに入力した項目の90%以上が24時間以内に振り分けられる。
- **SC-004**: 目標階層の全体像を3分以内に把握できたと回答するユーザーが80%以上。
