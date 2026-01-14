import { ItemView, WorkspaceLeaf } from "obsidian";
import { ExercisesService } from "../services/exercises_service";
import { MarkdownRepository } from "../services/markdown_repository";
import { TableColumn, TableSectionService } from "../services/table_section_service";
import type LifePlannerPlugin from "../main";
import { renderNavigation } from "./navigation";
import { EXERCISES_VIEW_TYPE } from "./view_types";
export { EXERCISES_VIEW_TYPE };

type ExerciseSection =
  | {
      kind?: "questions";
      title: string;
      defaultBody: string;
      questions?: string[];
      layout?: "vertical";
    }
  | {
      kind: "table";
      title: string;
      tableType: "Quotes";
      columns: TableColumn[];
    };

const EXERCISE_SECTIONS: ExerciseSection[] = [
  {
    title: "価値観分析",
    defaultBody: "",
    questions: [
      "あなたはなぜ今の会社(学校)に入りましたか？",
      "あなたはなぜ今の趣味を始めたのですか？",
      "あなたはなぜこの場所に住んでるのですか？",
      "これまでに会った人で、ぜひもう一度会いたいと思う人は？",
      "あなたが一番好きな言葉は？",
      "あなたがこれまでに読んだ一番好きな本は？",
      "これまでの仕事で一番充実していたことは？いつ？どんな仕事？なぜ？",
      "家族との思い出で一番楽しかったことは？いつ？どんな内容？なぜ？",
      "人と接する上で何が一番大切ですか？",
      "失うと気力がなくなるものはなんですか？",
      "今後の人生において最も身につけたい才能や能力は何ですか？",
      "あなたがこれまで最もわくわくしたことはどのようなことでしたか？",
      "あなたが心のそこから「リラックス」できる時間はどのような時ですか？",
      "あなたの理想とする人は、何をもっとも大事にしているのでしょうか？",
      "人生の中で学ぶことの多かった失敗、挫折体験は何ですか？",
      "仕事とプライベートで共通して言える指針は何ですか？",
      "あなたの人生の中で、充実感の高かった成功体験はなんでしたか？",
      "毎日の生活で気をつけていることは何ですか？",
      "私生活で最も価値があると考える行動は何ですか？",
      "今、十分な時間があれば誰と何をしたいですか？",
      "これからの人生で一番実現したいことは何ですか？",
      "あなたの理想とする人生はどのようなことをして成し遂げた人ですか？",
      "あなたの人生の中で大きな影響を受けた人はどんな点が最も優れていましたか？",
    ],
    layout: "vertical",
  },
  {
    title: "余命1年リスト",
    defaultBody: "",
    questions: ["「余命1年」だったら何をしたい？"],
    layout: "vertical",
  },
  {
    title: "あと100年人生リスト",
    defaultBody: "",
    questions: ["健康体であと100年生きられるとしたら何をしたい？"],
    layout: "vertical",
  },
  {
    title: "死ぬまでにやりたいこと",
    defaultBody: "",
    questions: ["何をしたい？"],
    layout: "vertical",
  },
  {
    title: "立場を変えて考える",
    defaultBody: "",
    questions: [
      "誰の立場で考えますか？",
      "その人はあなたに対して何を望んでますか？何をいやだと思ってますか？",
      "望まれていることを実現するにはどうしたら良いですか？",
    ],
    layout: "vertical",
  },
  {
    title: "憧れの人物",
    defaultBody: "",
    questions: ["誰の？どんなところ？"],
    layout: "vertical",
  },
  {
    title: "20年後の自分へインタビュー",
    defaultBody: "",
    questions: [
      "誰と一緒でしたか？",
      "どのような車に乗り、どんな身なりでしたか？",
      "今現在どんな仕事をしているようでしたか？",
      "どんな所に住んでいそうでしたか？",
      "あなたが今一番大切なものは何ですか？",
      "あなたがそのような成功を収めたのはどうしてでしょうか？",
      "そのように運にも恵まれるには、あなたが何をしてきたからですか？",
      "今思えば何が転機でしたか？そこでどんな判断をしたのですか？",
      "今、何をしているときが一番楽しいですか？",
      "あなたを一番支えてくれた人は誰でしたか？",
    ],
    layout: "vertical",
  },
  {
    kind: "table",
    title: "心に残った言葉・座右の銘",
    tableType: "Quotes",
    columns: [
      {
        label: "種別",
        type: "select",
        options: ["心に残った言葉", "座右の銘"],
        width: "160px",
      },
      { label: "内容", type: "text", width: "minmax(260px, 1fr)" },
    ],
  },
];

export class ExercisesView extends ItemView {
  private plugin: LifePlannerPlugin;
  private exercisesService: ExercisesService;
  private listEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private activeSectionTitle = EXERCISE_SECTIONS[0]?.title ?? "";

  constructor(leaf: WorkspaceLeaf, plugin: LifePlannerPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.exercisesService = new ExercisesService(
      new MarkdownRepository(this.plugin.app),
      this.plugin.settings.storageDir
    );
  }

  getViewType(): string {
    return EXERCISES_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "演習";
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();

    const view = container.createEl("div", { cls: "lifeplanner-view" });
    view.createEl("h2", { text: "演習" });
    renderNavigation(view, (viewType) => {
      void this.plugin.openViewInLeaf(viewType, this.leaf);
    });

    this.statusEl = view.createEl("div", { cls: "lifeplanner-exercises-status" });
    this.listEl = view.createEl("div", { cls: "lifeplanner-exercises-list" });
    await this.renderExercises();
  }

  async onClose(): Promise<void> {
    this.listEl = null;
    this.statusEl = null;
  }

  private async renderExercises(): Promise<void> {
    if (!this.listEl) {
      return;
    }
    this.listEl.empty();
    const questionSections = EXERCISE_SECTIONS.filter(
      (section): section is Extract<ExerciseSection, { kind?: "questions" }> =>
        section.kind !== "table"
    );
    const sections = await this.exercisesService.loadSections(questionSections);
    const tabs = this.listEl.createEl("div", { cls: "lifeplanner-exercises-tabs" });
    const content = this.listEl.createEl("div", { cls: "lifeplanner-exercises-content" });

    const renderSection = async (sectionDef: ExerciseSection): Promise<void> => {
      content.empty();
      const section = content.createEl("div", { cls: "lifeplanner-exercises-item" });
      section.createEl("h3", { text: sectionDef.title });
      if (sectionDef.kind === "table") {
        await this.renderTableSection(section, sectionDef);
        return;
      }
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
            void this.exercisesService.saveSections(questionSections, sections);
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
          void this.exercisesService.saveSections(questionSections, sections);
          this.setStatus("保存しました");
        });
      }
    };

    EXERCISE_SECTIONS.forEach((sectionDef) => {
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
      EXERCISE_SECTIONS.find((sectionDef) => sectionDef.title === this.activeSectionTitle) ??
      EXERCISE_SECTIONS[0];
    if (initial) {
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
      this.plugin.settings.storageDir
    );
    const actions = container.createEl("div", { cls: "lifeplanner-table-actions" });
    const addButton = actions.createEl("button", { text: "追加" });
    const table = container.createEl("div", { cls: "lifeplanner-table-grid" });
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
