import { ItemView, WorkspaceLeaf } from "obsidian";
import type { InboxItem } from "../models/inbox_item";
import { ActionPlanItem, WeeklyPlan, WeeklyPlanSlot } from "../models/weekly_plan";
import { GoalLevel } from "../models/goal";
import { GoalsService } from "../services/goals_service";
import { WeeklyShared } from "../models/weekly_shared";
import { InboxService } from "../services/inbox_service";
import { MarkdownRepository } from "../services/markdown_repository";
import { TasksService } from "../services/tasks_service";
import { parseWeeklyPlan, serializeWeeklyPlan } from "../services/weekly_plan_io";
import { parseWeeklyShared, serializeWeeklyShared } from "../services/weekly_shared_io";
import { resolveLifePlannerPath, resolveWeeklyPlanPath } from "../storage/path_resolver";
import type LifePlannerPlugin from "../main";
import { attachDeleteMenu, attachRowMenu, enableTapToBlur, registerRowMenuClose } from "./interaction";
import { renderNavigation } from "./navigation";
import { LifePlannerViewType, WEEKLY_PLAN_VIEW_TYPE } from "./view_types";
export { WEEKLY_PLAN_VIEW_TYPE };

const BASE_DAYS = ["月", "火", "水", "木", "金", "土", "日"];
const ROUTINE_DAYS = BASE_DAYS;
const LEVELS: GoalLevel[] = ["人生", "長期", "中期", "年間", "四半期", "月間", "週間"];
const DAY_MS = 24 * 60 * 60 * 1000;

export type WeeklyPlanRenderOptions = {
  showNavigation?: boolean;
  showHeader?: boolean;
  attachMenuClose?: boolean;
  onNavigate?: (viewType: LifePlannerViewType) => void;
  hiddenViewTypes?: LifePlannerViewType[];
};

export class WeeklyPlanRenderer {
  private plugin: LifePlannerPlugin;
  private repository: MarkdownRepository;
  private tasksService: TasksService;
  private inboxService: InboxService;
  private statusEl: HTMLElement | null = null;
  private rootEl: HTMLElement | null = null;
  private viewEl: HTMLElement | null = null;
  private disposeMenuClose: (() => void) | null = null;
  private lastSavedContent = "";
  private loadedPlan: WeeklyPlan | null = null;
  private renderOptions: WeeklyPlanRenderOptions = {};
  private weekLabelInput: HTMLInputElement | null = null;
  private monthThemeInput: HTMLTextAreaElement | null = null;
  private routineRows: {
    titleInput: HTMLInputElement;
    checks: Map<string, HTMLInputElement>;
  }[] = [];
  private roleSections: {
    roleInput: HTMLInputElement;
    goalInputs: HTMLInputElement[];
  }[] = [];
  private actionPlanRows: {
    select: HTMLSelectElement;
    checkbox: HTMLInputElement;
  }[] = [];
  private reflectionGoodInputs: HTMLInputElement[] = [];
  private reflectionIssueInputs: HTMLInputElement[] = [];
  private dayDateLabels: Map<string, HTMLElement> = new Map();
  private dailyMemoCards: Map<string, HTMLElement> = new Map();
  private tweetSaveTimers: Map<string, number> = new Map();
  private saveTimer: number | null = null;
  private weekOffset = 0;
  private weekStart = new Date();
  private currentWeekPath = "";
  private dayOrder: string[] = BASE_DAYS;

  constructor(plugin: LifePlannerPlugin) {
    this.plugin = plugin;
    this.repository = new MarkdownRepository(this.plugin.app);
    this.tasksService = new TasksService(
      new MarkdownRepository(this.plugin.app),
      this.plugin.settings.storageDir,
      this.plugin.settings.defaultTags
    );
    this.inboxService = new InboxService(
      this.repository,
      this.plugin.settings.storageDir,
      this.plugin.settings.defaultTags
    );
  }

  async render(container: HTMLElement, options: WeeklyPlanRenderOptions = {}): Promise<void> {
    this.rootEl = container;
    await this.renderWeek(options);
  }

  async onClose(): Promise<void> {
    this.statusEl = null;
    this.rootEl = null;
    this.viewEl = null;
    this.disposeMenuClose?.();
    this.disposeMenuClose = null;
    this.weekLabelInput = null;
    this.monthThemeInput = null;
    this.routineRows = [];
    this.roleSections = [];
    this.actionPlanRows = [];
    this.reflectionGoodInputs = [];
    this.reflectionIssueInputs = [];
    this.dayDateLabels.clear();
    this.dailyMemoCards.clear();
    this.clearTweetSaveTimers();
    if (this.saveTimer) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  private async renderWeek(options: WeeklyPlanRenderOptions = {}): Promise<void> {
    if (!this.rootEl) {
      return;
    }
    const resolvedOptions = {
      showNavigation: options.showNavigation ?? true,
      showHeader: options.showHeader ?? true,
      attachMenuClose: options.attachMenuClose ?? true,
      onNavigate: options.onNavigate,
      hiddenViewTypes: options.hiddenViewTypes ?? [],
    };
    this.renderOptions = resolvedOptions;
    this.resetViewState();
    this.rootEl.empty();
    const view = this.rootEl.createEl("div", { cls: "lifeplanner-view" });
    this.viewEl = view;
    enableTapToBlur(view);
    if (resolvedOptions.attachMenuClose) {
      this.disposeMenuClose = registerRowMenuClose(view);
    }
    let prevButton: HTMLButtonElement | null = null;
    let todayButton: HTMLButtonElement | null = null;
    let nextButton: HTMLButtonElement | null = null;
    if (resolvedOptions.showHeader) {
      const header = view.createEl("div", { cls: "lifeplanner-weekly-header" });
      header.createEl("h2", { text: "週間計画" });
      const navButtons = header.createEl("div", { cls: "lifeplanner-weekly-nav" });
      prevButton = navButtons.createEl("button", { text: "◀ 前週" });
      todayButton = navButtons.createEl("button", { text: "今日" });
      nextButton = navButtons.createEl("button", { text: "次週 ▶" });
    }

    if (resolvedOptions.showNavigation) {
      const onNavigate = resolvedOptions.onNavigate ?? (() => {});
      renderNavigation(view, WEEKLY_PLAN_VIEW_TYPE, onNavigate, resolvedOptions.hiddenViewTypes);
    }

    this.statusEl = view.createEl("div", { cls: "lifeplanner-weekly-status" });

    this.weekStart = computeWeekStart(new Date(), this.weekOffset, this.plugin.settings.weekStart);
    this.dayOrder = dayOrder(this.plugin.settings.weekStart);
    const plan = await this.loadPlanForWeek(this.weekStart);
    this.renderHeaderMeta(view, plan);
    this.renderMonthTheme(view, plan);
    this.renderRoutineActions(view, plan);
    await this.renderRoles(view, plan);
    await this.renderActionPlans(view, plan);
    await this.renderDailyMemos(view);
    this.renderReflection(view, plan);
    this.updateWeekMeta();

    if (prevButton) {
      prevButton.addEventListener("click", () => {
        void this.changeWeek(-1);
      });
    }
    if (todayButton) {
      todayButton.addEventListener("click", () => {
        void this.resetToToday();
      });
    }
    if (nextButton) {
      nextButton.addEventListener("click", () => {
        void this.changeWeek(1);
      });
    }
  }

  private resetViewState(): void {
    this.weekLabelInput = null;
    this.monthThemeInput = null;
    this.routineRows = [];
    this.roleSections = [];
    this.actionPlanRows = [];
    this.reflectionGoodInputs = [];
    this.reflectionIssueInputs = [];
    this.dayDateLabels.clear();
    this.viewEl = null;
    this.disposeMenuClose?.();
    this.disposeMenuClose = null;
    this.clearTweetSaveTimers();
    if (this.saveTimer) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  private async changeWeek(delta: number): Promise<void> {
    await this.savePlan();
    this.weekOffset += delta;
    await this.renderWeek(this.renderOptions);
  }

  private async resetToToday(): Promise<void> {
    await this.savePlan();
    this.weekOffset = 0;
    await this.renderWeek(this.renderOptions);
  }

  private renderHeaderMeta(container: HTMLElement, plan: WeeklyPlan): void {
    const section = container.createEl("div", { cls: "lifeplanner-weekly-top" });
    const meta = section.createEl("div", { cls: "lifeplanner-weekly-goals" });
    const header = meta.createEl("div", { cls: "lifeplanner-weekly-section-header" });
    header.createEl("h3", { text: "週表示" });
    const weekLabel = header.createEl("input", { type: "text" });
    weekLabel.placeholder = "2026年 1月 第3週";
    weekLabel.value = plan.weekLabel ?? "";
    weekLabel.readOnly = true;
    this.weekLabelInput = weekLabel;
  }

  private renderMonthTheme(container: HTMLElement, plan: WeeklyPlan): void {
    const section = container.createEl("div", {
      cls: "lifeplanner-weekly-section lifeplanner-month-theme",
    });
    const header = section.createEl("div", { cls: "lifeplanner-weekly-section-header" });
    header.createEl("h3", { text: "今月のテーマ" });
    const menuScope = this.viewEl ?? section;
    const body = section.createEl("div", { cls: "lifeplanner-month-theme-body" });
    const display = body.createEl("div", { cls: "lifeplanner-month-theme-display" });
    const input = body.createEl("textarea", { cls: "lifeplanner-month-theme-input" });
    input.placeholder = "今月のテーマ";
    input.rows = 2;
    input.value = plan.monthTheme ?? "";

    const updateDisplay = (): void => {
      const value = input.value.trim();
      display.setText(value || "(未記入)");
      display.classList.toggle("is-empty", value.length === 0);
    };

    const setEditMode = (editing: boolean): void => {
      input.classList.toggle("lifeplanner-hidden", !editing);
      display.classList.toggle("lifeplanner-hidden", editing);
      if (editing) {
        this.autoResize(input);
        input.focus();
      }
    };

    attachRowMenu(header, menuScope, [
      {
        label: "編集",
        onSelect: () => {
          setEditMode(true);
        },
      },
      {
        label: "削除",
        onSelect: () => {
          input.value = "";
          updateDisplay();
          setEditMode(false);
          this.autoResize(input);
          this.scheduleSave();
        },
      },
    ]);

    input.addEventListener("input", () => {
      updateDisplay();
      this.autoResize(input);
      this.scheduleSave();
    });
    input.addEventListener("blur", () => {
      updateDisplay();
      setEditMode(false);
    });

    updateDisplay();
    setEditMode(false);
    this.monthThemeInput = input;
  }

  private renderRoutineActions(container: HTMLElement, plan: WeeklyPlan): void {
    const section = container.createEl("div", { cls: "lifeplanner-weekly-section" });
    const header = section.createEl("div", { cls: "lifeplanner-weekly-section-header" });
    header.createEl("h3", { text: "ルーティン行動" });
    const addButton = header.createEl("button", { text: "追加" });
    const table = section.createEl("div", { cls: "lifeplanner-routine-table" });
    const headerRow = table.createEl("div", { cls: "lifeplanner-routine-row is-header" });
    headerRow.createEl("div", { text: "行動" });
      const routineDays = ROUTINE_DAYS;
    routineDays.forEach((day) => {
      headerRow.createEl("div", { text: day });
    });
    const addRow = (title: string, checks: Record<string, boolean>) => {
      const row = table.createEl("div", { cls: "lifeplanner-routine-row" });
      const titleInput = row.createEl("input", { type: "text" });
      titleInput.value = title;
      titleInput.placeholder = "ルーティン";
      titleInput.addEventListener("input", () => this.scheduleSave());
      const checksMap = new Map<string, HTMLInputElement>();
      routineDays.forEach((day) => {
        const cell = row.createEl("div", { cls: "lifeplanner-routine-day" });
        cell.setAttr("data-day", day);
        const checkbox = cell.createEl("input", { type: "checkbox" });
        checkbox.checked = Boolean(checks[day]);
        checkbox.addEventListener("change", () => this.scheduleSave());
        checksMap.set(day, checkbox);
      });
      const menuScope = this.viewEl ?? row;
      attachDeleteMenu(row, menuScope, () => {
        row.remove();
        this.routineRows = this.routineRows.filter((item) => item.titleInput !== titleInput);
        this.scheduleSave();
      });
      this.routineRows.push({ titleInput, checks: checksMap });
    };
    addButton.addEventListener("click", (event) => {
      event.preventDefault();
      addRow("", {});
      this.scheduleSave();
    });
    if (plan.routineActions.length === 0) {
      addRow("", {});
    } else {
      plan.routineActions.forEach((action) => addRow(action.title, action.checks));
    }
  }

  private async renderRoles(container: HTMLElement, plan: WeeklyPlan): Promise<void> {
    const section = container.createEl("div", { cls: "lifeplanner-weekly-section" });
    const header = section.createEl("div", { cls: "lifeplanner-weekly-section-header" });
    header.createEl("h3", { text: "役割と重点タスク" });
    const addRoleButton = header.createEl("button", { text: "役割を追加" });
    const rolesWrap = section.createEl("div", { cls: "lifeplanner-roles" });
    const shared = await this.loadShared();
    const sharedRoles = shared.roles.length > 0 ? shared.roles : plan.roles.map((role) => role.role);
    const addRole = (roleName: string, goals: string[]) => {
      const roleCard = rolesWrap.createEl("div", { cls: "lifeplanner-role-card" });
      const roleHeader = roleCard.createEl("div", { cls: "lifeplanner-role-header" });
      const roleInput = roleHeader.createEl("input", { type: "text" });
      roleInput.placeholder = "役割名";
      roleInput.value = roleName;
      roleInput.addEventListener("input", () => this.scheduleSave());
      const goalsWrap = roleCard.createEl("div", { cls: "lifeplanner-weekly-list" });
      const actions = roleCard.createEl("div", { cls: "lifeplanner-weekly-list-actions" });
      const addGoalButton = actions.createEl("button", { text: "目標を追加" });
      const goalInputs: HTMLInputElement[] = [];
      const addGoal = (goalValue: string) => {
        const row = goalsWrap.createEl("div", { cls: "lifeplanner-weekly-list-row" });
        const input = row.createEl("input", { type: "text" });
        input.placeholder = "目標";
        input.value = goalValue;
        input.addEventListener("input", () => this.scheduleSave());
        const menuScope = this.viewEl ?? row;
        attachDeleteMenu(row, menuScope, () => {
          row.remove();
          const index = goalInputs.indexOf(input);
          if (index >= 0) {
            goalInputs.splice(index, 1);
          }
          this.scheduleSave();
        });
        goalInputs.push(input);
      };
      addGoalButton.addEventListener("click", (event) => {
        event.preventDefault();
        addGoal("");
        this.scheduleSave();
      });
      const menuScope = this.viewEl ?? roleCard;
      attachDeleteMenu(roleHeader, menuScope, () => {
        roleCard.remove();
        this.roleSections = this.roleSections.filter((item) => item.roleInput !== roleInput);
        this.scheduleSave();
      });
      if (goals.length === 0) {
        addGoal("");
      } else {
        goals.forEach((goal) => addGoal(goal));
      }
      this.roleSections.push({ roleInput, goalInputs });
    };
    addRoleButton.addEventListener("click", (event) => {
      event.preventDefault();
      addRole("新しい役割", []);
      this.scheduleSave();
    });
    if (sharedRoles.length === 0) {
      addRole("役割1", []);
    } else {
      sharedRoles.forEach((roleName) => {
        const planRole = plan.roles.find((role) => role.role === roleName);
        addRole(roleName, planRole?.goals ?? []);
      });
    }
  }

  private async renderActionPlans(container: HTMLElement, plan: WeeklyPlan): Promise<void> {
    const section = container.createEl("div", {
      cls: "lifeplanner-weekly-section lifeplanner-action-plan-section",
    });
    const header = section.createEl("div", { cls: "lifeplanner-weekly-section-header" });
    header.createEl("h3", { text: "アクションプラン" });
    const addButton = header.createEl("button", { text: "追加" });
    section.createEl("div", {
      cls: "lifeplanner-action-plan-hint",
      text: "目標/タスクから選んで週間計画に紐づけます。",
    });
    const list = section.createEl("div", {
      cls: "lifeplanner-weekly-list lifeplanner-action-plan-list",
    });
    const hiddenWrap = section.createEl("div", { cls: "lifeplanner-action-plan-hidden" });
    const hiddenHeader = hiddenWrap.createEl("div", {
      cls: "lifeplanner-action-plan-hidden-header",
    });
    const hiddenToggle = hiddenHeader.createEl("button", { text: "非表示リスト" });
    const hiddenList = hiddenWrap.createEl("div", {
      cls: "lifeplanner-weekly-list lifeplanner-action-plan-list is-hidden",
    });
    this.actionPlanRows = [];

    const tasks = await this.tasksService.listTasks();
    const goalsService = new GoalsService(
      new MarkdownRepository(this.plugin.app),
      this.plugin.settings.storageDir,
      this.plugin.settings.defaultTags
    );
    const goals = await goalsService.listGoals();
    const minLevelIndex = LEVELS.indexOf(this.plugin.settings.actionPlanMinLevel as GoalLevel);
    const goalLevelMap = new Map<string, string>();
    const goalTitleMap = new Map<string, string>();
    goals.forEach((goal) => {
      const levelIndex = LEVELS.indexOf(goal.level);
      if (levelIndex >= minLevelIndex) {
        goalLevelMap.set(goal.id, goal.level);
        goalLevelMap.set(goal.title, goal.level);
      }
      goalTitleMap.set(goal.id, goal.title);
      goalTitleMap.set(goal.title, goal.title);
    });
    const options = tasks
      .filter((task) => {
        const level = goalLevelMap.get(task.goalId);
        if (!level) {
          return true;
        }
        const levelIndex = LEVELS.indexOf(level as GoalLevel);
        return levelIndex >= minLevelIndex;
      })
      .map((task) => {
        const value = `${task.goalId} / ${task.title}`;
        const label = task.title;
        return { value, label };
      });

    let hiddenOpen = false;
    const setHiddenOpen = (open: boolean): void => {
      hiddenOpen = open;
      hiddenList.classList.toggle("is-hidden", !hiddenOpen);
    };

    const updateHiddenCount = (): void => {
      const count = hiddenList.querySelectorAll(".lifeplanner-action-plan-row").length;
      hiddenToggle.setText(`非表示リスト (${count})`);
      hiddenWrap.classList.toggle("is-empty", count === 0);
      if (count === 0) {
        setHiddenOpen(false);
      }
    };

    const moveRow = (row: HTMLElement, done: boolean): void => {
      const target = done ? hiddenList : list;
      if (row.parentElement !== target) {
        target.appendChild(row);
      }
      updateHiddenCount();
    };

    hiddenToggle.addEventListener("click", (event) => {
      event.preventDefault();
      setHiddenOpen(!hiddenOpen);
    });

    const addRow = (value: string, done: boolean) => {
      const row = list.createEl("div", { cls: "lifeplanner-action-plan-row" });
      const checkbox = row.createEl("input", {
        type: "checkbox",
        cls: "lifeplanner-action-plan-checkbox",
      });
      checkbox.checked = done;
      checkbox.addEventListener("change", () => {
        moveRow(row, checkbox.checked);
        this.scheduleSave();
      });
      const select = row.createEl("select", { cls: "lifeplanner-action-plan-select" });
      const placeholder = select.createEl("option", { text: "選択", value: "" });
      placeholder.disabled = true;
      placeholder.selected = !value;
      options.forEach((option) => {
        select.createEl("option", { text: option.label, value: option.value });
      });
      const optionValues = options.map((option) => option.value);
      if (value && !optionValues.includes(value)) {
        const goalId = value.split(" / ")[0];
        const label = value.split(" / ")[1] ?? goalTitleMap.get(goalId) ?? value;
        select.createEl("option", { text: label, value });
      }
      select.value = value;
      select.addEventListener("change", () => this.scheduleSave());
      const menuScope = this.viewEl ?? row;
      attachDeleteMenu(row, menuScope, () => {
        row.remove();
        this.actionPlanRows = this.actionPlanRows.filter((item) => item.select !== select);
        updateHiddenCount();
        this.scheduleSave();
      });
      this.actionPlanRows.push({ select, checkbox });
      moveRow(row, done);
    };

    const actions = section.createEl("div", { cls: "lifeplanner-weekly-list-actions" });
    actions.appendChild(addButton);
    addButton.addEventListener("click", (event) => {
      event.preventDefault();
      addRow("", false);
      this.scheduleSave();
    });
    if (plan.actionPlans.length === 0) {
      addRow("", false);
    } else {
      plan.actionPlans.forEach((item) => addRow(item.title, item.done));
    }
    updateHiddenCount();
  }

  private renderReflection(container: HTMLElement, plan: WeeklyPlan): void {
    const section = container.createEl("div", { cls: "lifeplanner-weekly-section" });
    section.createEl("h3", { text: "今週の振り返り" });
    const grid = section.createEl("div", { cls: "lifeplanner-weekly-reflection" });
    const goodWrap = grid.createEl("div", { cls: "lifeplanner-weekly-reflection-card" });
    goodWrap.createEl("h4", { text: "良かったこと" });
    const goodList = goodWrap.createEl("div", { cls: "lifeplanner-weekly-list" });
    const goodActions = goodWrap.createEl("div", { cls: "lifeplanner-weekly-list-actions" });
    const addGood = goodActions.createEl("button", { text: "追加" });
    const issueWrap = grid.createEl("div", { cls: "lifeplanner-weekly-reflection-card" });
    issueWrap.createEl("h4", { text: "課題" });
    const issueList = issueWrap.createEl("div", { cls: "lifeplanner-weekly-list" });
    const issueActions = issueWrap.createEl("div", { cls: "lifeplanner-weekly-list-actions" });
    const addIssue = issueActions.createEl("button", { text: "追加" });
    addGood.addEventListener("click", (event) => {
      event.preventDefault();
      this.addReflectionItem(goodList, this.reflectionGoodInputs, "振り返り");
      this.scheduleSave();
    });
    addIssue.addEventListener("click", (event) => {
      event.preventDefault();
      this.addReflectionItem(issueList, this.reflectionIssueInputs, "課題");
      this.scheduleSave();
    });
    if (plan.reflectionGood.length === 0) {
      this.addReflectionItem(goodList, this.reflectionGoodInputs, "振り返り");
    } else {
      plan.reflectionGood.forEach((item) =>
        this.addReflectionItem(goodList, this.reflectionGoodInputs, "振り返り", item)
      );
    }
    if (plan.reflectionIssues.length === 0) {
      this.addReflectionItem(issueList, this.reflectionIssueInputs, "課題");
    } else {
      plan.reflectionIssues.forEach((item) =>
        this.addReflectionItem(issueList, this.reflectionIssueInputs, "課題", item)
      );
    }
  }

  private addReflectionItem(
    container: HTMLElement,
    inputs: HTMLInputElement[],
    placeholder: string,
    value = ""
  ): void {
    const row = container.createEl("div", { cls: "lifeplanner-weekly-list-row" });
    const input = row.createEl("input", { type: "text" });
    input.placeholder = placeholder;
    input.value = value;
    input.addEventListener("input", () => this.scheduleSave());
    const menuScope = this.viewEl ?? row;
    attachDeleteMenu(row, menuScope, () => {
      row.remove();
      const index = inputs.indexOf(input);
      if (index >= 0) {
        inputs.splice(index, 1);
      }
      this.scheduleSave();
    });
    inputs.push(input);
  }

  private async renderDailyMemos(container: HTMLElement): Promise<void> {
    const section = container.createEl("div", { cls: "lifeplanner-weekly-section" });
    section.createEl("h3", { text: "日付ごとのメモ" });
    const grid = section.createEl("div", { cls: "lifeplanner-daily-memos" });

    const items = await this.inboxService.listItems();
    const weekStart = new Date(this.weekStart);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const itemsByDay = new Map<string, InboxItem[]>();
    this.dayOrder.forEach((day) => itemsByDay.set(day, []));

    items.forEach((item) => {
      if (typeof item.createdAt !== "number") {
        return;
      }
      const created = new Date(item.createdAt);
      if (created < weekStart || created >= weekEnd) {
        return;
      }
      const diff = Math.floor((startOfDay(created).getTime() - weekStart.getTime()) / DAY_MS);
      const day = this.dayOrder[diff];
      if (!day) {
        return;
      }
      itemsByDay.get(day)?.push(item);
    });

    const buildMemoRow = (list: HTMLElement, item: InboxItem): HTMLElement => {
      const row = list.createEl("div", { cls: "lifeplanner-tweet-row" });
      row.setAttribute("data-created-at", `${item.createdAt ?? 0}`);
      row.createEl("span", {
        cls: "lifeplanner-tweet-time",
        text: formatTime(item.createdAt),
      });
      const input = row.createEl("input", { type: "text", cls: "lifeplanner-tweet-input" });
      input.value = item.content;
      let lastSaved = item.content;
      input.addEventListener("input", () => {
        const nextValue = input.value.trim();
        if (!nextValue || nextValue === lastSaved) {
          return;
        }
        lastSaved = nextValue;
        this.scheduleTweetSave(item.id, nextValue);
      });
      input.addEventListener("blur", () => {
        if (input.value.trim().length === 0) {
          input.value = lastSaved;
          this.setStatus("メモを入力してください");
        }
      });
      const menuScope = this.viewEl ?? row;
      attachDeleteMenu(row, menuScope, () => {
        void this.inboxService.deleteItem(item.id).then(() => {
          row.remove();
          if (list.querySelectorAll(".lifeplanner-tweet-row").length === 0) {
            list.createEl("div", { cls: "lifeplanner-tweet-empty", text: "(未登録)" });
          }
          this.setStatus("削除しました");
        });
      });
      return row;
    };

    const insertMemoRow = (
      list: HTMLElement,
      row: HTMLElement,
      createdAt?: number
    ): void => {
      const value = createdAt ?? 0;
      const rows = Array.from(list.querySelectorAll<HTMLElement>(".lifeplanner-tweet-row"));
      const before = rows.find((existing) => {
        const existingValue = Number(existing.getAttribute("data-created-at") ?? 0);
        return existingValue > value;
      });
      if (before) {
        list.insertBefore(row, before);
      } else {
        list.appendChild(row);
      }
    };

    const clearEmptyState = (list: HTMLElement): void => {
      list.querySelectorAll(".lifeplanner-tweet-empty").forEach((empty) => {
        empty.remove();
      });
    };

    const addMemo = async (
      list: HTMLElement,
      baseDate: Date,
      input: HTMLInputElement
    ): Promise<void> => {
      const content = input.value.trim();
      if (!content) {
        this.setStatus("メモを入力してください");
        input.focus();
        return;
      }
      const now = new Date();
      const created = new Date(baseDate);
      created.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      const item = await this.inboxService.addItem(content, created.getTime());
      input.value = "";
      clearEmptyState(list);
      const row = buildMemoRow(list, item);
      insertMemoRow(list, row, item.createdAt);
      this.setStatus("メモを追加しました");
    };

    this.dayOrder.forEach((day, index) => {
      const card = grid.createEl("div", { cls: "lifeplanner-daily-memo-card" });
      this.dailyMemoCards.set(day, card);
      const header = card.createEl("div", { cls: "lifeplanner-daily-memo-header" });
      header.createEl("h4", { text: day });
      const dateLabel = header.createEl("span", { cls: "lifeplanner-daily-memo-date" });
      this.dayDateLabels.set(day, dateLabel);
      const addRow = card.createEl("div", { cls: "lifeplanner-daily-memo-add" });
      const addInput = addRow.createEl("input", {
        type: "text",
        cls: "lifeplanner-daily-memo-input",
      });
      addInput.placeholder = "メモを追加";
      const addButton = addRow.createEl("button", { text: "追加" });
      addButton.setAttr("type", "button");
      const list = card.createEl("div", { cls: "lifeplanner-weekly-list" });

      const dayItems = itemsByDay.get(day) ?? [];
      if (dayItems.length === 0) {
        list.createEl("div", { cls: "lifeplanner-tweet-empty", text: "(未登録)" });
      }

      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + index);

      const handleAdd = (): void => {
        void addMemo(list, dayDate, addInput);
      };

      addButton.addEventListener("click", (event) => {
        event.preventDefault();
        handleAdd();
      });
      addInput.addEventListener("keydown", (event) => {
        if (event.isComposing || event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        handleAdd();
      });

      dayItems
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
        .forEach((item) => {
          const row = buildMemoRow(list, item);
          insertMemoRow(list, row, item.createdAt);
        });
    });
  }

  private async loadPlanForWeek(weekStart: Date): Promise<WeeklyPlan> {
    const path = resolveWeeklyPlanPath(weekStart, this.plugin.settings.storageDir);
    this.currentWeekPath = path;
    let content = await this.repository.read(path);
    if (!content) {
      const legacyPath = resolveWeeklyPlanPath(weekStart, this.plugin.settings.storageDir, {
        forceMonday: false,
      });
      if (legacyPath !== path) {
        const legacyContent = await this.repository.read(legacyPath);
        if (legacyContent) {
          await this.repository.write(path, legacyContent);
          content = legacyContent;
        }
      }
    }
    if (!content) {
      const emptyPlan = this.buildEmptyPlan();
      const shared = await this.loadShared();
      emptyPlan.weekLabel = formatWeekLabel(weekStart, this.plugin.settings.weekStart);
      emptyPlan.monthTheme = shared.monthThemes[getMonthKey(weekStart)] ?? "";
      emptyPlan.routineActions = shared.routineActions.map((title) => ({
        title,
        checks: {},
      }));
      emptyPlan.roles = shared.roles.map((role) => ({
        role,
        goals: [],
      }));
      const serialized = serializeWeeklyPlan(emptyPlan, this.plugin.settings.defaultTags);
      this.lastSavedContent = serialized;
      await this.repository.write(path, serialized);
      this.loadedPlan = emptyPlan;
      return emptyPlan;
    }
    this.lastSavedContent = content;
    const plan = parseWeeklyPlan(content);
    this.loadedPlan = plan;
    return plan;
  }

  private async loadShared(): Promise<WeeklyShared> {
    const path = resolveLifePlannerPath("Weekly Shared", this.plugin.settings.storageDir);
    const content = await this.repository.read(path);
    if (!content) {
      const emptyShared: WeeklyShared = {
        routineActions: [],
        roles: [],
        monthThemes: {},
      };
      await this.repository.write(
        path,
        serializeWeeklyShared(emptyShared, this.plugin.settings.defaultTags)
      );
      return emptyShared;
    }
    return parseWeeklyShared(content);
  }

  private async saveShared(plan: WeeklyPlan): Promise<void> {
    const shared = await this.loadShared();
    shared.routineActions = plan.routineActions
      .map((action) => action.title.trim())
      .filter((title) => title.length > 0);
    shared.roles = this.roleSections
      .map((role) => role.roleInput.value.trim())
      .filter((value) => value.length > 0);
    shared.monthThemes[getMonthKey(this.weekStart)] = plan.monthTheme ?? "";
    const path = resolveLifePlannerPath("Weekly Shared", this.plugin.settings.storageDir);
    await this.repository.write(
      path,
      serializeWeeklyShared(shared, this.plugin.settings.defaultTags)
    );
  }

  private buildEmptyPlan(): WeeklyPlan {
    const slots: WeeklyPlanSlot[] = BASE_DAYS.map((day) => ({ day, entries: [] }));
    return {
      id: "weekly",
      weekStart: "",
      weekEnd: "",
      weeklyGoals: [],
      weekLabel: "",
      monthTheme: "",
      routineActions: [],
      roles: [],
      actionPlans: [],
      reflectionGood: [],
      reflectionIssues: [],
      dailyMemos: { 月: [], 火: [], 水: [], 木: [], 金: [], 土: [], 日: [] },
      slots,
    };
  }

  private async savePlan(): Promise<void> {
    const plan = this.loadedPlan ? { ...this.loadedPlan } : this.buildEmptyPlan();
    if (!plan.slots || plan.slots.length === 0) {
      plan.slots = BASE_DAYS.map((day) => ({ day, entries: [] }));
    }
    plan.weeklyGoals = [];
    plan.weekLabel = this.weekLabelInput ? this.weekLabelInput.value.trim() : "";
    plan.monthTheme = this.monthThemeInput ? this.monthThemeInput.value.trim() : "";
    plan.routineActions = this.routineRows
      .map((row) => {
        const title = row.titleInput.value.trim();
        const checks: Record<string, boolean> = {};
        row.checks.forEach((checkbox, day) => {
          checks[day] = checkbox.checked;
        });
        return { title, checks };
      })
      .filter((row) => row.title.length > 0);
    plan.roles = this.roleSections
      .map((role) => ({
        role: role.roleInput.value.trim(),
        goals: role.goalInputs
          .map((input) => input.value.trim())
          .filter((value) => value.length > 0),
      }))
      .filter((role) => role.role.length > 0);
    plan.actionPlans = this.actionPlanRows
      .map((row) => ({
        title: row.select.value.trim(),
        done: row.checkbox.checked,
      }))
      .filter((item) => item.title.length > 0);
    plan.reflectionGood = this.reflectionGoodInputs
      .map((input) => input.value.trim())
      .filter((value) => value.length > 0);
    plan.reflectionIssues = this.reflectionIssueInputs
      .map((input) => input.value.trim())
      .filter((value) => value.length > 0);
    for (const day of BASE_DAYS) {
      const slot = plan.slots.find((entry) => entry.day === day);
      if (slot) {
        const dateLabel = this.dayDateLabels.get(day);
        slot.dateLabel = dateLabel ? dateLabel.textContent ?? "" : "";
      }
    }

    const serialized = serializeWeeklyPlan(plan, this.plugin.settings.defaultTags);
    if (serialized === this.lastSavedContent) {
      this.setStatus("変更はありません");
      return;
    }
    await this.repository.write(this.currentWeekPath, serialized);
    this.lastSavedContent = serialized;
    this.loadedPlan = plan;
    await this.saveShared(plan);
    this.setStatus("保存しました");
  }

  private setStatus(message: string): void {
    if (!this.statusEl) {
      return;
    }
    this.statusEl.setText(message);
    window.setTimeout(() => {
      this.statusEl?.setText("");
    }, 2000);
  }

  private scheduleTweetSave(itemId: string, content: string): void {
    const existing = this.tweetSaveTimers.get(itemId);
    if (existing) {
      window.clearTimeout(existing);
    }
    const timer = window.setTimeout(() => {
      void this.inboxService.updateItem(itemId, content).then(() => {
        this.setStatus("保存しました");
      });
      this.tweetSaveTimers.delete(itemId);
    }, 400);
    this.tweetSaveTimers.set(itemId, timer);
  }

  private scheduleSave(): void {
    if (this.saveTimer) {
      window.clearTimeout(this.saveTimer);
    }
    this.saveTimer = window.setTimeout(() => {
      void this.savePlan();
    }, 500);
  }

  private clearTweetSaveTimers(): void {
    this.tweetSaveTimers.forEach((timer) => {
      window.clearTimeout(timer);
    });
    this.tweetSaveTimers.clear();
  }

  private updateWeekMeta(): void {
    this.weekStart = computeWeekStart(new Date(), this.weekOffset, this.plugin.settings.weekStart);
    const weekLabel = formatWeekLabel(this.weekStart, this.plugin.settings.weekStart);
    if (this.weekLabelInput) {
      this.weekLabelInput.value = weekLabel;
    }
    this.dayOrder.forEach((day, index) => {
      const date = new Date(this.weekStart);
      date.setDate(this.weekStart.getDate() + index);
      const label = this.dayDateLabels.get(day);
      if (label) {
        label.setText(formatFullDate(date));
      }
      const card = this.dailyMemoCards.get(day);
      if (card) {
        card.classList.toggle("is-today", isSameDay(date, new Date()));
      }
    });
  }

  private autoResize(textarea: HTMLTextAreaElement): void {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }
}

export class WeeklyPlanView extends ItemView {
  private plugin: LifePlannerPlugin;
  private renderer: WeeklyPlanRenderer;

  constructor(leaf: WorkspaceLeaf, plugin: LifePlannerPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.renderer = new WeeklyPlanRenderer(plugin);
  }

  getViewType(): string {
    return WEEKLY_PLAN_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "週間計画";
  }

  async onOpen(): Promise<void> {
    await this.renderer.render(this.contentEl, {
      showNavigation: true,
      showHeader: true,
      attachMenuClose: true,
      onNavigate: (viewType) => {
        void this.plugin.openViewInLeaf(viewType, this.leaf);
      },
      hiddenViewTypes: this.plugin.settings.hiddenTabs,
    });
  }

  async renderEmbedded(
    container: HTMLElement,
    options: WeeklyPlanRenderOptions = {}
  ): Promise<void> {
    await this.renderer.render(container, {
      showNavigation: options.showNavigation ?? false,
      showHeader: options.showHeader ?? true,
      attachMenuClose: options.attachMenuClose ?? false,
      onNavigate: options.onNavigate,
      hiddenViewTypes: options.hiddenViewTypes,
    });
  }

  async onClose(): Promise<void> {
    await this.renderer.onClose();
  }
}

function computeWeekStart(today: Date, offset: number, weekStart: "monday" | "sunday"): Date {
  const base = new Date(today);
  base.setDate(base.getDate() + offset * 7);
  const day = base.getDay(); // 0 Sun - 6 Sat
  const startIndex = weekStart === "sunday" ? 0 : 1;
  const diff = (day - startIndex + 7) % 7;
  const start = new Date(base);
  start.setDate(base.getDate() - diff);
  return start;
}

function formatWeekLabel(weekStart: Date, weekStartSetting: "monday" | "sunday"): string {
  const year = weekStart.getFullYear();
  const month = weekStart.getMonth() + 1;
  const weekNumber = weekOfMonth(weekStart, weekStartSetting);
  return `${year}年 ${month}月 第${weekNumber}週`;
}

function weekOfMonth(date: Date, weekStartSetting: "monday" | "sunday"): number {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const firstDay = firstOfMonth.getDay();
  const firstWeekStart = new Date(firstOfMonth);
  const startIndex = weekStartSetting === "sunday" ? 0 : 1;
  const offset = (firstDay - startIndex + 7) % 7;
  firstWeekStart.setDate(firstOfMonth.getDate() - offset);
  const diffMs = date.getTime() - firstWeekStart.getTime();
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
}

function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

function formatFullDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}/${month}/${day}`;
}

function formatTime(timestamp?: number): string {
  if (!timestamp) {
    return "--:--";
  }
  const date = new Date(timestamp);
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayOrder(weekStart: "monday" | "sunday"): string[] {
  return weekStart === "sunday"
    ? ["日", "月", "火", "水", "木", "金", "土"]
    : BASE_DAYS;
}
