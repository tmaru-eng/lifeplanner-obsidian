import {
  EXERCISES_VIEW_TYPE,
  GOAL_TASK_VIEW_TYPE,
  GOALS_VIEW_TYPE,
  HAVE_DO_BE_VIEW_TYPE,
  INBOX_VIEW_TYPE,
  ISSUES_VIEW_TYPE,
  LifePlannerViewType,
  MISSION_VIEW_TYPE,
  PROMISE_VIEW_TYPE,
  VALUES_VIEW_TYPE,
  WEEKLY_PLAN_VIEW_TYPE,
} from "./view_types";

type NavGroupId = "operations" | "foundation";

type NavItem = {
  label: string;
  viewType: LifePlannerViewType;
};

type NavGroup = {
  id: NavGroupId;
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "operations",
    label: "日常",
    items: [
      { label: "週間計画", viewType: WEEKLY_PLAN_VIEW_TYPE },
      { label: "Inbox", viewType: INBOX_VIEW_TYPE },
      { label: "アクションプラン", viewType: GOAL_TASK_VIEW_TYPE },
      { label: "イシュー", viewType: ISSUES_VIEW_TYPE },
      { label: "目標", viewType: GOALS_VIEW_TYPE },
      { label: "約束", viewType: PROMISE_VIEW_TYPE },
    ],
  },
  {
    id: "foundation",
    label: "内省",
    items: [
      { label: "ミッション", viewType: MISSION_VIEW_TYPE },
      { label: "価値観", viewType: VALUES_VIEW_TYPE },
      { label: "Have/Do/Be", viewType: HAVE_DO_BE_VIEW_TYPE },
      { label: "演習", viewType: EXERCISES_VIEW_TYPE },
    ],
  },
];

const VIEW_GROUP_MAP = new Map<LifePlannerViewType, NavGroupId>();
NAV_GROUPS.forEach((group) => {
  group.items.forEach((item) => {
    VIEW_GROUP_MAP.set(item.viewType, group.id);
  });
});

const lastVisitedByGroup: Partial<Record<NavGroupId, LifePlannerViewType>> = {};

function resolveGroup(viewType: LifePlannerViewType): NavGroup {
  const groupId = VIEW_GROUP_MAP.get(viewType);
  return NAV_GROUPS.find((group) => group.id === groupId) ?? NAV_GROUPS[0];
}

export function renderNavigation(
  container: HTMLElement,
  activeViewType: LifePlannerViewType,
  onNavigate: (viewType: LifePlannerViewType) => void
): void {
  const nav = container.createEl("div", { cls: "lifeplanner-nav" });
  const activeGroup = resolveGroup(activeViewType);
  lastVisitedByGroup[activeGroup.id] = activeViewType;

  const groupRow = nav.createEl("div", { cls: "lifeplanner-nav-groups" });
  NAV_GROUPS.forEach((group) => {
    const button = groupRow.createEl("button", {
      text: group.label,
      cls: "lifeplanner-nav-group",
    });
    button.setAttr("type", "button");
    if (group.id === activeGroup.id) {
      button.classList.add("is-active");
      button.setAttr("aria-current", "page");
    }
    button.addEventListener("click", () => {
      const target = lastVisitedByGroup[group.id] ?? group.items[0]?.viewType ?? activeViewType;
      onNavigate(target);
    });
  });

  const tabRow = nav.createEl("div", { cls: "lifeplanner-nav-tabs" });
  activeGroup.items.forEach((item) => {
    const button = tabRow.createEl("button", {
      text: item.label,
      cls: "lifeplanner-nav-tab",
    });
    button.setAttr("type", "button");
    if (item.viewType === activeViewType) {
      button.classList.add("is-active");
      button.setAttr("aria-current", "page");
    }
    button.addEventListener("click", () => onNavigate(item.viewType));
  });
}
