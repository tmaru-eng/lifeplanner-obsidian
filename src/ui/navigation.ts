import {
  EXERCISES_VIEW_TYPE,
  GOAL_TASK_VIEW_TYPE,
  GOALS_VIEW_TYPE,
  HAVE_DO_BE_VIEW_TYPE,
  INBOX_VIEW_TYPE,
  ISSUES_VIEW_TYPE,
  MISSION_VIEW_TYPE,
  PROMISE_VIEW_TYPE,
  VALUES_VIEW_TYPE,
  WEEKLY_PLAN_VIEW_TYPE,
} from "./view_types";

export type LifePlannerViewType =
  | typeof WEEKLY_PLAN_VIEW_TYPE
  | typeof INBOX_VIEW_TYPE
  | typeof MISSION_VIEW_TYPE
  | typeof VALUES_VIEW_TYPE
  | typeof HAVE_DO_BE_VIEW_TYPE
  | typeof PROMISE_VIEW_TYPE
  | typeof GOALS_VIEW_TYPE
  | typeof GOAL_TASK_VIEW_TYPE
  | typeof EXERCISES_VIEW_TYPE
  | typeof ISSUES_VIEW_TYPE;

const NAV_ITEMS: { label: string; viewType: LifePlannerViewType }[] = [
  { label: "週間計画", viewType: WEEKLY_PLAN_VIEW_TYPE },
  { label: "アクションプラン", viewType: GOAL_TASK_VIEW_TYPE },
  { label: "イシュー", viewType: ISSUES_VIEW_TYPE },
  { label: "Inbox", viewType: INBOX_VIEW_TYPE },
  { label: "目標", viewType: GOALS_VIEW_TYPE },
  { label: "ミッション", viewType: MISSION_VIEW_TYPE },
  { label: "価値観", viewType: VALUES_VIEW_TYPE },
  { label: "Have/Do/Be", viewType: HAVE_DO_BE_VIEW_TYPE },
  { label: "約束", viewType: PROMISE_VIEW_TYPE },
  { label: "演習", viewType: EXERCISES_VIEW_TYPE },
];

export function renderNavigation(
  container: HTMLElement,
  onNavigate: (viewType: LifePlannerViewType) => void
): void {
  const nav = container.createEl("div", { cls: "lifeplanner-nav" });
  for (const item of NAV_ITEMS) {
    const button = nav.createEl("button", { text: item.label });
    button.addEventListener("click", () => onNavigate(item.viewType));
  }
}
