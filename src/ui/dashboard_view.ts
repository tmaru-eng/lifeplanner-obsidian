import { ItemView, WorkspaceLeaf } from "obsidian";
import type LifePlannerPlugin from "../main";
import type { GoalLevel } from "../models/goal";
import type { InboxDestination, InboxItem } from "../models/inbox_item";
import { GoalsService } from "../services/goals_service";
import { InboxService } from "../services/inbox_service";
import { InboxTriage } from "../services/inbox_triage";
import { IssuesService } from "../services/issues_service";
import { MarkdownRepository } from "../services/markdown_repository";
import { TasksService } from "../services/tasks_service";
import { attachRowMenu, enableTapToBlur, registerRowMenuClose } from "./interaction";
import { NAV_GROUPS, renderNavigation } from "./navigation";
import { WeeklyPlanRenderer } from "./weekly_plan_view";
import {
  DASHBOARD_VIEW_TYPE,
  GOAL_TASK_VIEW_TYPE,
  INBOX_VIEW_TYPE,
  ISSUES_VIEW_TYPE,
  LifePlannerViewType,
  WEEKLY_PLAN_VIEW_TYPE,
} from "./view_types";

type DashboardSection = {
  label: string;
  viewType: LifePlannerViewType;
  groupLabel: string;
};

type DashboardServices = {
  repository: MarkdownRepository;
  inboxService: InboxService;
  inboxTriage: InboxTriage;
  goalsService: GoalsService;
  tasksService: TasksService;
  issuesService: IssuesService;
};

const DASHBOARD_SECTIONS: DashboardSection[] = NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    label: item.label,
    viewType: item.viewType,
    groupLabel: group.label,
  }))
).filter((item) => item.viewType !== DASHBOARD_VIEW_TYPE);

export class DashboardView extends ItemView {
  private plugin: LifePlannerPlugin;
  private embeddedWeekly: WeeklyPlanRenderer | null = null;
  private disposeMenuClose: (() => void) | null = null;
  private statusEl: HTMLElement | null = null;
  private showControls = false;

  constructor(leaf: WorkspaceLeaf, plugin: LifePlannerPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return DASHBOARD_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "ダッシュボード";
  }

  async onOpen(): Promise<void> {
    await this.renderDashboard();
  }

  async onClose(): Promise<void> {
    await this.cleanupEmbeddedWeekly();
    this.disposeMenuClose?.();
    this.disposeMenuClose = null;
    this.statusEl = null;
    this.showControls = false;
    this.contentEl.empty();
  }

  private async cleanupEmbeddedWeekly(): Promise<void> {
    if (!this.embeddedWeekly) {
      return;
    }
    await this.embeddedWeekly.onClose();
    this.embeddedWeekly = null;
  }

  private buildServices(): DashboardServices {
    const repository = new MarkdownRepository(this.plugin.app);
    return {
      repository,
      inboxService: new InboxService(
        repository,
        this.plugin.settings.storageDir,
        this.plugin.settings.defaultTags
      ),
      inboxTriage: new InboxTriage(
        repository,
        this.plugin.settings.storageDir,
        this.plugin.settings.weekStart,
        this.plugin.settings.defaultTags
      ),
      goalsService: new GoalsService(
        repository,
        this.plugin.settings.storageDir,
        this.plugin.settings.defaultTags
      ),
      tasksService: new TasksService(
        repository,
        this.plugin.settings.storageDir,
        this.plugin.settings.defaultTags
      ),
      issuesService: new IssuesService(
        repository,
        this.plugin.settings.storageDir,
        this.plugin.settings.defaultTags
      ),
    };
  }

  private async renderDashboard(): Promise<void> {
    const container = this.contentEl;
    await this.cleanupEmbeddedWeekly();
    this.disposeMenuClose?.();
    container.empty();
    const view = container.createEl("div", { cls: "lifeplanner-view" });
    enableTapToBlur(view);
    this.disposeMenuClose = registerRowMenuClose(view);
    const header = view.createEl("div", { cls: "lifeplanner-dashboard-header" });
    header.createEl("h2", { text: "ダッシュボード" });
    const headerActions = header.createEl("div", { cls: "lifeplanner-dashboard-header-actions" });
    const editToggle = headerActions.createEl("button", {
      cls: "lifeplanner-dashboard-edit-toggle",
      text: this.showControls ? "編集を閉じる" : "編集",
    });
    editToggle.setAttr("type", "button");
    renderNavigation(
      view,
      DASHBOARD_VIEW_TYPE,
      (viewType) => {
        void this.plugin.openViewInLeaf(viewType, this.leaf);
      },
      this.plugin.settings.hiddenTabs
    );

    this.statusEl = view.createEl("div", { cls: "lifeplanner-dashboard-status" });

    const selected = new Set(this.plugin.settings.dashboardSections);
    const controls = view.createEl("div", { cls: "lifeplanner-dashboard-controls" });
    const grid = view.createEl("div", { cls: "lifeplanner-dashboard-grid" });
    const setControlsVisible = (visible: boolean): void => {
      this.showControls = visible;
      controls.classList.toggle("lifeplanner-hidden", !visible);
      grid.classList.toggle("lifeplanner-hidden", visible);
      editToggle.setText(visible ? "編集を閉じる" : "編集");
    };
    setControlsVisible(this.showControls);
    editToggle.addEventListener("click", () => {
      setControlsVisible(!this.showControls);
    });
    controls.createEl("h3", { text: "表示セクション" });
    const groupsWrap = controls.createEl("div", { cls: "lifeplanner-dashboard-groups" });

    const updateSettings = async (viewType: LifePlannerViewType, enabled: boolean): Promise<void> => {
      const updated = new Set(this.plugin.settings.dashboardSections);
      if (enabled) {
        updated.add(viewType);
      } else {
        updated.delete(viewType);
      }
      this.plugin.settings.dashboardSections = Array.from(updated);
      await this.plugin.saveSettings();
      void this.renderDashboard();
    };

    NAV_GROUPS.forEach((group) => {
      const items = group.items.filter((item) => item.viewType !== DASHBOARD_VIEW_TYPE);
      if (items.length === 0) {
        return;
      }
      const groupBlock = groupsWrap.createEl("div", { cls: "lifeplanner-dashboard-group" });
      groupBlock.createEl("h4", { text: group.label });
      const toggles = groupBlock.createEl("div", { cls: "lifeplanner-dashboard-toggles" });
      items.forEach((item) => {
        const label = toggles.createEl("label", { cls: "lifeplanner-dashboard-toggle" });
        const checkbox = label.createEl("input", { type: "checkbox" });
        checkbox.checked = selected.has(item.viewType);
        label.createEl("span", { text: item.label });
        checkbox.addEventListener("change", () => {
          void updateSettings(item.viewType, checkbox.checked);
        });
      });
    });

    const services = this.buildServices();

    if (this.plugin.settings.showDashboardCalendar) {
      const body = this.createSection(grid, "月間カレンダー");
      this.renderMonthlyCalendar(body, new Date());
    }

    const sectionMap = new Map(
      DASHBOARD_SECTIONS.map((item) => [item.viewType, item])
    );
    const orderedSections = this.plugin.settings.dashboardSections
      .map((viewType) => sectionMap.get(viewType))
      .filter((item): item is DashboardSection => Boolean(item));

    if (orderedSections.length === 0 && !this.plugin.settings.showDashboardCalendar) {
      const empty = grid.createEl("div", { cls: "lifeplanner-dashboard-empty" });
      empty.setText("表示するセクションを選択してください。");
      return;
    }

    for (const section of orderedSections) {
      const includeHeader = section.viewType !== WEEKLY_PLAN_VIEW_TYPE;
      const body = this.createSection(grid, section.label, includeHeader);
      await this.renderSection(section.viewType, body, services);
    }
  }

  private createSection(
    container: HTMLElement,
    title: string,
    includeHeader = true
  ): HTMLElement {
    const section = container.createEl("section", { cls: "lifeplanner-dashboard-section" });
    if (includeHeader) {
      const header = section.createEl("div", { cls: "lifeplanner-dashboard-section-header" });
      header.createEl("h3", { text: title });
    }
    return section.createEl("div", { cls: "lifeplanner-dashboard-section-body" });
  }

  private async renderSection(
    viewType: LifePlannerViewType,
    container: HTMLElement,
    services: DashboardServices
  ): Promise<void> {
    switch (viewType) {
      case INBOX_VIEW_TYPE:
        await this.renderInboxSection(container, services);
        return;
      case WEEKLY_PLAN_VIEW_TYPE:
        await this.renderWeeklySection(container);
        return;
      case GOAL_TASK_VIEW_TYPE:
        await this.renderActionPlanSection(container, services);
        return;
      case ISSUES_VIEW_TYPE:
        await this.renderIssuesSection(container, services);
        return;
      default:
        container.createEl("div", {
          text: "このセクションはタブで管理してください。",
          cls: "lifeplanner-dashboard-placeholder",
        });
    }
  }

  private async renderInboxSection(container: HTMLElement, services: DashboardServices): Promise<void> {
    const form = container.createEl("div", { cls: "lifeplanner-inbox-form lifeplanner-form" });
    const input = form.createEl("input", { type: "text" });
    input.placeholder = "メモを入力";
    const addButton = form.createEl("button", { text: "追加" });

    const listEl = container.createEl("div", { cls: "lifeplanner-inbox-list" });

    const handleAdd = async (content: string): Promise<void> => {
      if (!content) {
        this.setStatus("メモを入力してください");
        return;
      }
      await services.inboxService.addItem(content);
      this.setStatus("メモを追加しました");
      await renderItems();
    };

    const handleGoalTriage = async (item: InboxItem, level: GoalLevel): Promise<void> => {
      await services.inboxTriage.toGoal(item, level);
      await services.inboxService.deleteItem(item.id);
      this.setStatus("目標へ追加しました");
      await renderItems();
    };

    const handleTaskTriage = async (item: InboxItem, goalTitle: string): Promise<void> => {
      await services.inboxTriage.toTask(item, goalTitle);
      await services.inboxService.deleteItem(item.id);
      this.setStatus("タスクへ追加しました");
      await renderItems();
    };

    const handleWeeklyTriage = async (item: InboxItem): Promise<void> => {
      await services.inboxTriage.toWeekly(item);
      await services.inboxService.deleteItem(item.id);
      this.setStatus("週間計画へ追加しました");
      await renderItems();
    };

    const handleIssueTriage = async (item: InboxItem): Promise<void> => {
      await services.inboxTriage.toIssue(item);
      await services.inboxService.deleteItem(item.id);
      this.setStatus("イシューへ追加しました");
      await renderItems();
    };

    const handleDelete = async (itemId: string): Promise<void> => {
      await services.inboxService.deleteItem(itemId);
      this.setStatus("削除しました");
      await renderItems();
    };

    const renderItems = async (): Promise<void> => {
      listEl.empty();
      const items = await services.inboxService.listItems();
      if (items.length === 0) {
        listEl.createEl("div", { text: "(未登録)" });
        return;
      }
      const sortedItems = [...items].sort(
        (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
      );
      const goals = await services.goalsService.listGoals();
      const goalTitles = goals.map((goal) => goal.title);
      const goalLevels: GoalLevel[] = ["人生", "長期", "中期", "年間", "四半期", "月間", "週間"];
      for (const item of sortedItems) {
        const row = listEl.createEl("div", { cls: "lifeplanner-inbox-row" });
        const meta = row.createEl("div", { cls: "lifeplanner-inbox-meta" });
        meta.createEl("span", {
          cls: "lifeplanner-inbox-timestamp",
          text: this.formatTimestamp(item.createdAt),
        });
        const destLabel = this.formatDestination(item.destination);
        if (destLabel) {
          meta.createEl("span", { cls: "lifeplanner-inbox-destination", text: destLabel });
        }
        const inputRow = row.createEl("div", { cls: "lifeplanner-inbox-input-row" });
        const rowInput = inputRow.createEl("input", {
          type: "text",
          cls: "lifeplanner-inbox-input",
        });
        rowInput.placeholder = "メモ";
        rowInput.value = item.content;
        let lastSaved = item.content;
        rowInput.addEventListener("input", () => {
          const nextValue = rowInput.value.trim();
          if (!nextValue || nextValue === lastSaved) {
            return;
          }
          lastSaved = nextValue;
          void services.inboxService.updateItem(item.id, nextValue).then(() => {
            this.setStatus("保存しました");
          });
        });
        rowInput.addEventListener("blur", () => {
          if (rowInput.value.trim().length === 0) {
            rowInput.value = lastSaved;
            this.setStatus("メモを入力してください");
          }
        });

        const menuHost = inputRow.createEl("div", { cls: "lifeplanner-inbox-menu" });

        const resolveContent = (): InboxItem | null => {
          const content = rowInput.value.trim();
          if (!content) {
            rowInput.value = lastSaved;
            this.setStatus("メモを入力してください");
            rowInput.focus();
            return null;
          }
          if (content !== item.content) {
            return { ...item, content };
          }
          return item;
        };

        const panels = row.createEl("div", { cls: "lifeplanner-inbox-panels" });
        const goalPanel = panels.createEl("div", {
          cls: "lifeplanner-inbox-panel lifeplanner-hidden",
        });
        goalPanel.createEl("span", { cls: "lifeplanner-inbox-panel-label", text: "スパン" });
        const goalSelect = goalPanel.createEl("select");
        goalLevels.forEach((level) => {
          goalSelect.createEl("option", { text: level, value: level });
        });
        goalSelect.value = "週間";
        const goalConfirm = goalPanel.createEl("button", { text: "追加" });

        const taskPanel = panels.createEl("div", {
          cls: "lifeplanner-inbox-panel lifeplanner-hidden",
        });
        taskPanel.createEl("span", { cls: "lifeplanner-inbox-panel-label", text: "目標" });
        const taskSelect = taskPanel.createEl("select");
        if (goalTitles.length > 0) {
          const placeholder = taskSelect.createEl("option", { text: "目標を選択", value: "" });
          placeholder.disabled = true;
          placeholder.selected = true;
          goalTitles.forEach((title) => {
            taskSelect.createEl("option", { text: title, value: title });
          });
        } else {
          taskSelect.createEl("option", { text: "週間", value: "週間" });
          taskSelect.value = "週間";
        }
        const taskConfirm = taskPanel.createEl("button", { text: "追加" });

        const togglePanel = (panel: HTMLElement): void => {
          const show = panel.classList.contains("lifeplanner-hidden");
          goalPanel.classList.add("lifeplanner-hidden");
          taskPanel.classList.add("lifeplanner-hidden");
          if (show) {
            panel.classList.remove("lifeplanner-hidden");
          }
        };

        goalConfirm.addEventListener("click", () => {
          const current = resolveContent();
          if (!current) {
            return;
          }
          void handleGoalTriage(current, goalSelect.value as GoalLevel);
          goalPanel.classList.add("lifeplanner-hidden");
        });
        taskConfirm.addEventListener("click", () => {
          const current = resolveContent();
          if (!current) {
            return;
          }
          if (!taskSelect.value) {
            this.setStatus("目標を選択してください");
            return;
          }
          void handleTaskTriage(current, taskSelect.value);
          taskPanel.classList.add("lifeplanner-hidden");
        });
        attachRowMenu(menuHost, this.contentEl, [
          {
            label: "目標へ",
            onSelect: () => togglePanel(goalPanel),
          },
          {
            label: "タスクへ",
            onSelect: () => togglePanel(taskPanel),
          },
          {
            label: "週間へ",
            onSelect: () => {
              const current = resolveContent();
              if (!current) {
                return;
              }
              void handleWeeklyTriage(current);
              goalPanel.classList.add("lifeplanner-hidden");
              taskPanel.classList.add("lifeplanner-hidden");
            },
          },
          {
            label: "イシューへ",
            onSelect: () => {
              const current = resolveContent();
              if (!current) {
                return;
              }
              void handleIssueTriage(current);
              goalPanel.classList.add("lifeplanner-hidden");
              taskPanel.classList.add("lifeplanner-hidden");
            },
          },
          {
            label: "削除",
            onSelect: () => {
              void handleDelete(item.id);
            },
          },
        ]);
      }
    };

    addButton.addEventListener("click", () => {
      void handleAdd(input.value.trim());
      input.value = "";
    });

    await renderItems();
  }

  private async renderWeeklySection(container: HTMLElement): Promise<void> {
    if (!this.embeddedWeekly) {
      this.embeddedWeekly = new WeeklyPlanRenderer(this.plugin);
    }
    await this.embeddedWeekly.render(container, {
      showNavigation: false,
      showHeader: true,
      attachMenuClose: false,
    });
  }

  private async renderActionPlanSection(
    container: HTMLElement,
    services: DashboardServices
  ): Promise<void> {
    const tasks = await services.tasksService.listTasks();
    const list = container.createEl("div", {
      cls: "lifeplanner-weekly-list lifeplanner-action-plan-list",
    });
    const hiddenWrap = container.createEl("div", { cls: "lifeplanner-action-plan-hidden" });
    const hiddenHeader = hiddenWrap.createEl("div", {
      cls: "lifeplanner-action-plan-hidden-header",
    });
    const hiddenToggle = hiddenHeader.createEl("button", { text: "非表示リスト" });
    const hiddenList = hiddenWrap.createEl("div", {
      cls: "lifeplanner-weekly-list lifeplanner-action-plan-list is-hidden",
    });

    let hiddenOpen = false;
    const setHiddenOpen = (open: boolean): void => {
      hiddenOpen = open;
      hiddenList.classList.toggle("is-hidden", !hiddenOpen);
    };
    const updateHiddenCount = (): void => {
      const count = hiddenList.querySelectorAll(".lifeplanner-weekly-list-row").length;
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

    if (tasks.length === 0) {
      list.createEl("div", { text: "(未登録)" });
      updateHiddenCount();
      return;
    }

    tasks.forEach((task) => {
      const row = list.createEl("div", { cls: "lifeplanner-weekly-list-row" });
      const label = row.createEl("span", {
        text: `${task.goalId ? `[${task.goalId}] ` : ""}${task.title}`,
      });
      label.classList.add("lifeplanner-action-plan-label");
      const checkbox = row.createEl("input", { type: "checkbox" });
      checkbox.checked = task.status === "done";
      if (checkbox.checked) {
        moveRow(row, true);
      }
      checkbox.addEventListener("change", () => {
        task.status = checkbox.checked ? "done" : "todo";
        moveRow(row, checkbox.checked);
        void services.tasksService.saveTasks(tasks).then(() => {
          this.setStatus("保存しました");
        });
      });
    });

    updateHiddenCount();
  }

  private async renderIssuesSection(
    container: HTMLElement,
    services: DashboardServices
  ): Promise<void> {
    const board = container.createEl("div", { cls: "lifeplanner-kanban" });
    const columns = this.plugin.settings.kanbanColumns.length
      ? this.plugin.settings.kanbanColumns
      : ["Backlog"];
    const issues = await services.issuesService.listIssues();
    const grouped: Record<string, string[]> = {};
    columns.forEach((column) => {
      grouped[column] = [];
    });
    issues.forEach((issue) => {
      const status = grouped[issue.status] ? issue.status : columns[0];
      if (!grouped[status]) {
        grouped[status] = [];
      }
      grouped[status].push(issue.title || "(無題)");
    });

    columns.forEach((column) => {
      const columnEl = board.createEl("div", { cls: "lifeplanner-kanban-column" });
      const header = columnEl.createEl("div", { cls: "lifeplanner-kanban-header" });
      const count = grouped[column]?.length ?? 0;
      header.createEl("h3", { text: `${column} (${count})` });
      const list = columnEl.createEl("div", { cls: "lifeplanner-kanban-list" });
      const titles = grouped[column] ?? [];
      if (titles.length === 0) {
        list.createEl("div", { text: "(空)", cls: "lifeplanner-kanban-empty" });
        return;
      }
      titles.slice(0, 5).forEach((title) => {
        const card = list.createEl("div", { cls: "lifeplanner-kanban-card" });
        card.createEl("div", { text: title });
      });
      if (titles.length > 5) {
        list.createEl("div", {
          text: `他 ${titles.length - 5} 件`,
          cls: "lifeplanner-kanban-empty",
        });
      }
    });
  }

  private renderMonthlyCalendar(container: HTMLElement, date: Date): void {
    const weekStart = this.computeWeekStart(date);
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startIndex =
      this.plugin.settings.weekStart === "sunday"
        ? firstDay.getDay()
        : (firstDay.getDay() + 6) % 7;
    const dayLabels =
      this.plugin.settings.weekStart === "sunday"
        ? ["日", "月", "火", "水", "木", "金", "土"]
        : ["月", "火", "水", "木", "金", "土", "日"];

    const weekStartDate = new Date(year, month, weekStart.getDate());
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);
    const today = new Date();

    const calendar = container.createEl("div", { cls: "lifeplanner-monthly-calendar" });
    calendar.createEl("div", {
      cls: "lifeplanner-monthly-title",
      text: `${year}年${month + 1}月`,
    });
    const grid = calendar.createEl("div", { cls: "lifeplanner-monthly-grid" });

    dayLabels.forEach((label) => {
      grid.createEl("div", {
        cls: "lifeplanner-monthly-cell is-header",
        text: label,
      });
    });

    for (let i = 0; i < startIndex; i += 1) {
      grid.createEl("div", { cls: "lifeplanner-monthly-cell is-empty" });
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const current = new Date(year, month, day);
      const cell = grid.createEl("div", {
        cls: "lifeplanner-monthly-cell",
        text: `${day}`,
      });
      if (current >= weekStartDate && current <= weekEndDate) {
        cell.classList.add("is-in-week");
      }
      if (this.isSameDay(current, today)) {
        cell.classList.add("is-today");
      }
    }
  }

  private computeWeekStart(today: Date): Date {
    const base = new Date(today);
    const day = base.getDay();
    const startIndex = this.plugin.settings.weekStart === "sunday" ? 0 : 1;
    const diff = (day - startIndex + 7) % 7;
    const start = new Date(base);
    start.setDate(base.getDate() - diff);
    return start;
  }

  private isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  private formatTimestamp(value?: number): string {
    if (!value) {
      return "日時未設定";
    }
    const date = new Date(value);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    const hours = `${date.getHours()}`.padStart(2, "0");
    const minutes = `${date.getMinutes()}`.padStart(2, "0");
    return `${year}/${month}/${day} ${hours}:${minutes}`;
  }

  private formatDestination(destination: InboxDestination): string {
    switch (destination) {
      case "goal":
        return "振り分け: 目標";
      case "task":
        return "振り分け: タスク";
      case "weekly":
        return "振り分け: 週間";
      case "issue":
        return "振り分け: イシュー";
      default:
        return "";
    }
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
