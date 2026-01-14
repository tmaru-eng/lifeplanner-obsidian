import { ItemView, WorkspaceLeaf } from "obsidian";
import { GoalsService } from "../services/goals_service";
import { MarkdownRepository } from "../services/markdown_repository";
import { TasksService } from "../services/tasks_service";
import type LifePlannerPlugin from "../main";
import { renderNavigation } from "./navigation";
import { GOAL_TASK_VIEW_TYPE } from "./view_types";
export { GOAL_TASK_VIEW_TYPE };

export class GoalTaskView extends ItemView {
  private plugin: LifePlannerPlugin;
  private goalsService: GoalsService;
  private tasksService: TasksService;
  private listEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private taskRows: {
    checkbox: HTMLInputElement;
    goalSelect: HTMLSelectElement;
    titleInput: HTMLInputElement;
  }[] = [];
  private goalOptions: { title: string }[] = [];
  private saveTimer: number | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: LifePlannerPlugin) {
    super(leaf);
    this.plugin = plugin;
    const repository = new MarkdownRepository(this.plugin.app);
    this.goalsService = new GoalsService(repository, this.plugin.settings.storageDir);
    this.tasksService = new TasksService(repository, this.plugin.settings.storageDir);
  }

  getViewType(): string {
    return GOAL_TASK_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "アクションプラン";
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();

    const view = container.createEl("div", { cls: "lifeplanner-view" });
    view.createEl("h2", { text: "アクションプラン" });
    renderNavigation(view, (viewType) => {
      void this.plugin.openViewInLeaf(viewType, this.leaf);
    });

    this.statusEl = view.createEl("div", { cls: "lifeplanner-goal-task-status" });
    const section = view.createEl("div", {
      cls: "lifeplanner-weekly-section lifeplanner-action-plan-section",
    });
    const header = section.createEl("div", { cls: "lifeplanner-weekly-section-header" });
    header.createEl("h3", { text: "タスク一覧" });
    const addButton = header.createEl("button", { text: "追加" });
    section.createEl("div", {
      cls: "lifeplanner-action-plan-hint",
      text: "目標とタスクを編集・整理します。",
    });
    this.listEl = section.createEl("div", {
      cls: "lifeplanner-weekly-list lifeplanner-action-plan-list",
    });

    await this.renderTasks();

    addButton.addEventListener("click", (event) => {
      event.preventDefault();
      this.addTaskRow(this.goalOptions);
    });
  }

  async onClose(): Promise<void> {
    this.listEl = null;
    this.statusEl = null;
    this.taskRows = [];
    if (this.saveTimer) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  private async renderTasks(): Promise<void> {
    if (!this.listEl) {
      return;
    }
    this.listEl.empty();
    this.taskRows = [];
    const tasks = await this.tasksService.listTasks();
    const goals = await this.goalsService.listGoals();
    this.goalOptions = goals.map((goal) => ({ title: goal.title }));
    if (tasks.length === 0) {
      this.addTaskRow(this.goalOptions);
      return;
    }
    for (const task of tasks) {
      this.addTaskRow(this.goalOptions, task.goalId, task.title, task.status === "done");
    }
  }

  private addTaskRow(
    goals?: { title: string }[],
    goalId = "",
    title = "",
    done = false
  ): void {
    if (!this.listEl) {
      return;
    }
    const row = this.listEl.createEl("div", {
      cls: "lifeplanner-action-plan-row lifeplanner-action-plan-task-row",
    });
    const checkbox = row.createEl("input", {
      type: "checkbox",
      cls: "lifeplanner-action-plan-checkbox",
    });
    checkbox.checked = done;
    const select = row.createEl("select", { cls: "lifeplanner-action-plan-select" });
    const placeholder = select.createEl("option", { text: "目標を選択", value: "" });
    placeholder.disabled = true;
    placeholder.selected = !goalId;
    const goalList = goals ?? this.goalOptions;
    if (goalList.length === 0) {
      select.createEl("option", { text: "目標が未登録", value: "" });
    } else {
      for (const goal of goalList) {
        select.createEl("option", { text: goal.title, value: goal.title });
      }
    }
    if (goalId && !goalList.some((goal) => goal.title === goalId)) {
      select.createEl("option", { text: goalId, value: goalId });
    }
    select.value = goalId;
    const input = row.createEl("input", {
      type: "text",
      cls: "lifeplanner-action-plan-input",
    });
    input.placeholder = "タスク内容";
    input.value = title;
    const remove = row.createEl("button", { text: "×", cls: "lifeplanner-action-plan-remove" });

    const onChange = () => this.scheduleSave();
    checkbox.addEventListener("change", onChange);
    select.addEventListener("change", onChange);
    input.addEventListener("input", onChange);
    remove.addEventListener("click", (event) => {
      event.preventDefault();
      row.remove();
      this.taskRows = this.taskRows.filter((item) => item.titleInput !== input);
      this.scheduleSave();
    });
    this.taskRows.push({ checkbox, goalSelect: select, titleInput: input });
  }

  private scheduleSave(): void {
    if (this.saveTimer) {
      window.clearTimeout(this.saveTimer);
    }
    this.saveTimer = window.setTimeout(() => {
      void this.saveTasks();
    }, 300);
  }

  private async saveTasks(): Promise<void> {
    if (!this.listEl) {
      return;
    }
    const tasks = this.taskRows
      .map((row) => ({
        goalId: row.goalSelect.value.trim(),
        title: row.titleInput.value.trim(),
        status: row.checkbox.checked ? "done" : "todo",
      }))
      .filter((task) => task.goalId || task.title)
      .map((task, index) => ({
        id: `task-${index}`,
        ...task,
      }));
    await this.tasksService.saveTasks(tasks);
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
}
