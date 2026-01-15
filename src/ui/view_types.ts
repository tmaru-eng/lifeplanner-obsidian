export const WEEKLY_PLAN_VIEW_TYPE = "lifeplanner-weekly-plan";
export const INBOX_VIEW_TYPE = "lifeplanner-inbox";
export const GOALS_VIEW_TYPE = "lifeplanner-goals";
export const GOAL_TASK_VIEW_TYPE = "lifeplanner-goal-task";
export const EXERCISES_VIEW_TYPE = "lifeplanner-exercises";
export const ISSUES_VIEW_TYPE = "lifeplanner-issues";
export const MISSION_VIEW_TYPE = "lifeplanner-mission";
export const HAVE_DO_BE_VIEW_TYPE = "lifeplanner-have-do-be";
export const PROMISE_VIEW_TYPE = "lifeplanner-promise";
export const VALUES_VIEW_TYPE = "lifeplanner-values";

export type LifePlannerViewType =
  | typeof WEEKLY_PLAN_VIEW_TYPE
  | typeof INBOX_VIEW_TYPE
  | typeof GOALS_VIEW_TYPE
  | typeof GOAL_TASK_VIEW_TYPE
  | typeof EXERCISES_VIEW_TYPE
  | typeof ISSUES_VIEW_TYPE
  | typeof MISSION_VIEW_TYPE
  | typeof VALUES_VIEW_TYPE
  | typeof HAVE_DO_BE_VIEW_TYPE
  | typeof PROMISE_VIEW_TYPE;
