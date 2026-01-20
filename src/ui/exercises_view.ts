import { ItemView, WorkspaceLeaf } from "obsidian";
import { ExercisesService } from "../services/exercises_service";
import { MarkdownRepository } from "../services/markdown_repository";
import { TableSectionService } from "../services/table_section_service";
import { BASE_EXERCISE_SECTIONS, ExerciseSection } from "../services/exercise_sections";
import { BUILTIN_TEMPLATE_BY_VIEW } from "../services/section_templates";
import type LifePlannerPlugin from "../main";
import { attachDeleteMenu, enableTapToBlur, registerRowMenuClose } from "./interaction";
import { resolveLocalizedText } from "./i18n";
import { renderNavigation } from "./navigation";
import { EXERCISES_VIEW_TYPE } from "./view_types";
export { EXERCISES_VIEW_TYPE };

type PairItem = {
  key: string;
  value: string;
};

type QaItem = {
  question: string;
  answer: string;
};

export class ExercisesView extends ItemView {
  private plugin: LifePlannerPlugin;
  private exercisesService: ExercisesService;
  private listEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private statusTimer: number | null = null;
  private activeSectionTitle = BASE_EXERCISE_SECTIONS[0]?.title ?? "";
  private disposeMenuClose: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: LifePlannerPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.exercisesService = new ExercisesService(
      new MarkdownRepository(this.plugin.app),
      this.plugin.settings.storageDir,
      this.plugin.settings.defaultTags
    );
  }

  getViewType(): string {
    return EXERCISES_VIEW_TYPE;
  }

  getDisplayText(): string {
    return resolveLocalizedText({ ja: "演習", en: "Exercises" });
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();

    const view = container.createEl("div", {
      cls: "lifeplanner-view lifeplanner-exercises-view",
    });
    enableTapToBlur(view);
    view.createEl("h2", { text: resolveLocalizedText({ ja: "演習", en: "Exercises" }) });
    const exerciseSections = this.buildExerciseSections();
    const exerciseSectionTitles = exerciseSections.map((section) => section.title).filter(Boolean);
    if (
      exerciseSectionTitles.length > 0 &&
      !exerciseSectionTitles.includes(this.activeSectionTitle)
    ) {
      this.activeSectionTitle = exerciseSectionTitles[0];
    }
    renderNavigation(
      view,
      EXERCISES_VIEW_TYPE,
      (target) => {
        void this.plugin.navigateToTarget(target, this.leaf);
      },
      this.plugin.settings.hiddenTabs,
      this.plugin.settings.navLayout,
      {
        templateLabels: this.plugin.getTemplateLabelMap(),
        enabledTemplates: this.plugin.settings.enabledTemplates,
        activeExerciseSection: this.activeSectionTitle,
        activeTemplateId: BUILTIN_TEMPLATE_BY_VIEW.get(EXERCISES_VIEW_TYPE),
      }
    );

    this.statusEl = view.createEl("div", { cls: "lifeplanner-status lifeplanner-exercises-status" });
    this.listEl = view.createEl("div", { cls: "lifeplanner-exercises-list" });
    this.disposeMenuClose = registerRowMenuClose(view);
    await this.renderExercises();
    if (this.statusEl) {
      view.appendChild(this.statusEl);
    }
  }

  async onClose(): Promise<void> {
    this.listEl = null;
    this.statusEl = null;
    if (this.statusTimer) {
      window.clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
    this.disposeMenuClose?.();
    this.disposeMenuClose = null;
  }

  private buildExerciseSections(): ExerciseSection[] {
    const existing = new Set(
      BASE_EXERCISE_SECTIONS.map((section) => section.title.trim().toLowerCase())
    );
    const customSections = this.plugin.settings.customExerciseSections ?? [];
    const customDefs: ExerciseSection[] = [];
    for (const section of customSections) {
      const title = section.title?.trim();
      if (!title) {
        continue;
      }
      const normalized = title.toLowerCase();
      if (existing.has(normalized)) {
        continue;
      }
      if (!["pairs", "qa", "list"].includes(section.kind)) {
        continue;
      }
      existing.add(normalized);
      customDefs.push({
        title,
        kind: section.kind,
        defaultBody: "",
      });
    }
    const baseContent = BASE_EXERCISE_SECTIONS.filter((section) => section.kind !== "table");
    const baseTables = BASE_EXERCISE_SECTIONS.filter((section) => section.kind === "table");
    return [...baseContent, ...customDefs, ...baseTables];
  }

  private buildContentSectionDefs(
    exerciseSections: ExerciseSection[]
  ): { title: string; defaultBody: string; questions?: string[] }[] {
    return exerciseSections
      .filter((section): section is Exclude<ExerciseSection, { kind: "table" }> =>
        section.kind !== "table"
      )
      .map((section) => ({
        title: section.title,
        defaultBody: section.defaultBody,
        questions:
          section.kind === "list" ? section.legacyQuestions : section.questions ?? undefined,
      }));
  }

  private async renderExercises(): Promise<void> {
    if (!this.listEl) {
      return;
    }
    this.listEl.empty();
    const exerciseSections = this.buildExerciseSections();
    const contentSectionDefs = this.buildContentSectionDefs(exerciseSections);
    const sections = await this.exercisesService.loadSections(contentSectionDefs);
    const hasActive = exerciseSections.some(
      (sectionDef) => sectionDef.title === this.activeSectionTitle
    );
    if (!hasActive && exerciseSections[0]) {
      this.activeSectionTitle = exerciseSections[0].title;
    }
    const tabsRow = this.listEl.createEl("div", { cls: "lifeplanner-exercises-tabs-row" });
    const tabs = tabsRow.createEl("div", { cls: "lifeplanner-exercises-tabs" });
    const content = this.listEl.createEl("div", { cls: "lifeplanner-exercises-content" });

    const renderSection = async (sectionDef: ExerciseSection): Promise<void> => {
      content.empty();
      const section = content.createEl("div", { cls: "lifeplanner-exercises-item" });
      if (sectionDef.kind === "table") {
        section.createEl("h3", { text: sectionDef.title });
        await this.renderTableSection(section, sectionDef);
        return;
      }
      if (sectionDef.kind === "list") {
        this.renderListSection(section, sectionDef, sections, contentSectionDefs);
        return;
      }
      if (sectionDef.kind === "pairs") {
        this.renderPairsSection(section, sectionDef, sections, contentSectionDefs);
        return;
      }
      if (sectionDef.kind === "qa") {
        this.renderQaSection(section, sectionDef, sections, contentSectionDefs);
        return;
      }
      section.createEl("h3", { text: sectionDef.title });
      if (sectionDef.questions && sectionDef.questions.length > 0) {
        const savedLines = (sections[sectionDef.title] ?? "")
          .split("\n")
          .map((line) => line.trim());
        const answerMap = new Map<string, string>();
        savedLines.forEach((line) => {
          if (!line.startsWith("- ")) {
            return;
          }
          const content = line.replace(/^\-\s*/, "");
          const parts = content.split(":");
          if (parts.length < 2) {
            return;
          }
          const key = parts[0].trim();
          const value = parts.slice(1).join(":").trim();
          if (key) {
            answerMap.set(key, value);
          }
        });
        const grid = section.createEl("div", {
          cls:
            sectionDef.layout === "vertical"
              ? "lifeplanner-exercises-grid is-vertical"
              : "lifeplanner-exercises-grid",
        });
        sectionDef.questions.forEach((question) => {
          grid.createEl("div", { cls: "lifeplanner-exercises-question", text: question });
          const input = grid.createEl("textarea", { cls: "lifeplanner-exercises-answer" });
          input.rows = 3;
          input.value = answerMap.get(question) ?? "";
          input.addEventListener("input", () => {
            answerMap.set(question, input.value.trim());
            const lines: string[] = [];
            sectionDef.questions?.forEach((q) => {
              const value = answerMap.get(q) ?? "";
              lines.push(`- ${q}: ${value}`);
            });
            sections[sectionDef.title] = lines.join("\n");
            void this.exercisesService.saveSections(contentSectionDefs, sections);
            this.setStatus("保存しました");
          });
        });
      } else {
        const textarea = section.createEl("textarea");
        textarea.rows = 6;
        textarea.value = sections[sectionDef.title] ?? "";
        textarea.placeholder = "回答を記入";
        textarea.addEventListener("input", () => {
          sections[sectionDef.title] = textarea.value;
          void this.exercisesService.saveSections(contentSectionDefs, sections);
          this.setStatus("保存しました");
        });
      }
    };

    exerciseSections.forEach((sectionDef) => {
      const tab = tabs.createEl("button", {
        text: sectionDef.title,
        cls:
          sectionDef.title === this.activeSectionTitle
            ? "lifeplanner-exercises-tab is-active"
            : "lifeplanner-exercises-tab",
      });
      tab.setAttr("type", "button");
      tab.addEventListener("click", () => {
        this.activeSectionTitle = sectionDef.title;
        tabs.querySelectorAll(".lifeplanner-exercises-tab").forEach((btn) => {
          btn.classList.remove("is-active");
        });
        tab.classList.add("is-active");
        void renderSection(sectionDef);
      });
    });

    const initial =
      exerciseSections.find((sectionDef) => sectionDef.title === this.activeSectionTitle) ??
      exerciseSections[0];
    if (initial) {
      if (this.activeSectionTitle !== initial.title) {
        this.activeSectionTitle = initial.title;
      }
      await renderSection(initial);
    }
  }

  private async renderTableSection(
    container: HTMLElement,
    sectionDef: Extract<ExerciseSection, { kind: "table" }>
  ): Promise<void> {
    const service = new TableSectionService(
      new MarkdownRepository(this.plugin.app),
      sectionDef.tableType,
      sectionDef.title,
      sectionDef.columns,
      this.plugin.settings.storageDir,
      this.plugin.settings.defaultTags
    );
    const actions = container.createEl("div", { cls: "lifeplanner-table-actions" });
    const addButton = actions.createEl("button", { text: "追加" });
    const table = container.createEl("div", { cls: "lifeplanner-table-grid" });
    table.dataset.sectionType = sectionDef.tableType;
    table.style.gridTemplateColumns = sectionDef.columns
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
    const rows = await service.loadRows();
    if (rows.length === 0) {
      rows.push([]);
    }
    sectionDef.columns.forEach((column) => {
      table.createEl("div", {
        cls: "lifeplanner-table-cell lifeplanner-table-header",
        text: column.label,
      });
    });
    const setCell = (rowIndex: number, colIndex: number, value: string): void => {
      const row = rows[rowIndex] ?? [];
      row[colIndex] = value;
      rows[rowIndex] = row;
      void service.saveRows(rows);
      this.setStatus("保存しました");
    };
    rows.forEach((row, rowIndex) => {
      sectionDef.columns.forEach((column, colIndex) => {
        const cell = table.createEl("div", { cls: "lifeplanner-table-cell" });
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
            setCell(rowIndex, colIndex, select.value);
          });
        } else if (column.type === "checkbox") {
          const checkbox = cell.createEl("input", { type: "checkbox" });
          checkbox.checked = value === "x";
          checkbox.addEventListener("change", () => {
            setCell(rowIndex, colIndex, checkbox.checked ? "x" : "");
          });
        } else {
          const input = cell.createEl("input", { type: "text" });
          input.value = value;
          input.addEventListener("input", () => {
            setCell(rowIndex, colIndex, input.value);
          });
        }
      });
    });
    addButton.addEventListener("click", () => {
      rows.push([]);
      void service.saveRows(rows);
      void this.renderExercises();
    });
  }

  private renderListSection(
    container: HTMLElement,
    sectionDef: Extract<ExerciseSection, { kind: "list" }>,
    sections: Record<string, string>,
    sectionDefs: { title: string; defaultBody: string; questions?: string[] }[]
  ): void {
    const rawBody = sections[sectionDef.title] ?? "";
    const parsed = this.parseListItems(rawBody, sectionDef.legacyQuestions ?? []);
    const items = parsed.items.length > 0 ? [...parsed.items] : [""];
    const header = container.createEl("div", { cls: "lifeplanner-exercises-list-header" });
    header.createEl("h3", { text: sectionDef.title });
    const actions = header.createEl("div", { cls: "lifeplanner-exercises-list-actions" });
    const addButton = actions.createEl("button", { text: "追加" });
    const list = container.createEl("div", { cls: "lifeplanner-exercises-list-items" });

    const persist = (showStatus: boolean): void => {
      sections[sectionDef.title] = this.buildListBody(items);
      void this.exercisesService.saveSections(sectionDefs, sections).then(() => {
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
        const menuScope = this.listEl ?? container;
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
    if (parsed.usedLegacy) {
      persist(false);
    }
  }

  private renderPairsSection(
    container: HTMLElement,
    sectionDef: Extract<ExerciseSection, { kind: "pairs" }>,
    sections: Record<string, string>,
    sectionDefs: { title: string; defaultBody: string; questions?: string[] }[]
  ): void {
    const rawBody = sections[sectionDef.title] ?? "";
    const parsed = this.parsePairItems(rawBody);
    const items: PairItem[] =
      parsed.length > 0 ? parsed.map((item) => ({ ...item })) : [{ key: "", value: "" }];
    const header = container.createEl("div", { cls: "lifeplanner-exercises-list-header" });
    header.createEl("h3", { text: sectionDef.title });
    const actions = header.createEl("div", { cls: "lifeplanner-exercises-list-actions" });
    const addButton = actions.createEl("button", { text: "追加" });
    const list = container.createEl("div", { cls: "lifeplanner-exercises-pairs" });

    const persist = (showStatus: boolean): void => {
      sections[sectionDef.title] = this.buildPairBody(items);
      void this.exercisesService.saveSections(sectionDefs, sections).then(() => {
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
        const menuScope = this.listEl ?? container;
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

  private renderQaSection(
    container: HTMLElement,
    sectionDef: Extract<ExerciseSection, { kind: "qa" }>,
    sections: Record<string, string>,
    sectionDefs: { title: string; defaultBody: string; questions?: string[] }[]
  ): void {
    const rawBody = sections[sectionDef.title] ?? "";
    const parsed = this.parseQaItems(rawBody);
    const items: QaItem[] =
      parsed.length > 0
        ? parsed.map((item) => ({ ...item }))
        : [{ question: "", answer: "" }];
    const header = container.createEl("div", { cls: "lifeplanner-exercises-list-header" });
    header.createEl("h3", { text: sectionDef.title });
    const actions = header.createEl("div", { cls: "lifeplanner-exercises-list-actions" });
    const addButton = actions.createEl("button", { text: "追加" });
    const list = container.createEl("div", { cls: "lifeplanner-exercises-qa" });

    const persist = (showStatus: boolean): void => {
      sections[sectionDef.title] = this.buildQaBody(items);
      void this.exercisesService.saveSections(sectionDefs, sections).then(() => {
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
        const menuScope = this.listEl ?? container;
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
        items.push({ key: "", value });
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

  private parseListItems(
    rawBody: string,
    legacyQuestions: string[]
  ): { items: string[]; usedLegacy: boolean } {
    const items: string[] = [];
    let usedLegacy = false;
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
      const legacyQuestion = legacyQuestions.find((question) => value.startsWith(`${question}:`));
      if (legacyQuestion) {
        usedLegacy = true;
        const extracted = value.slice(legacyQuestion.length + 1).trim();
        if (extracted) {
          items.push(extracted);
        }
        continue;
      }
      if (legacyQuestions.includes(value)) {
        usedLegacy = true;
        continue;
      }
      items.push(value);
    }
    return { items, usedLegacy };
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

  setActiveSection(title: string): void {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }
    this.activeSectionTitle = trimmed;
    void this.renderExercises();
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
