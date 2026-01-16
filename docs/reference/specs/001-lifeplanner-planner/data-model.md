# Data Model: LifePlanner プラグイン

## Entities

### Goal

- **Fields**
  - id
  - title
  - level (人生/長期/中期/年間/四半期/月間/週間)
  - description
  - timeframe (start, end)
  - parent_goal_id (nullable)
  - status (active/paused/completed)
- **Relationships**
  - Goal has many sub-goals
  - Goal has many Tasks
- **Validation Rules**
  - level MUST be one of the 7 defined hierarchy levels
  - parent_goal_id MUST reference a higher-level goal

### Task

- **Fields**
  - id
  - title
  - goal_id
  - status (todo/doing/done)
  - weekly_slot (nullable)
  - notes
- **Relationships**
  - Task belongs to Goal
  - Task may be placed in WeeklyPlan
- **Validation Rules**
  - goal_id MUST reference an existing Goal

### WeeklyPlan

- **Fields**
  - id
  - week_start
  - week_end
  - slots (list of task references by day/time)
  - review_notes
- **Relationships**
  - WeeklyPlan has many Tasks
- **Validation Rules**
  - week_start <= week_end

### InboxItem

- **Fields**
  - id
  - content
  - tags
  - destination (goal/task/weekly/none)
  - status (new/triaged)
- **Relationships**
  - InboxItem may be converted to Goal or Task
- **Validation Rules**
  - destination MUST be one of goal/task/weekly/none

### ExerciseNote

- **Fields**
  - id
  - title
  - body
  - created_at
- **Relationships**
  - None
- **Validation Rules**
  - title MUST be present

## State Transitions

- Task: todo → doing → done
- InboxItem: new → triaged
- Goal: active → paused → completed
