import { ItemView, MarkdownRenderer, WorkspaceLeaf } from "obsidian";
import type LifePlannerPlugin from "../main";
import { MarkdownRepository } from "../services/markdown_repository";
import { SimpleSectionService } from "../services/simple_section_service";
import { attachRowMenu, enableTapToBlur, registerRowMenuClose } from "./interaction";
import { renderNavigation } from "./navigation";
import { LifePlannerViewType } from "./view_types";

export class SimpleSectionView extends ItemView {
  private plugin: LifePlannerPlugin;
  private titleText: string;
  private viewType: LifePlannerViewType;
  private service: SimpleSectionService;
  private statusEl: HTMLElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private displayEl: HTMLElement | null = null;
  private viewEl: HTMLElement | null = null;
  private disposeMenuClose: (() => void) | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    plugin: LifePlannerPlugin,
    viewType: LifePlannerViewType,
    type: string,
    titleText: string
  ) {
    super(leaf);
    this.plugin = plugin;
    this.viewType = viewType;
    this.titleText = titleText;
    this.service = new SimpleSectionService(
      new MarkdownRepository(this.plugin.app),
      type as never,
      titleText,
      this.plugin.settings.storageDir,
      this.plugin.settings.defaultTags
    );
  }

  getDisplayText(): string {
    return this.titleText;
  }

  getViewType(): string {
    return this.viewType;
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
    const body = view.createEl("div", { cls: "lifeplanner-simple-section-body" });
    const hero = body.createEl("div", { cls: "lifeplanner-simple-section-hero" });
    const actions = hero.createEl("div", { cls: "lifeplanner-simple-section-actions" });
    this.displayEl = hero.createEl("div", { cls: "lifeplanner-simple-section-display" });
    this.inputEl = hero.createEl("textarea", { cls: "lifeplanner-simple-section-input" });
    this.inputEl.rows = 12;
    this.inputEl.value = await this.service.load();

    const updateDisplay = (): void => {
      if (!this.displayEl || !this.inputEl) {
        return;
      }
      this.displayEl.empty();
      const value = this.inputEl.value.trim();
      if (!value) {
        this.displayEl.setText("(未記入)");
        this.displayEl.classList.add("is-empty");
        return;
      }
      this.displayEl.classList.remove("is-empty");
      void MarkdownRenderer.renderMarkdown(value, this.displayEl, "", this);
    };

    const setEditMode = (editing: boolean): void => {
      if (!this.displayEl || !this.inputEl) {
        return;
      }
      this.inputEl.classList.toggle("lifeplanner-hidden", !editing);
      this.displayEl.classList.toggle("lifeplanner-hidden", editing);
      if (editing) {
        this.inputEl.focus();
      }
    };

    attachRowMenu(actions, view, [
      {
        label: "編集",
        onSelect: () => setEditMode(true),
      },
      {
        label: "削除",
        onSelect: () => {
          if (!this.inputEl) {
            return;
          }
          this.inputEl.value = "";
          void this.service.save("");
          updateDisplay();
          setEditMode(false);
          this.setStatus("削除しました");
        },
      },
    ]);

    this.inputEl.addEventListener("input", () => {
      void this.service.save(this.inputEl?.value ?? "");
      updateDisplay();
      this.setStatus("保存しました");
    });
    this.inputEl.addEventListener("blur", () => {
      updateDisplay();
      setEditMode(false);
    });

    updateDisplay();
    setEditMode(false);
  }

  async onClose(): Promise<void> {
    this.statusEl = null;
    this.inputEl = null;
    this.displayEl = null;
    this.viewEl = null;
    this.disposeMenuClose?.();
    this.disposeMenuClose = null;
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
