import {
  DASHBOARD_VIEW_TYPE,
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
import { BUILTIN_TEMPLATE_BY_ID, BUILTIN_TEMPLATE_BY_VIEW } from "../services/section_templates";

export type NavGroupId = "operations" | "foundation";

export type NavItem = {
  label: string;
  viewType: LifePlannerViewType;
};

export type NavGroup = {
  id: NavGroupId;
  label: string;
  items: NavItem[];
};

export type NavTarget =
  | { type: "view"; viewType: LifePlannerViewType }
  | { type: "template"; templateId: string }
  | { type: "exercise"; section: string };

export type NavLayoutChild =
  | { label: string; target: NavTarget }
  | { label: string; items: NavTarget[] };

export type NavLayoutGroup = {
  label: string;
  children: NavLayoutChild[];
};

export type NavLayout = NavLayoutGroup[];

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "operations",
    label: "日常",
    items: [
      { label: "ダッシュボード", viewType: DASHBOARD_VIEW_TYPE },
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

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export const NAV_ITEM_LABELS = new Map(
  NAV_ITEMS.map((item) => [item.viewType, item.label] as const)
);

export function getNavItemLabel(viewType: LifePlannerViewType): string {
  return NAV_ITEM_LABELS.get(viewType) ?? viewType;
}

const LEGACY_DEFAULT_CHILD_LABEL = "メイン";
const getTemplateIdForView = (viewType: LifePlannerViewType): string | null =>
  BUILTIN_TEMPLATE_BY_VIEW.get(viewType) ?? null;

const getTemplateDefaultLabel = (templateId: string): string =>
  BUILTIN_TEMPLATE_BY_ID.get(templateId)?.label ?? templateId;

export function navTargetKey(target: NavTarget): string {
  switch (target.type) {
    case "view":
      return `view::${target.viewType}`;
    case "template":
      return `template::${target.templateId}`;
    case "exercise":
      return `exercise::${target.section}`;
    default:
      return "view::unknown";
  }
}

export function navTargetFromKey(key: string): NavTarget | null {
  const separatorIndex = key.indexOf("::");
  if (separatorIndex <= 0) {
    return null;
  }
  const type = key.slice(0, separatorIndex);
  const value = key.slice(separatorIndex + 2);
  if (!value) {
    return null;
  }
  if (type === "view") {
    return { type: "view", viewType: value as LifePlannerViewType };
  }
  if (type === "template") {
    return { type: "template", templateId: value };
  }
  if (type === "exercise") {
    return { type: "exercise", section: value };
  }
  return null;
}

export function navChildHasItems(
  child: NavLayoutChild
): child is { label: string; items: NavTarget[] } {
  return Array.isArray((child as { items?: NavTarget[] }).items);
}

export function getNavTargetViewType(target: NavTarget): LifePlannerViewType | null {
  if (target.type === "view") {
    return target.viewType;
  }
  if (target.type === "exercise") {
    return EXERCISES_VIEW_TYPE;
  }
  if (target.type === "template") {
    return BUILTIN_TEMPLATE_BY_ID.get(target.templateId)?.viewType ?? null;
  }
  return null;
}

export function getNavTargetLabel(
  target: NavTarget,
  templateLabels?: Map<string, string>
): string {
  switch (target.type) {
    case "view":
      return getNavItemLabel(target.viewType);
    case "template":
      return templateLabels?.get(target.templateId) ?? target.templateId;
    case "exercise":
      return target.section;
    default:
      return "";
  }
}

export function buildDefaultNavLayout(): NavLayout {
  return NAV_GROUPS.map((group) => ({
    label: group.label,
    children: group.items.map((item) => ({
      label: item.label,
      target: (() => {
        const templateId = getTemplateIdForView(item.viewType);
        return templateId
          ? { type: "template", templateId }
          : { type: "view", viewType: item.viewType };
      })(),
    })),
  }));
}

export function normalizeNavLayout(
  layout?: NavLayout,
  options: { keepEmpty?: boolean } = {}
): NavLayout {
  const allowedViews = new Set<LifePlannerViewType>(NAV_ITEMS.map((item) => item.viewType));
  const defaultLayout = buildDefaultNavLayout();
  if (!Array.isArray(layout) || layout.length === 0) {
    return defaultLayout;
  }

  const seenTargets = new Set<string>();
  const normalized: NavLayout = [];

  const normalizeTarget = (value: unknown): NavTarget | null => {
    if (typeof value === "string") {
      if (allowedViews.has(value as LifePlannerViewType)) {
        const viewType = value as LifePlannerViewType;
        const templateId = getTemplateIdForView(viewType);
        return templateId ? { type: "template", templateId } : { type: "view", viewType };
      }
      return null;
    }
    if (!value || typeof value !== "object") {
      return null;
    }
    const candidate = value as Partial<NavTarget> & {
      viewType?: string;
      templateId?: string;
      section?: string;
    };
    if (candidate.type === "view" || typeof candidate.viewType === "string") {
      const viewType = (candidate.viewType ?? "").trim() as LifePlannerViewType;
      if (allowedViews.has(viewType)) {
        const templateId = getTemplateIdForView(viewType);
        return templateId ? { type: "template", templateId } : { type: "view", viewType };
      }
      return null;
    }
    if (candidate.type === "template" || typeof candidate.templateId === "string") {
      const templateId = (candidate.templateId ?? "").trim();
      if (templateId) {
        return { type: "template", templateId };
      }
      return null;
    }
    if (candidate.type === "exercise" || typeof candidate.section === "string") {
      const section = (candidate.section ?? "").trim();
      if (section) {
        return { type: "exercise", section };
      }
      return null;
    }
    return null;
  };

  const registerTarget = (target: NavTarget): boolean => {
    const key = navTargetKey(target);
    if (seenTargets.has(key)) {
      return false;
    }
    seenTargets.add(key);
    return true;
  };

  layout.forEach((group) => {
    const label = (group?.label ?? "").trim();
    if (!label) {
      return;
    }
    const children = Array.isArray(group.children) ? group.children : [];
    const normalizedChildren: NavLayoutChild[] = [];
    children.forEach((child) => {
      if (!child) {
        return;
      }
      const childLabel = String((child as { label?: string }).label ?? "").trim();
      const rawItems = (child as { items?: unknown }).items;
      if (Array.isArray(rawItems)) {
        const itemTargets: NavTarget[] = [];
        rawItems.forEach((item) => {
          const target = normalizeTarget(item);
          if (!target) {
            return;
          }
          if (registerTarget(target)) {
            itemTargets.push(target);
          }
        });
        const isLegacyMain = !childLabel || childLabel === LEGACY_DEFAULT_CHILD_LABEL;
        if (isLegacyMain) {
          itemTargets.forEach((target) => {
            normalizedChildren.push({
              label:
                target.type === "template"
                  ? getTemplateDefaultLabel(target.templateId)
                  : getNavTargetLabel(target),
              target,
            });
          });
          return;
        }
        const labelValue = childLabel || "2階層目";
        if (itemTargets.length > 0 || options.keepEmpty) {
          normalizedChildren.push({ label: labelValue, items: itemTargets });
        }
        return;
      }
      const target = normalizeTarget((child as { target?: unknown }).target ?? child);
      if (target && registerTarget(target)) {
        const labelValue =
          childLabel ||
          (target.type === "template"
            ? getTemplateDefaultLabel(target.templateId)
            : getNavTargetLabel(target));
        normalizedChildren.push({ label: labelValue, target });
        return;
      }
      if (options.keepEmpty && childLabel) {
        normalizedChildren.push({ label: childLabel, items: [] });
      }
    });
    if (normalizedChildren.length > 0 || options.keepEmpty) {
      normalized.push({ label, children: normalizedChildren });
    }
  });

  if (normalized.length === 0) {
    return defaultLayout;
  }
  return normalized;
}

export type NavigationExtras = {
  templateLabels?: Map<string, string>;
  activeExerciseSection?: string;
  enabledTemplates?: string[];
  activeTemplateId?: string;
};

const lastVisitedByGroup: Partial<Record<string, string>> = {};
const lastVisitedByChild: Partial<Record<string, string>> = {};

export function renderNavigation(
  container: HTMLElement,
  activeViewType: LifePlannerViewType,
  onNavigate: (target: NavTarget) => void,
  hiddenViewTypes: LifePlannerViewType[] = [],
  navLayout?: NavLayout,
  extras: NavigationExtras = {}
): void {
  const hiddenSet = new Set(hiddenViewTypes);
  const nav = container.createEl("div", { cls: "lifeplanner-nav" });
  const layout = normalizeNavLayout(navLayout);
  const templateLabels = extras.templateLabels;
  const viewKey = navTargetKey({ type: "view", viewType: activeViewType });
  const detailKey = extras.activeExerciseSection
    ? navTargetKey({ type: "exercise", section: extras.activeExerciseSection })
    : null;
  const templateKey = extras.activeTemplateId
    ? navTargetKey({ type: "template", templateId: extras.activeTemplateId })
    : null;
  const activeKeys = [detailKey, templateKey, viewKey].filter(
    (key): key is string => Boolean(key)
  );

  const isTargetVisible = (target: NavTarget): boolean => {
    const viewType = getNavTargetViewType(target);
    if (viewType && hiddenSet.has(viewType) && viewType !== activeViewType) {
      return false;
    }
    return true;
  };

  const childTargets = (child: NavLayoutChild): NavTarget[] =>
    navChildHasItems(child) ? child.items : [child.target];

  const groupTargets = (group: NavLayoutGroup): NavTarget[] =>
    group.children.flatMap((child) => childTargets(child));

  const hasTargetKey = (targets: NavTarget[], key: string): boolean =>
    targets.some((target) => navTargetKey(target) === key);

  const groupHasKey = (group: NavLayoutGroup, key: string): boolean =>
    group.children.some((child) => hasTargetKey(childTargets(child), key));

  const findTargetByKey = (targets: NavTarget[], key?: string): NavTarget | null => {
    if (!key) {
      return null;
    }
    return targets.find((target) => navTargetKey(target) === key) ?? null;
  };

  const visibleGroups = layout
    .map((group) => {
      const children = group.children.flatMap((child) => {
        if (navChildHasItems(child)) {
          const items = child.items.filter((target) => isTargetVisible(target));
          if (items.length === 0) {
            return [];
          }
          return [{ ...child, items }];
        }
        if (!isTargetVisible(child.target)) {
          return [];
        }
        return [child];
      });
      return { ...group, children };
    })
    .filter((group) => group.children.length > 0);

  const activeGroup =
    visibleGroups.find((group) => activeKeys.some((key) => groupHasKey(group, key))) ??
    visibleGroups[0];

  if (!activeGroup) {
    return;
  }

  const activeKey = activeKeys.find((key) => groupHasKey(activeGroup, key)) ?? viewKey;

  const activeChild =
    activeGroup.children.find((child) => hasTargetKey(childTargets(child), activeKey)) ??
    activeGroup.children[0];
  if (!activeChild) {
    return;
  }
  lastVisitedByGroup[activeGroup.label] = activeKey;
  lastVisitedByChild[`${activeGroup.label}::${activeChild.label}`] = activeKey;

  const groupRow = nav.createEl("div", { cls: "lifeplanner-nav-groups" });
  visibleGroups.forEach((group) => {
    const button = groupRow.createEl("button", {
      text: group.label,
      cls: "lifeplanner-nav-group",
    });
    button.setAttr("type", "button");
    if (group === activeGroup) {
      button.classList.add("is-active");
      button.setAttr("aria-current", "page");
    }
    button.addEventListener("click", () => {
      const last = lastVisitedByGroup[group.label];
      const targets = groupTargets(group);
      const fallbackTarget: NavTarget = { type: "view", viewType: activeViewType };
      const target = findTargetByKey(targets, last) ?? targets[0] ?? fallbackTarget;
      onNavigate(target);
    });
  });

  const childRow = nav.createEl("div", { cls: "lifeplanner-nav-children" });
  activeGroup.children.forEach((child) => {
    const button = childRow.createEl("button", {
      text: child.label,
      cls: "lifeplanner-nav-child",
    });
    button.setAttr("type", "button");
    if (child === activeChild) {
      button.classList.add("is-active");
      button.setAttr("aria-current", "page");
    }
    button.addEventListener("click", () => {
      if (navChildHasItems(child)) {
        const key = `${activeGroup.label}::${child.label}`;
        const last = lastVisitedByChild[key];
        const fallbackTarget: NavTarget = { type: "view", viewType: activeViewType };
        const target = findTargetByKey(child.items, last) ?? child.items[0] ?? fallbackTarget;
        onNavigate(target);
        return;
      }
      onNavigate(child.target);
    });
  });

  const shouldHideTabs =
    navChildHasItems(activeChild) &&
    activeViewType === EXERCISES_VIEW_TYPE &&
    activeChild.items.length > 0 &&
    activeChild.items.every((target) => target.type === "exercise");

  if (navChildHasItems(activeChild) && !shouldHideTabs) {
    nav.classList.add("has-tabs");
    const activeTabKey = hasTargetKey(activeChild.items, activeKey)
      ? activeKey
      : hasTargetKey(activeChild.items, viewKey)
        ? viewKey
        : null;
    const tabRow = nav.createEl("div", { cls: "lifeplanner-nav-tabs" });
    activeChild.items.forEach((target) => {
      const label = getNavTargetLabel(target, templateLabels);
      const button = tabRow.createEl("button", {
        text: label,
        cls: "lifeplanner-nav-tab",
      });
      button.setAttr("type", "button");
      const key = navTargetKey(target);
      if (activeTabKey && key === activeTabKey) {
        button.classList.add("is-active");
        button.setAttr("aria-current", "page");
      }
      button.addEventListener("click", () => onNavigate(target));
    });
  }
}
