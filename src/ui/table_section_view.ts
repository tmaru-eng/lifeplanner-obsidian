import { ItemView, WorkspaceLeaf } from "obsidian";
import type LifePlannerPlugin from "../main";
import { MarkdownRepository } from "../services/markdown_repository";
import { TableColumn, TableSectionService } from "../services/table_section_service";
import { attachDeleteMenu, enableTapToBlur, registerRowMenuClose } from "./interaction";
import { renderNavigation } from "./navigation";
import { LifePlannerViewType } from "./view_types";

export class TableSectionView extends ItemView {
  private plugin: LifePlannerPlugin;
  private titleText: string;
  private viewType: LifePlannerViewType;
  private service: TableSectionService;
  private columns: TableColumn[];
  private statusEl: HTMLElement | null = null;
  private rows: string[][] = [];
  private tableEl: HTMLElement | null = null;
  private sectionType: string;
  private enableRowActions = true;
  private viewEl: HTMLElement | null = null;
  private disposeMenuClose: (() => void) | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    plugin: LifePlannerPlugin,
    viewType: LifePlannerViewType,
    type: string,
    titleText: string,
    columns: TableColumn[]
  ) {
    super(leaf);
    this.plugin = plugin;
    this.viewType = viewType;
    this.titleText = titleText;
    this.columns = columns;
    this.sectionType = type;
    this.service = new TableSectionService(
      new MarkdownRepository(this.plugin.app),
      type as never,
      titleText,
      columns,
      this.plugin.settings.storageDir,
      this.plugin.settings.defaultTags
    );
  }

  getViewType(): string {
    return this.viewType;
  }

  getDisplayText(): string {
    return this.titleText;
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    const view = container.createEl("div", { cls: "lifeplanner-view" });
    this.viewEl = view;
    enableTapToBlur(view);
    this.disposeMenuClose = registerRowMenuClose(view);
    view.createEl("h2", { text: this.titleText });
    renderNavigation(view, this.viewType, (viewType) => {
      void this.plugin.openViewInLeaf(viewType, this.leaf);
    }, this.plugin.settings.hiddenTabs);
    this.statusEl = view.createEl("div", { cls: "lifeplanner-exercises-status" });
    const header = view.createEl("div", { cls: "lifeplanner-table-actions" });
    const addButton = header.createEl("button", { text: "追加" });
    this.tableEl = view.createEl("div", { cls: "lifeplanner-table-grid" });
    this.tableEl.dataset.sectionType = this.sectionType;
    await this.renderTable();
    addButton.addEventListener("click", () => {
      this.rows.push([]);
      void this.save();
      void this.renderTable();
    });
  }

  async onClose(): Promise<void> {
    this.statusEl = null;
    this.tableEl = null;
    this.rows = [];
    this.viewEl = null;
    this.disposeMenuClose?.();
    this.disposeMenuClose = null;
  }

  private async renderTable(): Promise<void> {
    if (!this.tableEl) {
      return;
    }
    this.tableEl.empty();
    const columnTemplate = this.columns
      .map((column) => {
        if (column.width) {
          return column.width;
        }
        if (column.type === "checkbox") {
          return "60px";
        }
        if (column.type === "select") {
          return "120px";
        }
        return "minmax(160px, 1fr)";
      })
      .join(" ");
    const actionColumn = this.enableRowActions ? "36px" : "";
    this.tableEl.style.gridTemplateColumns = [columnTemplate, actionColumn].filter(Boolean).join(" ");
    this.rows = await this.service.loadRows();
    if (this.rows.length === 0) {
      this.rows.push([]);
    }

    this.columns.forEach((column) => {
      this.tableEl?.createEl("div", {
        cls: "lifeplanner-table-cell lifeplanner-table-header",
        text: column.label,
      });
    });
    if (this.enableRowActions) {
      this.tableEl?.createEl("div", {
        cls: "lifeplanner-table-cell lifeplanner-table-header",
        text: "",
      });
    }

    this.rows.forEach((row, rowIndex) => {
      this.columns.forEach((column, colIndex) => {
        const cell = this.tableEl?.createEl("div", { cls: "lifeplanner-table-cell" });
        if (!cell) {
          return;
        }
        const value = row[colIndex] ?? "";
        if (column.type === "select") {
          const select = cell.createEl("select");
          (column.options ?? []).forEach((option) => {
            select.createEl("option", { text: option, value: option });
          });
          if (!value && column.options && column.options.length > 0) {
            select.value = column.options[0];
          } else {
            select.value = value;
          }
          select.addEventListener("change", () => {
            this.setCell(rowIndex, colIndex, select.value);
          });
        } else if (column.type === "checkbox") {
          const checkbox = cell.createEl("input", { type: "checkbox" });
          checkbox.checked = value === "x";
          checkbox.addEventListener("change", () => {
            this.setCell(rowIndex, colIndex, checkbox.checked ? "x" : "");
          });
        } else {
          if (column.multiline) {
            const input = cell.createEl("textarea");
            input.rows = 1;
            input.value = value;
            this.autoResizeTextarea(input);
            input.addEventListener("input", () => {
              this.setCell(rowIndex, colIndex, input.value);
              this.autoResizeTextarea(input);
            });
          } else {
            const input = cell.createEl("input", { type: "text" });
            input.value = value;
            input.addEventListener("input", () => {
              this.setCell(rowIndex, colIndex, input.value);
            });
          }
        }
      });
      if (this.enableRowActions) {
        const cell = this.tableEl?.createEl("div", { cls: "lifeplanner-table-cell" });
        const menuScope = this.viewEl ?? this.tableEl ?? cell;
        if (cell && menuScope) {
          attachDeleteMenu(cell, menuScope, () => {
            this.removeRow(rowIndex);
          });
        }
      }
    });
  }

  private setCell(rowIndex: number, colIndex: number, value: string): void {
    const row = this.rows[rowIndex] ?? [];
    row[colIndex] = value;
    this.rows[rowIndex] = row;
    void this.save();
  }

  private async save(): Promise<void> {
    await this.service.saveRows(this.rows);
    this.setStatus("保存しました");
  }

  private removeRow(rowIndex: number): void {
    this.rows.splice(rowIndex, 1);
    if (this.rows.length === 0) {
      this.rows.push([]);
    }
    void this.save().then(() => this.renderTable());
  }

  private autoResizeTextarea(textarea: HTMLTextAreaElement): void {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
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
