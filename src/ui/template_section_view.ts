import { ItemView, MarkdownRenderer, WorkspaceLeaf } from "obsidian";
import type LifePlannerPlugin from "../main";
import { MarkdownRepository } from "../services/markdown_repository";
import type { CustomTemplateDefinition } from "../services/section_templates";
import { TemplateSectionService } from "../services/template_section_service";
import { attachDeleteMenu, attachRowMenu, enableTapToBlur, registerRowMenuClose } from "./interaction";
import { renderNavigation } from "./navigation";
import { TEMPLATE_SECTION_VIEW_TYPE } from "./view_types";

export { TEMPLATE_SECTION_VIEW_TYPE };

type PairItem = {
  key: string;
  value: string;
};

type QaItem = {
  question: string;
  answer: string;
};

type TemplateViewState = {
  templateId: string;
};

export class TemplateSectionView extends ItemView {
  private plugin: LifePlannerPlugin;
  private templateId = "";
  private template: CustomTemplateDefinition | null = null;
  private service: TemplateSectionService | null = null;
  private statusEl: HTMLElement | null = null;
  private statusTimer: number | null = null;
  private disposeMenuClose: (() => void) | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private displayEl: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: LifePlannerPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return TEMPLATE_SECTION_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.template?.label ?? "テンプレート";
  }

  getState(): TemplateViewState {
    return { templateId: this.templateId };
  }

  async setState(state: TemplateViewState): Promise<void> {
    const nextId = state?.templateId ?? "";
    if (nextId !== this.templateId) {
      this.templateId = nextId;
    }
    await this.renderView();
  }

  async onOpen(): Promise<void> {
    const state = this.leaf.getViewState().state as Partial<TemplateViewState> | null;
    if (state?.templateId) {
      this.templateId = state.templateId;
    }
    await this.renderView();
  }

  async onClose(): Promise<void> {
    this.cleanup();
  }

  private cleanup(): void {
    this.statusEl = null;
    this.inputEl = null;
    this.displayEl = null;
    this.template = null;
    this.service = null;
    this.disposeMenuClose?.();
    this.disposeMenuClose = null;
    if (this.statusTimer) {
      window.clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
  }

  private async renderView(): Promise<void> {
    this.cleanup();
    const container = this.contentEl;
    container.empty();

    const view = container.createEl("div", { cls: "lifeplanner-view" });
    enableTapToBlur(view);
    this.disposeMenuClose = registerRowMenuClose(view);

    const template = this.findTemplate();
    this.template = template;
    const title = template?.label ?? "テンプレート";

    view.createEl("h2", { text: title });
    renderNavigation(
      view,
      TEMPLATE_SECTION_VIEW_TYPE,
      (target) => {
        void this.plugin.navigateToTarget(target, this.leaf);
      },
      this.plugin.settings.hiddenTabs,
      this.plugin.settings.navLayout,
      {
        templateLabels: this.plugin.getTemplateLabelMap(),
        enabledTemplates: this.plugin.settings.enabledTemplates,
        activeTemplateId: this.templateId,
      }
    );

    const body = view.createEl("div", { cls: "lifeplanner-simple-section-body" });
    this.statusEl = view.createEl("div", {
      cls: "lifeplanner-status lifeplanner-template-status",
    });

    if (!template) {
      body.createEl("div", {
        cls: "lifeplanner-settings-muted",
        text: "テンプレートが見つかりません。",
      });
      return;
    }

    this.service = new TemplateSectionService(
      new MarkdownRepository(this.plugin.app),
      template.id,
      template.label,
      this.plugin.settings.storageDir,
      this.plugin.settings.defaultTags,
      {
        selectOptions: template.format === "select" ? template.selectOptions : undefined,
      }
    );

    if (template.format === "free") {
      await this.renderFreeSection(body);
    } else if (template.format === "list") {
      await this.renderListSection(body);
    } else if (template.format === "pairs") {
      await this.renderPairsSection(body);
    } else if (template.format === "select") {
      await this.renderSelectSection(body, template);
    } else if (template.format === "qa") {
      await this.renderQaSection(body);
    }

    if (this.statusEl) {
      view.appendChild(this.statusEl);
    }
  }

  private findTemplate(): CustomTemplateDefinition | null {
    if (!this.templateId) {
      return null;
    }
    return this.plugin.settings.customTemplates.find(
      (template) => template.id === this.templateId
    ) ?? null;
  }

  private async renderFreeSection(container: HTMLElement): Promise<void> {
    if (!this.service) {
      return;
    }
    const hero = container.createEl("div", { cls: "lifeplanner-simple-section-hero" });
    const actions = hero.createEl("div", { cls: "lifeplanner-simple-section-actions" });
    this.displayEl = hero.createEl("div", {
      cls: "lifeplanner-simple-section-display lifeplanner-markdown",
    });
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

    attachRowMenu(actions, container, [
      {
        label: "編集",
        onSelect: () => setEditMode(true),
      },
      {
        label: "削除",
        onSelect: () => {
          if (!this.inputEl || !this.service) {
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
      if (!this.service) {
        return;
      }
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

  private async renderListSection(container: HTMLElement): Promise<void> {
    if (!this.service) {
      return;
    }
    const rawBody = await this.service.load();
    const parsed = this.parseListItems(rawBody);
    const items = parsed.length > 0 ? [...parsed] : [""];
    const header = container.createEl("div", { cls: "lifeplanner-exercises-list-header" });
    header.createEl("h3", { text: this.template?.label ?? "" });
    const actions = header.createEl("div", { cls: "lifeplanner-exercises-list-actions" });
    const addButton = actions.createEl("button", { text: "追加" });
    const list = container.createEl("div", { cls: "lifeplanner-exercises-list-items" });

    const persist = (showStatus: boolean): void => {
      if (!this.service) {
        return;
      }
      void this.service.save(this.buildListBody(items)).then(() => {
        if (showStatus) {
          this.setStatus("保存しました");
        }
      });
    };

    const renderRows = (): void => {
      list.empty();
      items.forEach((value, index) => {
        const row = list.createEl("div", { cls: "lifeplanner-exercises-list-row" });
        const input = row.createEl("textarea", { cls: "lifeplanner-exercises-list-input" });
        input.rows = 1;
        input.value = value;
        this.autoResizeTextarea(input);
        input.addEventListener("input", () => {
          items[index] = input.value;
          this.autoResizeTextarea(input);
          persist(true);
        });
        const menuScope = container;
        attachDeleteMenu(row, menuScope, () => {
          items.splice(index, 1);
          if (items.length === 0) {
            items.push("");
          }
          renderRows();
          persist(true);
        });
      });
    };

    addButton.addEventListener("click", () => {
      items.push("");
      renderRows();
    });

    renderRows();
  }

  private async renderPairsSection(container: HTMLElement): Promise<void> {
    if (!this.service) {
      return;
    }
    const rawBody = await this.service.load();
    const parsed = this.parsePairItems(rawBody);
    const items: PairItem[] =
      parsed.length > 0 ? parsed.map((item) => ({ ...item })) : [{ key: "", value: "" }];
    const header = container.createEl("div", { cls: "lifeplanner-exercises-list-header" });
    header.createEl("h3", { text: this.template?.label ?? "" });
    const actions = header.createEl("div", { cls: "lifeplanner-exercises-list-actions" });
    const addButton = actions.createEl("button", { text: "追加" });
    const list = container.createEl("div", { cls: "lifeplanner-exercises-pairs" });

    const persist = (showStatus: boolean): void => {
      if (!this.service) {
        return;
      }
      void this.service.save(this.buildPairBody(items)).then(() => {
        if (showStatus) {
          this.setStatus("保存しました");
        }
      });
    };

    const renderRows = (): void => {
      list.empty();
      items.forEach((item, index) => {
        const row = list.createEl("div", { cls: "lifeplanner-exercises-pair-row" });
        const keyInput = row.createEl("textarea", { cls: "lifeplanner-exercises-pair-key" });
        keyInput.rows = 1;
        keyInput.placeholder = "項目";
        keyInput.value = item.key;
        this.autoResizeTextarea(keyInput);
        const valueInput = row.createEl("textarea", {
          cls: "lifeplanner-exercises-pair-value",
        });
        valueInput.rows = 1;
        valueInput.placeholder = "内容";
        valueInput.value = item.value;
        this.autoResizeTextarea(valueInput);
        keyInput.addEventListener("input", () => {
          items[index].key = keyInput.value;
          this.autoResizeTextarea(keyInput);
          persist(true);
        });
        valueInput.addEventListener("input", () => {
          items[index].value = valueInput.value;
          this.autoResizeTextarea(valueInput);
          persist(true);
        });
        const menuScope = container;
        attachDeleteMenu(row, menuScope, () => {
          items.splice(index, 1);
          if (items.length === 0) {
            items.push({ key: "", value: "" });
          }
          renderRows();
          persist(true);
        });
      });
    };

    addButton.addEventListener("click", () => {
      items.push({ key: "", value: "" });
      renderRows();
    });

    renderRows();
  }

  private async renderSelectSection(
    container: HTMLElement,
    template: CustomTemplateDefinition
  ): Promise<void> {
    if (!this.service) {
      return;
    }
    const rawBody = await this.service.load();
    const parsed = this.parsePairItems(rawBody);
    const options = template.selectOptions ?? [];
    const fallbackKey = options[0] ?? "";
    const items: PairItem[] =
      parsed.length > 0
        ? parsed.map((item) => ({ ...item }))
        : [{ key: fallbackKey, value: "" }];
    const header = container.createEl("div", { cls: "lifeplanner-exercises-list-header" });
    header.createEl("h3", { text: template.label });
    const actions = header.createEl("div", { cls: "lifeplanner-exercises-list-actions" });
    const addButton = actions.createEl("button", { text: "追加" });
    const list = container.createEl("div", { cls: "lifeplanner-exercises-pairs" });

    const persist = (showStatus: boolean): void => {
      if (!this.service) {
        return;
      }
      void this.service.save(this.buildPairBody(items)).then(() => {
        if (showStatus) {
          this.setStatus("保存しました");
        }
      });
    };

    const renderRows = (): void => {
      list.empty();
      items.forEach((item, index) => {
        const row = list.createEl("div", { cls: "lifeplanner-exercises-pair-row" });
        const keySelect = row.createEl("select", { cls: "lifeplanner-exercises-pair-key" });
        const availableOptions = options.includes(item.key)
          ? options
          : [...options, item.key].filter((option) => option.length > 0);
        availableOptions.forEach((option) => {
          keySelect.createEl("option", { text: option, value: option });
        });
        keySelect.value = item.key || fallbackKey;
        keySelect.addEventListener("change", () => {
          items[index].key = keySelect.value;
          persist(true);
        });
        const valueInput = row.createEl("textarea", {
          cls: "lifeplanner-exercises-pair-value",
        });
        valueInput.rows = 1;
        valueInput.placeholder = "内容";
        valueInput.value = item.value;
        this.autoResizeTextarea(valueInput);
        valueInput.addEventListener("input", () => {
          items[index].value = valueInput.value;
          this.autoResizeTextarea(valueInput);
          persist(true);
        });
        const menuScope = container;
        attachDeleteMenu(row, menuScope, () => {
          items.splice(index, 1);
          if (items.length === 0) {
            items.push({ key: fallbackKey, value: "" });
          }
          renderRows();
          persist(true);
        });
      });
    };

    addButton.addEventListener("click", () => {
      items.push({ key: fallbackKey, value: "" });
      renderRows();
    });

    renderRows();
  }

  private async renderQaSection(container: HTMLElement): Promise<void> {
    if (!this.service) {
      return;
    }
    const rawBody = await this.service.load();
    const parsed = this.parseQaItems(rawBody);
    const items: QaItem[] =
      parsed.length > 0
        ? parsed.map((item) => ({ ...item }))
        : [{ question: "", answer: "" }];
    const header = container.createEl("div", { cls: "lifeplanner-exercises-list-header" });
    header.createEl("h3", { text: this.template?.label ?? "" });
    const actions = header.createEl("div", { cls: "lifeplanner-exercises-list-actions" });
    const addButton = actions.createEl("button", { text: "追加" });
    const list = container.createEl("div", { cls: "lifeplanner-exercises-qa" });

    const persist = (showStatus: boolean): void => {
      if (!this.service) {
        return;
      }
      void this.service.save(this.buildQaBody(items)).then(() => {
        if (showStatus) {
          this.setStatus("保存しました");
        }
      });
    };

    const renderRows = (): void => {
      list.empty();
      items.forEach((item, index) => {
        const row = list.createEl("div", { cls: "lifeplanner-exercises-qa-row" });
        const questionInput = row.createEl("textarea", {
          cls: "lifeplanner-exercises-qa-question",
        });
        questionInput.rows = 1;
        questionInput.placeholder = "質問";
        questionInput.value = item.question;
        this.autoResizeTextarea(questionInput);
        const answerInput = row.createEl("textarea", {
          cls: "lifeplanner-exercises-qa-answer",
        });
        answerInput.rows = 3;
        answerInput.placeholder = "解答";
        answerInput.value = item.answer;
        this.autoResizeTextarea(answerInput);
        questionInput.addEventListener("input", () => {
          items[index].question = questionInput.value;
          this.autoResizeTextarea(questionInput);
          persist(true);
        });
        answerInput.addEventListener("input", () => {
          items[index].answer = answerInput.value;
          this.autoResizeTextarea(answerInput);
          persist(true);
        });
        const menuScope = container;
        attachDeleteMenu(row, menuScope, () => {
          items.splice(index, 1);
          if (items.length === 0) {
            items.push({ question: "", answer: "" });
          }
          renderRows();
          persist(true);
        });
      });
    };

    addButton.addEventListener("click", () => {
      items.push({ question: "", answer: "" });
      renderRows();
    });

    renderRows();
  }

  private parsePairItems(rawBody: string): PairItem[] {
    const items: PairItem[] = [];
    const lines = rawBody.split("\n");
    for (const line of lines) {
      let value = line.trim();
      if (!value || value === "-") {
        continue;
      }
      if (value.startsWith("- ")) {
        value = value.slice(2).trim();
      }
      if (!value || value === "-") {
        continue;
      }
      const separatorIndex = value.indexOf(":");
      if (separatorIndex === -1) {
        items.push({ key: value, value: "" });
        continue;
      }
      const key = value.slice(0, separatorIndex).trim();
      const itemValue = value.slice(separatorIndex + 1).trim();
      if (!key && !itemValue) {
        continue;
      }
      items.push({ key, value: itemValue });
    }
    return items;
  }

  private buildPairBody(items: PairItem[]): string {
    const cleaned = items
      .map((item) => ({
        key: item.key.replace(/\s*\n\s*/g, " ").trim(),
        value: item.value.replace(/\s*\n\s*/g, " ").trim(),
      }))
      .filter((item) => item.key.length > 0 || item.value.length > 0);
    return cleaned
      .map((item) => {
        if (!item.key && item.value) {
          return `- ${item.value}`;
        }
        if (item.value) {
          return `- ${item.key}: ${item.value}`;
        }
        return `- ${item.key}:`;
      })
      .join("\n");
  }

  private parseQaItems(rawBody: string): QaItem[] {
    const items: QaItem[] = [];
    const lines = rawBody.split("\n");
    let current: { question: string; answerLines: string[] } | null = null;
    const flush = (): void => {
      if (!current) {
        return;
      }
      const question = current.question.trim();
      const answer = current.answerLines.join("\n").trim();
      if (question || answer) {
        items.push({ question, answer });
      }
      current = null;
    };
    for (const line of lines) {
      if (line.trim().length === 0) {
        if (current) {
          current.answerLines.push("");
        }
        continue;
      }
      if (/^-\s+/.test(line)) {
        flush();
        const rawQuestion = line.replace(/^-\s+/, "").trim();
        let question = rawQuestion;
        let inlineAnswer = "";
        const inlineIndex = rawQuestion.indexOf(": ");
        if (inlineIndex > 0) {
          const candidateQuestion = rawQuestion.slice(0, inlineIndex).trim();
          const candidateAnswer = rawQuestion.slice(inlineIndex + 2).trim();
          if (candidateQuestion && candidateAnswer) {
            question = candidateQuestion;
            inlineAnswer = candidateAnswer;
          }
        }
        current = {
          question,
          answerLines: inlineAnswer ? [inlineAnswer] : [],
        };
        continue;
      }
      if (!current) {
        current = { question: line.trim(), answerLines: [] };
        continue;
      }
      current.answerLines.push(line.replace(/^\s+/, "").trimEnd());
    }
    flush();
    return items;
  }

  private buildQaBody(items: QaItem[]): string {
    const lines: string[] = [];
    items.forEach((item) => {
      const rawQuestion = item.question.replace(/\s*\n\s*/g, " ").trim();
      const rawAnswer = item.answer.replace(/\s+$/g, "");
      let question = rawQuestion;
      let answer = rawAnswer.trim();
      if (!question && !answer) {
        return;
      }
      if (!question && answer) {
        const answerLines = answer.split("\n");
        question = answerLines.shift()?.trim() ?? "";
        answer = answerLines.join("\n").trim();
      }
      if (!question) {
        return;
      }
      lines.push(`- ${question}`);
      if (answer) {
        answer.split("\n").forEach((line) => {
          lines.push(`  ${line.replace(/\s+$/g, "")}`);
        });
      }
    });
    return lines.join("\n");
  }

  private parseListItems(rawBody: string): string[] {
    const items: string[] = [];
    const lines = rawBody.split("\n");
    for (const line of lines) {
      let value = line.trim();
      if (!value || value === "-") {
        continue;
      }
      if (value.startsWith("- ")) {
        value = value.slice(2).trim();
      }
      if (!value || value === "-") {
        continue;
      }
      items.push(value);
    }
    return items;
  }

  private buildListBody(items: string[]): string {
    const cleaned = items
      .map((item) => item.replace(/\s*\n\s*/g, " ").trim())
      .filter((item) => item.length > 0);
    return cleaned.map((item) => `- ${item}`).join("\n");
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
    this.statusEl.classList.add("is-visible");
    if (this.statusTimer) {
      window.clearTimeout(this.statusTimer);
    }
    this.statusTimer = window.setTimeout(() => {
      this.statusEl?.classList.remove("is-visible");
      this.statusEl?.setText("");
      this.statusTimer = null;
    }, 3500);
  }
}
