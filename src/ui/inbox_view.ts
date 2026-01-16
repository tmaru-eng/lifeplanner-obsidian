import { ItemView, WorkspaceLeaf } from "obsidian";
import { GoalLevel } from "../models/goal";
import { InboxDestination, InboxItem } from "../models/inbox_item";
import { GoalsService } from "../services/goals_service";
import { InboxService } from "../services/inbox_service";
import { InboxTriage } from "../services/inbox_triage";
import { MarkdownRepository } from "../services/markdown_repository";
import type LifePlannerPlugin from "../main";
import { attachRowMenu, enableTapToBlur, registerRowMenuClose } from "./interaction";
import { renderNavigation } from "./navigation";
import { INBOX_VIEW_TYPE } from "./view_types";
export { INBOX_VIEW_TYPE };

export class InboxView extends ItemView {
  private plugin: LifePlannerPlugin;
  private inboxService: InboxService;
  private inboxTriage: InboxTriage;
  private goalsService: GoalsService;
  private listEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private disposeMenuClose: (() => void) | null = null;
  private viewEl: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: LifePlannerPlugin) {
    super(leaf);
    this.plugin = plugin;
    const repository = new MarkdownRepository(this.plugin.app);
    this.inboxService = new InboxService(
      repository,
      this.plugin.settings.storageDir,
      this.plugin.settings.defaultTags
    );
    this.inboxTriage = new InboxTriage(
      repository,
      this.plugin.settings.storageDir,
      this.plugin.settings.weekStart,
      this.plugin.settings.defaultTags
    );
    this.goalsService = new GoalsService(
      repository,
      this.plugin.settings.storageDir,
      this.plugin.settings.defaultTags
    );
  }

  getViewType(): string {
    return INBOX_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Inbox";
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();

    const view = container.createEl("div", { cls: "lifeplanner-view" });
    this.viewEl = view;
    enableTapToBlur(view);
    view.createEl("h2", { text: "Inbox" });
    renderNavigation(view, INBOX_VIEW_TYPE, (viewType) => {
      void this.plugin.openViewInLeaf(viewType, this.leaf);
    }, this.plugin.settings.hiddenTabs);

    const form = view.createEl("div", { cls: "lifeplanner-inbox-form lifeplanner-form" });
    const input = form.createEl("input", { type: "text" });
    input.placeholder = "メモを入力";
    const addButton = form.createEl("button", { text: "追加" });

    this.statusEl = view.createEl("div", { cls: "lifeplanner-inbox-status" });
    this.listEl = view.createEl("div", { cls: "lifeplanner-inbox-list" });
    this.disposeMenuClose = registerRowMenuClose(view);

    addButton.addEventListener("click", () => {
      void this.handleAdd(input.value.trim());
      input.value = "";
    });

    await this.renderItems();
  }

  async onClose(): Promise<void> {
    this.listEl = null;
    this.statusEl = null;
    this.viewEl = null;
    this.disposeMenuClose?.();
    this.disposeMenuClose = null;
  }

  private async handleAdd(content: string): Promise<void> {
    if (!content) {
      this.setStatus("メモを入力してください");
      return;
    }
    await this.inboxService.addItem(content);
    this.setStatus("メモを追加しました");
    await this.renderItems();
  }

  private async handleGoalTriage(item: InboxItem, level: GoalLevel): Promise<void> {
    await this.inboxTriage.toGoal(item, level);
    await this.inboxService.deleteItem(item.id);
    this.setStatus("目標へ追加しました");
    await this.renderItems();
  }

  private async handleTaskTriage(item: InboxItem, goalTitle: string): Promise<void> {
    await this.inboxTriage.toTask(item, goalTitle);
    await this.inboxService.deleteItem(item.id);
    this.setStatus("タスクへ追加しました");
    await this.renderItems();
  }

  private async handleWeeklyTriage(item: InboxItem): Promise<void> {
    await this.inboxTriage.toWeekly(item);
    await this.inboxService.deleteItem(item.id);
    this.setStatus("週間計画へ追加しました");
    await this.renderItems();
  }

  private async handleIssueTriage(item: InboxItem): Promise<void> {
    await this.inboxTriage.toIssue(item);
    await this.inboxService.deleteItem(item.id);
    this.setStatus("イシューへ追加しました");
    await this.renderItems();
  }

  private async handleDelete(itemId: string): Promise<void> {
    await this.inboxService.deleteItem(itemId);
    this.setStatus("削除しました");
    await this.renderItems();
  }

  private async renderItems(): Promise<void> {
    if (!this.listEl) {
      return;
    }
    this.listEl.empty();
    const items = await this.inboxService.listItems();
    if (items.length === 0) {
      this.listEl.createEl("div", { text: "(未登録)" });
      return;
    }
    const sortedItems = [...items].sort(
      (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
    );
    const goals = await this.goalsService.listGoals();
    const goalTitles = goals.map((goal) => goal.title);
    const goalLevels: GoalLevel[] = ["人生", "長期", "中期", "年間", "四半期", "月間", "週間"];
    for (const item of sortedItems) {
      const row = this.listEl.createEl("div", { cls: "lifeplanner-inbox-row" });
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
      const input = inputRow.createEl("input", { type: "text", cls: "lifeplanner-inbox-input" });
      input.placeholder = "メモ";
      input.value = item.content;
      let lastSaved = item.content;
      input.addEventListener("input", () => {
        const nextValue = input.value.trim();
        if (!nextValue || nextValue === lastSaved) {
          return;
        }
        lastSaved = nextValue;
        void this.inboxService.updateItem(item.id, nextValue).then(() => {
          this.setStatus("保存しました");
        });
      });
      input.addEventListener("blur", () => {
        if (input.value.trim().length === 0) {
          input.value = lastSaved;
          this.setStatus("メモを入力してください");
        }
      });
      const menuHost = inputRow.createEl("div", { cls: "lifeplanner-inbox-menu" });
      const menuScope = this.viewEl ?? this.listEl ?? row;
      const resolveContent = (): InboxItem | null => {
        const content = input.value.trim();
        if (!content) {
          input.value = lastSaved;
          this.setStatus("メモを入力してください");
          input.focus();
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
        void this.handleGoalTriage(current, goalSelect.value as GoalLevel);
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
        void this.handleTaskTriage(current, taskSelect.value);
        taskPanel.classList.add("lifeplanner-hidden");
      });
      attachRowMenu(menuHost, menuScope, [
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
            void this.handleWeeklyTriage(current);
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
            void this.handleIssueTriage(current);
            goalPanel.classList.add("lifeplanner-hidden");
            taskPanel.classList.add("lifeplanner-hidden");
          },
        },
        {
          label: "削除",
          onSelect: () => {
            void this.handleDelete(item.id);
          },
        },
      ]);
    }
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
