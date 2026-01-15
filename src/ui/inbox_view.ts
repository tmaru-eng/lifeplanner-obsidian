import { ItemView, WorkspaceLeaf } from "obsidian";
import { InboxItem } from "../models/inbox_item";
import { InboxService } from "../services/inbox_service";
import { InboxTriage } from "../services/inbox_triage";
import { MarkdownRepository } from "../services/markdown_repository";
import type LifePlannerPlugin from "../main";
import { renderNavigation } from "./navigation";
import { INBOX_VIEW_TYPE } from "./view_types";
export { INBOX_VIEW_TYPE };

export class InboxView extends ItemView {
  private plugin: LifePlannerPlugin;
  private inboxService: InboxService;
  private inboxTriage: InboxTriage;
  private listEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;

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
    view.createEl("h2", { text: "Inbox" });
    renderNavigation(view, INBOX_VIEW_TYPE, (viewType) => {
      void this.plugin.openViewInLeaf(viewType, this.leaf);
    });

    const form = view.createEl("div", { cls: "lifeplanner-inbox-form lifeplanner-form" });
    const input = form.createEl("input", { type: "text" });
    input.placeholder = "メモを入力";
    const addButton = form.createEl("button", { text: "追加" });

    this.statusEl = view.createEl("div", { cls: "lifeplanner-inbox-status" });
    this.listEl = view.createEl("div", { cls: "lifeplanner-inbox-list" });

    addButton.addEventListener("click", () => {
      void this.handleAdd(input.value.trim());
      input.value = "";
    });

    await this.renderItems();
  }

  async onClose(): Promise<void> {
    this.listEl = null;
    this.statusEl = null;
  }

  private async handleAdd(content: string): Promise<void> {
    if (!content) {
      this.setStatus("メモを入力してください");
      return;
    }
    await this.inboxService.addItem(content);
    this.setStatus("追加しました");
    await this.renderItems();
  }

  private async handleTriage(item: InboxItem, destination: "goal" | "task" | "weekly"): Promise<void> {
    if (destination === "goal") {
      await this.inboxTriage.toGoal(item);
    } else if (destination === "task") {
      await this.inboxTriage.toTask(item);
    } else {
      await this.inboxTriage.toWeekly(item);
    }
    await this.inboxService.markTriaged(item.id, destination);
    this.setStatus("振り分けました");
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
    for (const item of items) {
      const row = this.listEl.createEl("div", { cls: "lifeplanner-inbox-row" });
      row.createEl("span", { text: item.content });
      const controls = row.createEl("div", { cls: "lifeplanner-inbox-controls" });
      const toGoal = controls.createEl("button", { text: "目標へ" });
      const toTask = controls.createEl("button", { text: "タスクへ" });
      const toWeekly = controls.createEl("button", { text: "週間へ" });
      toGoal.addEventListener("click", () => void this.handleTriage(item, "goal"));
      toTask.addEventListener("click", () => void this.handleTriage(item, "task"));
      toWeekly.addEventListener("click", () => void this.handleTriage(item, "weekly"));
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
