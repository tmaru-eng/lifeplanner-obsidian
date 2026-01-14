# Implementation Plan: LifePlanner プラグイン

**Branch**: `001-lifeplanner-planner` | **Date**: 2026-01-07 | **Spec**: `/Users/ctake3/Documents/pProgram/7habbits for Obsidian/specs/001-lifeplanner-planner/spec.md`
**Input**: Feature specification from `/specs/001-lifeplanner-planner/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

LifePlannerの週間計画ダッシュボードを中心に、Inbox、目標階層、目標→タスク分解、
演習タブを備えたObsidianプラグインを作成する。Markdownのみでデータを保持し、
目標由来タスクを週間計画に配置できることを最優先の価値とする。

## Technical Context

**Language/Version**: TypeScript (Obsidianプラグイン標準)  
**Primary Dependencies**: Obsidian Plugin API  
**Storage**: Obsidian Vault内のMarkdownファイル  
**Testing**: 手動QA + サンプルVaultでの再現テスト  
**Target Platform**: Obsidian Desktop (macOS/Windows/Linux)  
**Project Type**: single (Obsidian plugin)  
**Performance Goals**: 週間タブ切替・保存操作が体感的に即時であること  
**Constraints**: Markdownのみ、UTF-8 + LF、プラグイン経由操作が原則  
**Scale/Scope**: 単一ユーザー、数百ノート規模の個人運用

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Markdown統一とプラグイン優先連携: Markdownのみ、UTF-8 + LF、操作はプラグイン経由
- スキーマ進化優先: 互換性不要、変更時は意図と影響を明記
- 目標階層の一貫性: 人生→長期→中期→年→四半期→月→週の構造を統一
- 目標分解とタスク配置: 目標からタスクを生成し、週間計画へ配置できる
- シンプルさと集中: 新規項目の追加理由と代替削減がある

**Post-Design Check**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/001-lifeplanner-planner/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── main.ts
├── ui/
├── models/
├── services/
├── storage/
├── templates/
└── commands/

tests/
└── manual/
```

**Structure Decision**: Obsidianプラグインとして単一プロジェクト構成を採用し、
UI/データ/ストレージを分離して拡張性を確保する。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
