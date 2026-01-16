---

description: "Task list template for feature implementation"
---

# Tasks: LifePlanner プラグイン

**Input**: Design documents from `/specs/001-lifeplanner-planner/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: The examples below include test tasks. Tests are OPTIONAL - only include them if explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- Paths shown below assume single project - adjust based on plan.md structure

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create plugin folder structure per plan in src/
- [X] T002 [P] Add base plugin entrypoint in src/main.ts
- [X] T003 [P] Add tab scaffolds in src/ui/ for weekly, inbox, goals, task-breakdown, exercises
- [X] T004 [P] Add markdown storage helpers in src/storage/
- [X] T005 [P] Add base templates in src/templates/ for LifePlanner - Weekly.md, LifePlanner - Goals.md, LifePlanner - Tasks.md, LifePlanner - Inbox.md, LifePlanner - Exercises.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Define core data models in src/models/goal.ts, src/models/task.ts, src/models/weekly_plan.ts, src/models/inbox_item.ts, src/models/exercise_note.ts
- [X] T007 Implement markdown repository in src/services/markdown_repository.ts for CRUD across LifePlanner files
- [X] T008 Implement file naming and path resolution in src/storage/path_resolver.ts
- [X] T009 Implement goal-task linkage helpers in src/services/goal_task_linker.ts
- [X] T010 Implement weekly plan parser/serializer in src/services/weekly_plan_io.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 週間計画ダッシュボードでタスクを配置する (Priority: P1) 🎯 MVP

**Goal**: 週間計画タブでタスクを配置し、Markdownへ保存できる

**Independent Test**: 週間計画タブだけでタスク配置と保存が完結する

### Implementation for User Story 1

- [X] T011 [P] [US1] Implement weekly dashboard view in src/ui/weekly_plan_view.ts
- [X] T012 [US1] Implement task placement interactions in src/ui/weekly_plan_view.ts
- [X] T013 [US1] Persist weekly plan to Markdown via src/services/weekly_plan_io.ts
- [X] T014 [US1] Wire weekly plan tab as default in src/main.ts

**Checkpoint**: User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - 目標階層を作成・参照する (Priority: P2)

**Goal**: 目標階層を作成し、構造を確認できる

**Independent Test**: 目標タブのみで階層作成と表示が完結する

### Implementation for User Story 2

- [X] T015 [P] [US2] Implement goals view in src/ui/goals_view.ts
- [X] T016 [US2] Implement goal CRUD in src/services/goals_service.ts
- [X] T017 [US2] Persist goal hierarchy to Markdown via src/services/markdown_repository.ts

**Checkpoint**: User Story 2 should be fully functional and testable independently

---

## Phase 5: User Story 3 - 目標からタスクを切り出す (Priority: P3)

**Goal**: 目標からタスクを切り出し、週間計画へ配置できる

**Independent Test**: 目標→タスク切り出しタブだけでタスク作成が完結する

### Implementation for User Story 3

- [X] T018 [P] [US3] Implement goal-to-task view in src/ui/goal_task_view.ts
- [X] T019 [US3] Implement task creation linked to goals in src/services/tasks_service.ts
- [X] T020 [US3] Persist tasks to Markdown via src/services/markdown_repository.ts
- [X] T021 [US3] Expose created tasks to weekly plan in src/services/weekly_plan_io.ts

**Checkpoint**: User Story 3 should be fully functional and testable independently

---

## Phase 6: User Story 4 - Inboxでメモし、各タブへ振り分ける (Priority: P4)

**Goal**: Inboxメモを追加し、目標・タスク・週間計画へ振り分けできる

**Independent Test**: Inboxタブのみで追加と振り分けが完結する

### Implementation for User Story 4

- [X] T022 [P] [US4] Implement inbox view in src/ui/inbox_view.ts
- [X] T023 [US4] Implement inbox CRUD in src/services/inbox_service.ts
- [X] T024 [US4] Implement triage actions to goals/tasks/weekly in src/services/inbox_triage.ts
- [X] T025 [US4] Persist inbox items to Markdown via src/services/markdown_repository.ts

**Checkpoint**: User Story 4 should be fully functional and testable independently

---

## Phase 7: User Story 5 - 演習タブで自己分析や内省を行う (Priority: P5)

**Goal**: 演習ワークを作成し保存できる

**Independent Test**: 演習タブのみで作成と保存が完結する

### Implementation for User Story 5

- [X] T026 [P] [US5] Implement exercises view in src/ui/exercises_view.ts
- [X] T027 [US5] Implement exercise CRUD in src/services/exercises_service.ts
- [X] T028 [US5] Persist exercise notes to Markdown via src/services/markdown_repository.ts

**Checkpoint**: User Story 5 should be fully functional and testable independently

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T029 [P] Documentation updates in docs/
- [X] T030 Code cleanup and refactoring across src/
- [X] T031 [P] Performance tuning for weekly tab and markdown IO in src/services/
- [X] T032 Security hardening for file operations in src/storage/
- [X] T033 Update memo.md and add impact note if schema changed
- [X] T034 Validate output renders and edits correctly in Obsidian using tests/manual/
- [X] T035 Confirm plugin naming convention and rename templates accordingly
- [X] T036 Run quickstart.md validation in specs/001-lifeplanner-planner/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Depends on User Story 2 for goals
- **User Story 4 (P4)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 5 (P5)**: Can start after Foundational (Phase 2) - No dependencies on other stories

### Within Each User Story

- Models before services
- Services before UI
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- Setup tasks marked [P] can run in parallel
- Foundational tasks can run in parallel after Setup
- User stories can run in parallel after Foundational phase
- UI work for different tabs can run in parallel

---

## Parallel Example: User Story 1

```bash
Task: "Implement weekly dashboard view in src/ui/weekly_plan_view.ts"
Task: "Implement task placement interactions in src/ui/weekly_plan_view.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Add User Story 5 → Test independently → Deploy/Demo
