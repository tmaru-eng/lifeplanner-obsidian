import { ItemView, MarkdownRenderer, Modal, WorkspaceLeaf } from "obsidian";
import type LifePlannerPlugin from "../main";
import { Issue, IssuePriority } from "../models/issue";
import { GoalsService } from "../services/goals_service";
import { IssuesService } from "../services/issues_service";
import { MarkdownRepository } from "../services/markdown_repository";
import { enableTapToBlur } from "./interaction";
import { renderNavigation } from "./navigation";
import { ISSUES_VIEW_TYPE } from "./view_types";

export { ISSUES_VIEW_TYPE };

const PRIORITIES: IssuePriority[] = ["Low", "Medium", "High"];

export class IssuesView extends ItemView {
  private plugin: LifePlannerPlugin;
  private issuesService: IssuesService;
  private goalsService: GoalsService;
  private listEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private issues: Issue[] = [];
  private handleMenuClose: ((event: MouseEvent) => void) | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: LifePlannerPlugin) {
    super(leaf);
    this.plugin = plugin;
    const repo = new MarkdownRepository(this.plugin.app);
    this.issuesService = new IssuesService(
      repo,
      this.plugin.settings.storageDir,
      this.plugin.settings.defaultTags
    );
    this.goalsService = new GoalsService(
      repo,
      this.plugin.settings.storageDir,
      this.plugin.settings.defaultTags
    );
  }

  getViewType(): string {
    return ISSUES_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "イシュー";
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    const view = container.createEl("div", { cls: "lifeplanner-view" });
    enableTapToBlur(view);
    view.createEl("h2", { text: "イシュー" });
    renderNavigation(view, ISSUES_VIEW_TYPE, (viewType) => {
      void this.plugin.openViewInLeaf(viewType, this.leaf);
    }, this.plugin.settings.hiddenTabs);
    this.statusEl = view.createEl("div", { cls: "lifeplanner-issues-status" });
    this.listEl = view.createEl("div", { cls: "lifeplanner-kanban" });
    this.handleMenuClose = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && this.listEl?.contains(target)) {
        return;
      }
      this.listEl?.querySelectorAll(".lifeplanner-kanban-menu-list.is-open").forEach((menu) => {
        menu.classList.remove("is-open");
      });
    };
    document.addEventListener("mousedown", this.handleMenuClose, true);
    await this.renderBoard();
  }

  async onClose(): Promise<void> {
    this.listEl = null;
    this.statusEl = null;
    this.issues = [];
    if (this.handleMenuClose) {
      document.removeEventListener("mousedown", this.handleMenuClose, true);
      this.handleMenuClose = null;
    }
  }

  private async renderBoard(): Promise<void> {
    if (!this.listEl) {
      return;
    }
    this.listEl.empty();
    const columns = this.plugin.settings.kanbanColumns.length
      ? this.plugin.settings.kanbanColumns
      : ["Backlog"];
    this.issues = await this.issuesService.listIssues();
    const goals = await this.goalsService.listGoals();
    const grouped: Record<string, Issue[]> = {};
    columns.forEach((column) => {
      grouped[column] = [];
    });
    for (const issue of this.issues) {
      const status = grouped[issue.status] ? issue.status : columns[0];
      if (!grouped[status]) {
        grouped[status] = [];
      }
      grouped[status].push(issue);
    }

    for (const column of columns) {
      const columnEl = this.listEl.createEl("div", { cls: "lifeplanner-kanban-column" });
      const header = columnEl.createEl("div", { cls: "lifeplanner-kanban-header" });
      header.createEl("h3", { text: column });
      const addButton = header.createEl("button", { text: "追加" });
      const list = columnEl.createEl("div", { cls: "lifeplanner-kanban-list" });
      list.addEventListener("dragover", (event) => {
        event.preventDefault();
        list.classList.add("is-drop");
      });
      list.addEventListener("dragleave", () => {
        list.classList.remove("is-drop");
      });
      list.addEventListener("drop", (event) => {
        event.preventDefault();
        list.classList.remove("is-drop");
        const issueId =
          event.dataTransfer?.getData("lifeplanner-issue") ||
          event.dataTransfer?.getData("text/plain");
        if (!issueId) {
          return;
        }
        void this.moveIssue(issueId, column);
      });
      addButton.addEventListener("click", () => {
        this.openIssueModal(
          {
            id: `issue-${Date.now()}`,
            title: "",
            status: column,
            body: "",
          },
          columns,
          goals.map((goal) => goal.title),
          true
        );
      });
      const items = grouped[column] ?? [];
      if (items.length === 0) {
        list.createEl("div", { text: "(空)", cls: "lifeplanner-kanban-empty" });
      }
      for (const issue of items) {
        const card = list.createEl("div", { cls: "lifeplanner-kanban-card" });
        card.setAttr("draggable", "true");
        card.addEventListener("dragstart", (event) => {
          event.dataTransfer?.setData("lifeplanner-issue", issue.id);
          event.dataTransfer?.setData("text/plain", issue.id);
        });
        const titleRow = card.createEl("div", { cls: "lifeplanner-kanban-card-title" });
        titleRow.createEl("span", { text: issue.title });
        const menu = titleRow.createEl("div", { cls: "lifeplanner-kanban-card-menu" });
        const menuButton = menu.createEl("button", { text: "⋯" });
        menuButton.setAttr("type", "button");
        const menuList = menu.createEl("div", { cls: "lifeplanner-kanban-menu-list" });
        const editButton = menuList.createEl("button", { text: "編集" });
        const deleteButton = menuList.createEl("button", { text: "削除" });
        menuButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          menuList.classList.toggle("is-open");
        });
        editButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          menuList.classList.remove("is-open");
          this.openIssueModal(issue, columns, goals.map((goal) => goal.title), false);
        });
        deleteButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          menuList.classList.remove("is-open");
          void this.deleteIssue(issue);
        });
        if (issue.linkedGoalId || issue.dueDate || issue.priority || (issue.tags ?? []).length) {
          const meta = card.createEl("div", { cls: "lifeplanner-kanban-meta" });
          if (issue.linkedGoalId) {
            meta.createEl("span", { text: `Goal: ${issue.linkedGoalId}` });
          }
          if (issue.dueDate) {
            meta.createEl("span", { text: `Due: ${issue.dueDate}` });
          }
          if (issue.priority) {
            meta.createEl("span", { text: `Priority: ${issue.priority}` });
          }
          if (issue.tags && issue.tags.length > 0) {
            meta.createEl("span", { text: `Tags: ${issue.tags.join(", ")}` });
          }
        }
        if (issue.body) {
          const body = card.createEl("div", {
            cls: "lifeplanner-kanban-body lifeplanner-markdown",
          });
          void MarkdownRenderer.renderMarkdown(issue.body, body, "", this);
        }
      }
    }
  }

  private async moveIssue(issueId: string, status: string): Promise<void> {
    const updated = this.issues.map((issue) =>
      issue.id === issueId ? { ...issue, status } : issue
    );
    await this.issuesService.saveIssues(updated);
    this.setStatus("移動しました");
    await this.renderBoard();
  }

  private async deleteIssue(issue: Issue): Promise<void> {
    const ok = window.confirm(`"${issue.title}" を削除しますか？`);
    if (!ok) {
      return;
    }
    const updated = this.issues.filter((item) => item.id !== issue.id);
    await this.issuesService.saveIssues(updated);
    this.setStatus("削除しました");
    await this.renderBoard();
  }

  private openIssueModal(
    issue: Issue,
    columns: string[],
    goals: string[],
    isNew: boolean
  ): void {
    const modal = new IssueEditModal(this.app, issue, columns, goals, async (updated) => {
      const others = this.issues.filter((item) => item.id !== updated.id);
      const next = isNew ? [...others, updated] : [...others, updated];
      await this.issuesService.saveIssues(next);
      this.setStatus(isNew ? "追加しました" : "更新しました");
      await this.renderBoard();
    });
    modal.open();
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

class IssueEditModal extends Modal {
  private issue: Issue;
  private columns: string[];
  private goals: string[];
  private onSubmit: (issue: Issue) => void | Promise<void>;

  constructor(
    app: import("obsidian").App,
    issue: Issue,
    columns: string[],
    goals: string[],
    onSubmit: (issue: Issue) => void | Promise<void>
  ) {
    super(app);
    this.issue = { ...issue };
    this.columns = columns;
    this.goals = goals;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const content = this.contentEl;
    content.empty();
    content.createEl("h3", { text: "Issue" });

    const titleField = content.createEl("div", { cls: "lifeplanner-form-field" });
    titleField.createEl("label", { text: "タイトル" });
    const titleInput = titleField.createEl("input", { type: "text" });
    titleInput.value = this.issue.title;

    const statusField = content.createEl("div", { cls: "lifeplanner-form-field" });
    statusField.createEl("label", { text: "列" });
    const statusSelect = statusField.createEl("select");
    this.columns.forEach((column) => {
      statusSelect.createEl("option", { text: column, value: column });
    });
    statusSelect.value = this.issue.status || this.columns[0];

    const goalField = content.createEl("div", { cls: "lifeplanner-form-field" });
    goalField.createEl("label", { text: "関連目標" });
    const goalSelect = goalField.createEl("select");
    goalSelect.createEl("option", { text: "なし", value: "" });
    this.goals.forEach((goal) => {
      goalSelect.createEl("option", { text: goal, value: goal });
    });
    goalSelect.value = this.issue.linkedGoalId ?? "";

    const tagsField = content.createEl("div", { cls: "lifeplanner-form-field" });
    tagsField.createEl("label", { text: "タグ" });
    const tagsInput = tagsField.createEl("input", { type: "text" });
    tagsInput.placeholder = "tag1, tag2";
    tagsInput.value = this.issue.tags?.join(", ") ?? "";

    const dueField = content.createEl("div", { cls: "lifeplanner-form-field" });
    dueField.createEl("label", { text: "期限" });
    const dueInput = dueField.createEl("input", { type: "date" });
    dueInput.value = this.issue.dueDate ?? "";

    const priorityField = content.createEl("div", { cls: "lifeplanner-form-field" });
    priorityField.createEl("label", { text: "優先度" });
    const prioritySelect = priorityField.createEl("select");
    prioritySelect.createEl("option", { text: "未設定", value: "" });
    PRIORITIES.forEach((priority) => {
      prioritySelect.createEl("option", { text: priority, value: priority });
    });
    prioritySelect.value = this.issue.priority ?? "";

    const bodyField = content.createEl("div", { cls: "lifeplanner-form-field" });
    bodyField.createEl("label", { text: "本文" });
    const bodyInput = bodyField.createEl("textarea");
    bodyInput.rows = 6;
    bodyInput.value = this.issue.body ?? "";

    const action = content.createEl("div", { cls: "lifeplanner-form-field" });
    const saveButton = action.createEl("button", { text: "保存" });
    saveButton.addEventListener("click", async () => {
      const title = titleInput.value.trim();
      if (!title) {
        return;
      }
      const tags = tagsInput.value
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
      const updated: Issue = {
        ...this.issue,
        title,
        status: statusSelect.value || this.columns[0],
        linkedGoalId: goalSelect.value || undefined,
        tags: tags.length > 0 ? tags : undefined,
        dueDate: dueInput.value || undefined,
        priority: (prioritySelect.value as IssuePriority) || undefined,
        body: bodyInput.value.trim(),
      };
      await this.onSubmit(updated);
      this.close();
    });
  }
}
