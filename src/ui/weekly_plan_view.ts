import { ItemView, WorkspaceLeaf } from "obsidian";
import { ActionPlanItem, WeeklyPlan, WeeklyPlanSlot } from "../models/weekly_plan";
import { GoalLevel } from "../models/goal";
import { GoalsService } from "../services/goals_service";
import { WeeklyShared } from "../models/weekly_shared";
import { MarkdownRepository } from "../services/markdown_repository";
import { TasksService } from "../services/tasks_service";
import { parseWeeklyPlan, serializeWeeklyPlan } from "../services/weekly_plan_io";
import { parseWeeklyShared, serializeWeeklyShared } from "../services/weekly_shared_io";
import { resolveLifePlannerPath, resolveWeeklyPlanPath } from "../storage/path_resolver";
import type LifePlannerPlugin from "../main";
import { renderNavigation } from "./navigation";
import { WEEKLY_PLAN_VIEW_TYPE } from "./view_types";
export { WEEKLY_PLAN_VIEW_TYPE };

const BASE_DAYS = ["月", "火", "水", "木", "金", "土", "日"];
const ROUTINE_DAYS = ["月", "火", "水", "木", "金", "土"];
const LEVELS: GoalLevel[] = ["人生", "長期", "中期", "年間", "四半期", "月間", "週間"];

export class WeeklyPlanView extends ItemView {
  private plugin: LifePlannerPlugin;
  private repository: MarkdownRepository;
  private tasksService: TasksService;
  private statusEl: HTMLElement | null = null;
  private rootEl: HTMLElement | null = null;
  private lastSavedContent = "";
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
  private memoInputs: Map<string, HTMLInputElement[]> = new Map();
  private dayDateLabels: Map<string, HTMLElement> = new Map();
  private dailyMemoCards: Map<string, HTMLElement> = new Map();
  private saveTimer: number | null = null;
  private weekOffset = 0;
  private weekStart = new Date();
  private currentWeekPath = "";
  private dayOrder: string[] = BASE_DAYS;

  constructor(leaf: WorkspaceLeaf, plugin: LifePlannerPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.repository = new MarkdownRepository(this.plugin.app);
    this.tasksService = new TasksService(
      new MarkdownRepository(this.plugin.app),
      this.plugin.settings.storageDir
    );
  }

  getViewType(): string {
    return WEEKLY_PLAN_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "週間計画";
  }

  async onOpen(): Promise<void> {
    this.rootEl = this.contentEl;
    await this.renderWeek();
  }

  async onClose(): Promise<void> {
    this.statusEl = null;
    this.rootEl = null;
    this.weekLabelInput = null;
    this.monthThemeInput = null;
    this.routineRows = [];
    this.roleSections = [];
    this.actionPlanRows = [];
    this.reflectionGoodInputs = [];
    this.reflectionIssueInputs = [];
    this.memoInputs.clear();
    this.dayDateLabels.clear();
    this.dailyMemoCards.clear();
    if (this.saveTimer) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  private async renderWeek(): Promise<void> {
    if (!this.rootEl) {
      return;
    }
    this.resetViewState();
    this.rootEl.empty();
    const view = this.rootEl.createEl("div", { cls: "lifeplanner-view" });
    const header = view.createEl("div", { cls: "lifeplanner-weekly-header" });
    header.createEl("h2", { text: "週間計画" });
    const navButtons = header.createEl("div", { cls: "lifeplanner-weekly-nav" });
    const prevButton = navButtons.createEl("button", { text: "◀ 前週" });
    const todayButton = navButtons.createEl("button", { text: "今日" });
    const nextButton = navButtons.createEl("button", { text: "次週 ▶" });

    this.statusEl = view.createEl("div", { cls: "lifeplanner-weekly-status" });

    renderNavigation(view, (viewType) => {
      void this.plugin.openViewInLeaf(viewType, this.leaf);
    });

    this.weekStart = computeWeekStart(new Date(), this.weekOffset, this.plugin.settings.weekStart);
    this.dayOrder = dayOrder(this.plugin.settings.weekStart);
    const plan = await this.loadPlanForWeek(this.weekStart);
    this.renderHeaderMeta(view, plan);
    this.renderMonthTheme(view, plan);
    this.renderRoutineActions(view, plan);
    await this.renderRoles(view, plan);
    await this.renderActionPlans(view, plan);
    this.renderReflection(view, plan);
    this.renderDailyMemos(view, plan);
    this.updateWeekMeta();

    prevButton.addEventListener("click", () => {
      void this.changeWeek(-1);
    });
    todayButton.addEventListener("click", () => {
      void this.resetToToday();
    });
    nextButton.addEventListener("click", () => {
      void this.changeWeek(1);
    });
  }

  private resetViewState(): void {
    this.weekLabelInput = null;
    this.monthThemeInput = null;
    this.routineRows = [];
    this.roleSections = [];
    this.actionPlanRows = [];
    this.reflectionGoodInputs = [];
    this.reflectionIssueInputs = [];
    this.memoInputs.clear();
    this.dayDateLabels.clear();
    if (this.saveTimer) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  private async changeWeek(delta: number): Promise<void> {
    await this.savePlan();
    this.weekOffset += delta;
    await this.renderWeek();
  }

  private async resetToToday(): Promise<void> {
    await this.savePlan();
    this.weekOffset = 0;
    await this.renderWeek();
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
    const section = container.createEl("div", { cls: "lifeplanner-weekly-section" });
    section.createEl("h3", { text: "今月のテーマ" });
    const input = section.createEl("textarea");
    input.placeholder = "今月のテーマ";
    input.rows = 2;
    input.value = plan.monthTheme ?? "";
    input.addEventListener("input", () => {
      this.autoResize(input);
      this.scheduleSave();
    });
    this.autoResize(input);
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
        const cell = row.createEl("div");
        const checkbox = cell.createEl("input", { type: "checkbox" });
        checkbox.checked = Boolean(checks[day]);
        checkbox.addEventListener("change", () => this.scheduleSave());
        checksMap.set(day, checkbox);
      });
      const remove = row.createEl("button", { text: "×" });
      remove.addEventListener("click", (event) => {
        event.preventDefault();
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
      const removeRole = roleHeader.createEl("button", { text: "×" });
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
        const remove = row.createEl("button", { text: "×" });
        remove.addEventListener("click", (event) => {
          event.preventDefault();
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
      removeRole.addEventListener("click", (event) => {
        event.preventDefault();
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
    const list = section.createEl("div", { cls: "lifeplanner-weekly-list lifeplanner-action-plan-list" });
    this.actionPlanRows = [];

    const tasks = await this.tasksService.listTasks();
    const goalsService = new GoalsService(
      new MarkdownRepository(this.plugin.app),
      this.plugin.settings.storageDir
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
        const level = goalLevelMap.get(task.goalId);
        const goalTitle = goalTitleMap.get(task.goalId) ?? task.goalId;
        const value = `${task.goalId} / ${task.title}`;
        const label = level ? `【${level}】${goalTitle} / ${task.title}` : `${goalTitle} / ${task.title}`;
        return { value, label };
      });

    const addRow = (value: string, done: boolean) => {
      const row = list.createEl("div", { cls: "lifeplanner-action-plan-row" });
      const checkbox = row.createEl("input", {
        type: "checkbox",
        cls: "lifeplanner-action-plan-checkbox",
      });
      checkbox.checked = done;
      checkbox.addEventListener("change", () => this.scheduleSave());
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
        const existingLevel = goalLevelMap.get(goalId);
        const goalTitle = goalTitleMap.get(goalId) ?? goalId;
        const label = existingLevel ? `【${existingLevel}】${goalTitle} / ${value.split(" / ")[1] ?? ""}` : value;
        select.createEl("option", { text: label, value });
      }
      select.value = value;
      select.addEventListener("change", () => this.scheduleSave());
      const remove = row.createEl("button", { text: "×", cls: "lifeplanner-action-plan-remove" });
      remove.addEventListener("click", (event) => {
        event.preventDefault();
        row.remove();
        this.actionPlanRows = this.actionPlanRows.filter((item) => item.select !== select);
        this.scheduleSave();
      });
      this.actionPlanRows.push({ select, checkbox });
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
    const remove = row.createEl("button", { text: "×" });
    remove.addEventListener("click", (event) => {
      event.preventDefault();
      row.remove();
      const index = inputs.indexOf(input);
      if (index >= 0) {
        inputs.splice(index, 1);
      }
      this.scheduleSave();
    });
    inputs.push(input);
  }

  private renderDailyMemos(container: HTMLElement, plan: WeeklyPlan): void {
    const section = container.createEl("div", { cls: "lifeplanner-weekly-section" });
    section.createEl("h3", { text: "日付ごとの一言メモ欄" });
    const grid = section.createEl("div", { cls: "lifeplanner-daily-memos" });
    for (const day of this.dayOrder) {
      const card = grid.createEl("div", { cls: "lifeplanner-daily-memo-card" });
      this.dailyMemoCards.set(day, card);
      const header = card.createEl("div", { cls: "lifeplanner-daily-memo-header" });
      header.createEl("h4", { text: day });
      const dateLabel = header.createEl("span", { cls: "lifeplanner-daily-memo-date" });
      this.dayDateLabels.set(day, dateLabel);
      const list = card.createEl("div", { cls: "lifeplanner-weekly-list" });
      const actions = card.createEl("div", { cls: "lifeplanner-weekly-list-actions" });
      const addButton = actions.createEl("button", { text: "追加" });
      const inputs: HTMLInputElement[] = [];
      this.memoInputs.set(day, inputs);
      const addMemo = (value: string) => {
        const row = list.createEl("div", { cls: "lifeplanner-weekly-list-row" });
        const input = row.createEl("input", { type: "text" });
        input.placeholder = "今日の一言";
        input.value = value;
        input.addEventListener("input", () => this.scheduleSave());
        const remove = row.createEl("button", { text: "×" });
        remove.addEventListener("click", (event) => {
          event.preventDefault();
          row.remove();
          const index = inputs.indexOf(input);
          if (index >= 0) {
            inputs.splice(index, 1);
          }
          this.scheduleSave();
        });
        inputs.push(input);
      };
      addButton.addEventListener("click", (event) => {
        event.preventDefault();
        addMemo("");
        this.scheduleSave();
      });
      const memos = plan.dailyMemos[day] ?? [];
      memos.forEach((memo) => addMemo(memo));
      addMemo("");
    }
  }

  private async loadPlanForWeek(weekStart: Date): Promise<WeeklyPlan> {
    const path = resolveWeeklyPlanPath(weekStart, this.plugin.settings.storageDir);
    this.currentWeekPath = path;
    const content = await this.repository.read(path);
    if (!content) {
      const emptyPlan = this.buildEmptyPlan();
      const shared = await this.loadShared();
      emptyPlan.weekLabel = formatWeekLabel(weekStart, this.plugin.settings.weekStart);
      emptyPlan.monthTheme = shared.monthThemes[getMonthKey(weekStart)] ?? "";
      emptyPlan.routineActions = shared.routineActions.map((action) => ({
        title: action.title,
        checks: { ...action.checks },
      }));
      emptyPlan.roles = shared.roles.map((role) => ({
        role,
        goals: [],
      }));
      const serialized = serializeWeeklyPlan(emptyPlan);
      this.lastSavedContent = serialized;
      await this.repository.write(path, serialized);
      return emptyPlan;
    }
    this.lastSavedContent = content;
    return parseWeeklyPlan(content);
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
      await this.repository.write(path, serializeWeeklyShared(emptyShared));
      return emptyShared;
    }
    return parseWeeklyShared(content);
  }

  private async saveShared(plan: WeeklyPlan): Promise<void> {
    const shared = await this.loadShared();
    shared.routineActions = plan.routineActions.map((action) => ({
      title: action.title,
      checks: { ...action.checks },
    }));
    shared.roles = this.roleSections
      .map((role) => role.roleInput.value.trim())
      .filter((value) => value.length > 0);
    shared.monthThemes[getMonthKey(this.weekStart)] = plan.monthTheme ?? "";
    const path = resolveLifePlannerPath("Weekly Shared", this.plugin.settings.storageDir);
    await this.repository.write(path, serializeWeeklyShared(shared));
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
    const plan = this.buildEmptyPlan();
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
      const inputs = this.memoInputs.get(day) ?? [];
      plan.dailyMemos[day] = inputs
        .map((input) => input.value.trim())
        .filter((value) => value.length > 0);
      const slot = plan.slots.find((entry) => entry.day === day);
      if (slot) {
        const dateLabel = this.dayDateLabels.get(day);
        slot.dateLabel = dateLabel ? dateLabel.textContent ?? "" : "";
      }
    }

    const serialized = serializeWeeklyPlan(plan);
    if (serialized === this.lastSavedContent) {
      this.setStatus("変更はありません");
      return;
    }
    await this.repository.write(this.currentWeekPath, serialized);
    this.lastSavedContent = serialized;
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

  private scheduleSave(): void {
    if (this.saveTimer) {
      window.clearTimeout(this.saveTimer);
    }
    this.saveTimer = window.setTimeout(() => {
      void this.savePlan();
    }, 500);
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
