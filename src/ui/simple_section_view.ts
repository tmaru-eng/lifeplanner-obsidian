import { ItemView, WorkspaceLeaf } from "obsidian";
import type LifePlannerPlugin from "../main";
import { MarkdownRepository } from "../services/markdown_repository";
import { SimpleSectionService } from "../services/simple_section_service";
import { renderNavigation } from "./navigation";
import { LifePlannerViewType } from "./view_types";

export class SimpleSectionView extends ItemView {
  private plugin: LifePlannerPlugin;
  private titleText: string;
  private viewType: LifePlannerViewType;
  private service: SimpleSectionService;
  private statusEl: HTMLElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;

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
    view.createEl("h2", { text: this.titleText });
    renderNavigation(view, this.viewType, (viewType) => {
      void this.plugin.openViewInLeaf(viewType, this.leaf);
    });
    this.statusEl = view.createEl("div", { cls: "lifeplanner-exercises-status" });
    this.inputEl = view.createEl("textarea");
    this.inputEl.rows = 12;
    this.inputEl.value = await this.service.load();
    this.inputEl.addEventListener("input", () => {
      void this.service.save(this.inputEl?.value ?? "");
      this.setStatus("保存しました");
    });
  }

  async onClose(): Promise<void> {
    this.statusEl = null;
    this.inputEl = null;
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
