"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => LifePlannerPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian11 = require("obsidian");

// src/ui/exercises_view.ts
var import_obsidian2 = require("obsidian");

// src/storage/path_resolver.ts
var TEMPLATE_PREFIX = "LifePlanner";
function resolveLifePlannerPath(type, baseDir = "LifePlanner") {
  const dir = normalizeBaseDir(baseDir);
  const filename = `${TEMPLATE_PREFIX} - ${type}.md`;
  return dir ? `${dir}/${filename}` : filename;
}
function resolveWeeklyPlanPath(weekStart, baseDir = "LifePlanner") {
  const dir = normalizeBaseDir(baseDir);
  const formatted = formatDate(weekStart);
  const filename = `${TEMPLATE_PREFIX} - Weekly - ${formatted}.md`;
  return dir ? `${dir}/${filename}` : filename;
}
function formatDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function normalizeBaseDir(value) {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
  return trimmed;
}

// src/services/exercises_service.ts
var ExercisesService = class {
  constructor(repository, baseDir) {
    this.repository = repository;
    this.baseDir = baseDir;
  }
  async loadSections(sectionDefs) {
    const resolved = resolveLifePlannerPath("Exercises", this.baseDir);
    const content = await this.repository.read(resolved);
    if (!content) {
      const seed = serializeSections(sectionDefs, {});
      await this.repository.write(resolved, seed);
      return buildSectionMap(sectionDefs, {});
    }
    const parsed = parseSections(content);
    const normalized = normalizeSections(sectionDefs, parsed);
    return buildSectionMap(sectionDefs, normalized);
  }
  async saveSections(sectionDefs, sections) {
    const content = serializeSections(sectionDefs, sections);
    await this.repository.write(resolveLifePlannerPath("Exercises", this.baseDir), content);
  }
};
function parseSections(content) {
  const sections = {};
  const lines = content.split("\n");
  let currentTitle = "";
  let body = [];
  const flush = () => {
    if (!currentTitle) {
      return;
    }
    sections[currentTitle] = body.join("\n").trim();
  };
  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      flush();
      currentTitle = headingMatch[1].trim();
      body = [];
      continue;
    }
    if (!currentTitle) {
      continue;
    }
    body.push(line);
  }
  flush();
  return sections;
}
function serializeSections(sectionDefs, sections) {
  const lines = [];
  lines.push("# Exercises");
  lines.push("");
  for (const section of sectionDefs) {
    const body = sections[section.title] ?? section.defaultBody;
    lines.push(`## ${section.title}`);
    lines.push("");
    if (body && body.trim().length > 0) {
      lines.push(body.trim());
    } else {
      lines.push("- ");
    }
    lines.push("");
  }
  return lines.join("\n");
}
function buildSectionMap(sectionDefs, parsed) {
  const result = {};
  for (const section of sectionDefs) {
    result[section.title] = parsed[section.title] ?? section.defaultBody;
  }
  return result;
}
function normalizeSections(sectionDefs, parsed) {
  const normalized = { ...parsed };
  for (const section of sectionDefs) {
    if (!section.questions || section.questions.length === 0) {
      continue;
    }
    const raw = normalized[section.title];
    if (!raw) {
      continue;
    }
    const lines = raw.split("\n").map((line) => line.trim());
    const filtered = lines.filter((line) => !section.questions?.includes(line));
    normalized[section.title] = filtered.join("\n").trim();
  }
  return normalized;
}

// src/storage/markdown_storage.ts
var import_obsidian = require("obsidian");
var MarkdownStorage = class {
  constructor(app) {
    this.app = app;
  }
  async read(path) {
    if (!isSafePath(path)) {
      throw new Error(`Unsafe path: ${path}`);
    }
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file || !(file instanceof import_obsidian.TFile)) {
      return "";
    }
    return this.app.vault.read(file);
  }
  async write(path, content) {
    if (!isSafePath(path)) {
      throw new Error(`Unsafe path: ${path}`);
    }
    const normalized = content.replace(/\r\n?/g, "\n");
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file && file instanceof import_obsidian.TFile) {
      await this.app.vault.modify(file, normalized);
      return;
    }
    await this.ensureFolder(path);
    await this.app.vault.create(path, normalized);
  }
  async ensureFolder(path) {
    const parts = path.split("/");
    if (parts.length <= 1) {
      return;
    }
    const folders = parts.slice(0, -1);
    let current = "";
    for (const folder of folders) {
      current = current ? `${current}/${folder}` : folder;
      const existing = this.app.vault.getAbstractFileByPath(current);
      if (existing && existing instanceof import_obsidian.TFolder) {
        continue;
      }
      if (!existing) {
        await this.app.vault.createFolder(current);
      }
    }
  }
};
function isSafePath(path) {
  if (!path) {
    return false;
  }
  if (path.startsWith("/") || path.startsWith("\\")) {
    return false;
  }
  if (path.includes("..")) {
    return false;
  }
  return true;
}

// src/services/markdown_repository.ts
var MarkdownRepository = class {
  constructor(app) {
    this.storage = new MarkdownStorage(app);
  }
  async read(path) {
    return this.storage.read(path);
  }
  async write(path, content) {
    await this.storage.write(path, content);
  }
};

// src/services/table_section_service.ts
var TableSectionService = class {
  constructor(repository, type, title, columns, baseDir) {
    this.repository = repository;
    this.type = type;
    this.title = title;
    this.columns = columns;
    this.baseDir = baseDir;
  }
  async loadRows() {
    const content = await this.repository.read(resolveLifePlannerPath(this.type, this.baseDir));
    if (!content) {
      const seed = this.serializeRows([]);
      await this.repository.write(resolveLifePlannerPath(this.type, this.baseDir), seed);
      return [];
    }
    return parseTable(content);
  }
  async saveRows(rows) {
    const content = this.serializeRows(rows);
    await this.repository.write(resolveLifePlannerPath(this.type, this.baseDir), content);
  }
  serializeRows(rows) {
    const lines = [];
    lines.push(`# ${this.title}`);
    lines.push("");
    const headers = this.columns.map((col) => col.label);
    lines.push(`| ${headers.join(" | ")} |`);
    lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
    if (rows.length === 0) {
      lines.push(`| ${headers.map(() => "").join(" | ")} |`);
    } else {
      rows.forEach((row) => {
        const cells = headers.map((_, index) => row[index] ?? "");
        lines.push(`| ${cells.join(" | ")} |`);
      });
    }
    lines.push("");
    return lines.join("\n");
  }
};
function parseTable(content) {
  const lines = content.split("\n");
  const tableLines = lines.filter((line) => line.trim().startsWith("|"));
  if (tableLines.length < 2) {
    return [];
  }
  const dataLines = tableLines.slice(2);
  const rows = [];
  for (const line of dataLines) {
    const cells = line.split("|").map((cell) => cell.trim()).filter((_, index, arr) => index !== 0 && index !== arr.length - 1);
    if (cells.length === 0) {
      continue;
    }
    rows.push(cells);
  }
  return rows;
}

// src/ui/view_types.ts
var WEEKLY_PLAN_VIEW_TYPE = "lifeplanner-weekly-plan";
var INBOX_VIEW_TYPE = "lifeplanner-inbox";
var GOALS_VIEW_TYPE = "lifeplanner-goals";
var GOAL_TASK_VIEW_TYPE = "lifeplanner-goal-task";
var EXERCISES_VIEW_TYPE = "lifeplanner-exercises";
var ISSUES_VIEW_TYPE = "lifeplanner-issues";
var MISSION_VIEW_TYPE = "lifeplanner-mission";
var HAVE_DO_BE_VIEW_TYPE = "lifeplanner-have-do-be";
var PROMISE_VIEW_TYPE = "lifeplanner-promise";
var VALUES_VIEW_TYPE = "lifeplanner-values";

// src/ui/navigation.ts
var NAV_ITEMS = [
  { label: "\u9031\u9593\u8A08\u753B", viewType: WEEKLY_PLAN_VIEW_TYPE },
  { label: "\u30A2\u30AF\u30B7\u30E7\u30F3\u30D7\u30E9\u30F3", viewType: GOAL_TASK_VIEW_TYPE },
  { label: "\u30A4\u30B7\u30E5\u30FC", viewType: ISSUES_VIEW_TYPE },
  { label: "Inbox", viewType: INBOX_VIEW_TYPE },
  { label: "\u76EE\u6A19", viewType: GOALS_VIEW_TYPE },
  { label: "\u30DF\u30C3\u30B7\u30E7\u30F3", viewType: MISSION_VIEW_TYPE },
  { label: "\u4FA1\u5024\u89B3", viewType: VALUES_VIEW_TYPE },
  { label: "Have/Do/Be", viewType: HAVE_DO_BE_VIEW_TYPE },
  { label: "\u7D04\u675F", viewType: PROMISE_VIEW_TYPE },
  { label: "\u6F14\u7FD2", viewType: EXERCISES_VIEW_TYPE }
];
function renderNavigation(container, onNavigate) {
  const nav = container.createEl("div", { cls: "lifeplanner-nav" });
  for (const item of NAV_ITEMS) {
    const button = nav.createEl("button", { text: item.label });
    button.addEventListener("click", () => onNavigate(item.viewType));
  }
}

// src/ui/exercises_view.ts
var EXERCISE_SECTIONS = [
  {
    title: "\u4FA1\u5024\u89B3\u5206\u6790",
    defaultBody: "",
    questions: [
      "\u3042\u306A\u305F\u306F\u306A\u305C\u4ECA\u306E\u4F1A\u793E(\u5B66\u6821)\u306B\u5165\u308A\u307E\u3057\u305F\u304B\uFF1F",
      "\u3042\u306A\u305F\u306F\u306A\u305C\u4ECA\u306E\u8DA3\u5473\u3092\u59CB\u3081\u305F\u306E\u3067\u3059\u304B\uFF1F",
      "\u3042\u306A\u305F\u306F\u306A\u305C\u3053\u306E\u5834\u6240\u306B\u4F4F\u3093\u3067\u308B\u306E\u3067\u3059\u304B\uFF1F",
      "\u3053\u308C\u307E\u3067\u306B\u4F1A\u3063\u305F\u4EBA\u3067\u3001\u305C\u3072\u3082\u3046\u4E00\u5EA6\u4F1A\u3044\u305F\u3044\u3068\u601D\u3046\u4EBA\u306F\uFF1F",
      "\u3042\u306A\u305F\u304C\u4E00\u756A\u597D\u304D\u306A\u8A00\u8449\u306F\uFF1F",
      "\u3042\u306A\u305F\u304C\u3053\u308C\u307E\u3067\u306B\u8AAD\u3093\u3060\u4E00\u756A\u597D\u304D\u306A\u672C\u306F\uFF1F",
      "\u3053\u308C\u307E\u3067\u306E\u4ED5\u4E8B\u3067\u4E00\u756A\u5145\u5B9F\u3057\u3066\u3044\u305F\u3053\u3068\u306F\uFF1F\u3044\u3064\uFF1F\u3069\u3093\u306A\u4ED5\u4E8B\uFF1F\u306A\u305C\uFF1F",
      "\u5BB6\u65CF\u3068\u306E\u601D\u3044\u51FA\u3067\u4E00\u756A\u697D\u3057\u304B\u3063\u305F\u3053\u3068\u306F\uFF1F\u3044\u3064\uFF1F\u3069\u3093\u306A\u5185\u5BB9\uFF1F\u306A\u305C\uFF1F",
      "\u4EBA\u3068\u63A5\u3059\u308B\u4E0A\u3067\u4F55\u304C\u4E00\u756A\u5927\u5207\u3067\u3059\u304B\uFF1F",
      "\u5931\u3046\u3068\u6C17\u529B\u304C\u306A\u304F\u306A\u308B\u3082\u306E\u306F\u306A\u3093\u3067\u3059\u304B\uFF1F",
      "\u4ECA\u5F8C\u306E\u4EBA\u751F\u306B\u304A\u3044\u3066\u6700\u3082\u8EAB\u306B\u3064\u3051\u305F\u3044\u624D\u80FD\u3084\u80FD\u529B\u306F\u4F55\u3067\u3059\u304B\uFF1F",
      "\u3042\u306A\u305F\u304C\u3053\u308C\u307E\u3067\u6700\u3082\u308F\u304F\u308F\u304F\u3057\u305F\u3053\u3068\u306F\u3069\u306E\u3088\u3046\u306A\u3053\u3068\u3067\u3057\u305F\u304B\uFF1F",
      "\u3042\u306A\u305F\u304C\u5FC3\u306E\u305D\u3053\u304B\u3089\u300C\u30EA\u30E9\u30C3\u30AF\u30B9\u300D\u3067\u304D\u308B\u6642\u9593\u306F\u3069\u306E\u3088\u3046\u306A\u6642\u3067\u3059\u304B\uFF1F",
      "\u3042\u306A\u305F\u306E\u7406\u60F3\u3068\u3059\u308B\u4EBA\u306F\u3001\u4F55\u3092\u3082\u3063\u3068\u3082\u5927\u4E8B\u306B\u3057\u3066\u3044\u308B\u306E\u3067\u3057\u3087\u3046\u304B\uFF1F",
      "\u4EBA\u751F\u306E\u4E2D\u3067\u5B66\u3076\u3053\u3068\u306E\u591A\u304B\u3063\u305F\u5931\u6557\u3001\u632B\u6298\u4F53\u9A13\u306F\u4F55\u3067\u3059\u304B\uFF1F",
      "\u4ED5\u4E8B\u3068\u30D7\u30E9\u30A4\u30D9\u30FC\u30C8\u3067\u5171\u901A\u3057\u3066\u8A00\u3048\u308B\u6307\u91DD\u306F\u4F55\u3067\u3059\u304B\uFF1F",
      "\u3042\u306A\u305F\u306E\u4EBA\u751F\u306E\u4E2D\u3067\u3001\u5145\u5B9F\u611F\u306E\u9AD8\u304B\u3063\u305F\u6210\u529F\u4F53\u9A13\u306F\u306A\u3093\u3067\u3057\u305F\u304B\uFF1F",
      "\u6BCE\u65E5\u306E\u751F\u6D3B\u3067\u6C17\u3092\u3064\u3051\u3066\u3044\u308B\u3053\u3068\u306F\u4F55\u3067\u3059\u304B\uFF1F",
      "\u79C1\u751F\u6D3B\u3067\u6700\u3082\u4FA1\u5024\u304C\u3042\u308B\u3068\u8003\u3048\u308B\u884C\u52D5\u306F\u4F55\u3067\u3059\u304B\uFF1F",
      "\u4ECA\u3001\u5341\u5206\u306A\u6642\u9593\u304C\u3042\u308C\u3070\u8AB0\u3068\u4F55\u3092\u3057\u305F\u3044\u3067\u3059\u304B\uFF1F",
      "\u3053\u308C\u304B\u3089\u306E\u4EBA\u751F\u3067\u4E00\u756A\u5B9F\u73FE\u3057\u305F\u3044\u3053\u3068\u306F\u4F55\u3067\u3059\u304B\uFF1F",
      "\u3042\u306A\u305F\u306E\u7406\u60F3\u3068\u3059\u308B\u4EBA\u751F\u306F\u3069\u306E\u3088\u3046\u306A\u3053\u3068\u3092\u3057\u3066\u6210\u3057\u9042\u3052\u305F\u4EBA\u3067\u3059\u304B\uFF1F",
      "\u3042\u306A\u305F\u306E\u4EBA\u751F\u306E\u4E2D\u3067\u5927\u304D\u306A\u5F71\u97FF\u3092\u53D7\u3051\u305F\u4EBA\u306F\u3069\u3093\u306A\u70B9\u304C\u6700\u3082\u512A\u308C\u3066\u3044\u307E\u3057\u305F\u304B\uFF1F"
    ],
    layout: "vertical"
  },
  {
    title: "\u4F59\u547D1\u5E74\u30EA\u30B9\u30C8",
    defaultBody: "",
    questions: ["\u300C\u4F59\u547D1\u5E74\u300D\u3060\u3063\u305F\u3089\u4F55\u3092\u3057\u305F\u3044\uFF1F"],
    layout: "vertical"
  },
  {
    title: "\u3042\u3068100\u5E74\u4EBA\u751F\u30EA\u30B9\u30C8",
    defaultBody: "",
    questions: ["\u5065\u5EB7\u4F53\u3067\u3042\u3068100\u5E74\u751F\u304D\u3089\u308C\u308B\u3068\u3057\u305F\u3089\u4F55\u3092\u3057\u305F\u3044\uFF1F"],
    layout: "vertical"
  },
  {
    title: "\u6B7B\u306C\u307E\u3067\u306B\u3084\u308A\u305F\u3044\u3053\u3068",
    defaultBody: "",
    questions: ["\u4F55\u3092\u3057\u305F\u3044\uFF1F"],
    layout: "vertical"
  },
  {
    title: "\u7ACB\u5834\u3092\u5909\u3048\u3066\u8003\u3048\u308B",
    defaultBody: "",
    questions: [
      "\u8AB0\u306E\u7ACB\u5834\u3067\u8003\u3048\u307E\u3059\u304B\uFF1F",
      "\u305D\u306E\u4EBA\u306F\u3042\u306A\u305F\u306B\u5BFE\u3057\u3066\u4F55\u3092\u671B\u3093\u3067\u307E\u3059\u304B\uFF1F\u4F55\u3092\u3044\u3084\u3060\u3068\u601D\u3063\u3066\u307E\u3059\u304B\uFF1F",
      "\u671B\u307E\u308C\u3066\u3044\u308B\u3053\u3068\u3092\u5B9F\u73FE\u3059\u308B\u306B\u306F\u3069\u3046\u3057\u305F\u3089\u826F\u3044\u3067\u3059\u304B\uFF1F"
    ],
    layout: "vertical"
  },
  {
    title: "\u61A7\u308C\u306E\u4EBA\u7269",
    defaultBody: "",
    questions: ["\u8AB0\u306E\uFF1F\u3069\u3093\u306A\u3068\u3053\u308D\uFF1F"],
    layout: "vertical"
  },
  {
    title: "20\u5E74\u5F8C\u306E\u81EA\u5206\u3078\u30A4\u30F3\u30BF\u30D3\u30E5\u30FC",
    defaultBody: "",
    questions: [
      "\u8AB0\u3068\u4E00\u7DD2\u3067\u3057\u305F\u304B\uFF1F",
      "\u3069\u306E\u3088\u3046\u306A\u8ECA\u306B\u4E57\u308A\u3001\u3069\u3093\u306A\u8EAB\u306A\u308A\u3067\u3057\u305F\u304B\uFF1F",
      "\u4ECA\u73FE\u5728\u3069\u3093\u306A\u4ED5\u4E8B\u3092\u3057\u3066\u3044\u308B\u3088\u3046\u3067\u3057\u305F\u304B\uFF1F",
      "\u3069\u3093\u306A\u6240\u306B\u4F4F\u3093\u3067\u3044\u305D\u3046\u3067\u3057\u305F\u304B\uFF1F",
      "\u3042\u306A\u305F\u304C\u4ECA\u4E00\u756A\u5927\u5207\u306A\u3082\u306E\u306F\u4F55\u3067\u3059\u304B\uFF1F",
      "\u3042\u306A\u305F\u304C\u305D\u306E\u3088\u3046\u306A\u6210\u529F\u3092\u53CE\u3081\u305F\u306E\u306F\u3069\u3046\u3057\u3066\u3067\u3057\u3087\u3046\u304B\uFF1F",
      "\u305D\u306E\u3088\u3046\u306B\u904B\u306B\u3082\u6075\u307E\u308C\u308B\u306B\u306F\u3001\u3042\u306A\u305F\u304C\u4F55\u3092\u3057\u3066\u304D\u305F\u304B\u3089\u3067\u3059\u304B\uFF1F",
      "\u4ECA\u601D\u3048\u3070\u4F55\u304C\u8EE2\u6A5F\u3067\u3057\u305F\u304B\uFF1F\u305D\u3053\u3067\u3069\u3093\u306A\u5224\u65AD\u3092\u3057\u305F\u306E\u3067\u3059\u304B\uFF1F",
      "\u4ECA\u3001\u4F55\u3092\u3057\u3066\u3044\u308B\u3068\u304D\u304C\u4E00\u756A\u697D\u3057\u3044\u3067\u3059\u304B\uFF1F",
      "\u3042\u306A\u305F\u3092\u4E00\u756A\u652F\u3048\u3066\u304F\u308C\u305F\u4EBA\u306F\u8AB0\u3067\u3057\u305F\u304B\uFF1F"
    ],
    layout: "vertical"
  },
  {
    kind: "table",
    title: "\u5FC3\u306B\u6B8B\u3063\u305F\u8A00\u8449\u30FB\u5EA7\u53F3\u306E\u9298",
    tableType: "Quotes",
    columns: [
      {
        label: "\u7A2E\u5225",
        type: "select",
        options: ["\u5FC3\u306B\u6B8B\u3063\u305F\u8A00\u8449", "\u5EA7\u53F3\u306E\u9298"],
        width: "160px"
      },
      { label: "\u5185\u5BB9", type: "text", width: "minmax(260px, 1fr)" }
    ]
  }
];
var ExercisesView = class extends import_obsidian2.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.listEl = null;
    this.statusEl = null;
    this.activeSectionTitle = EXERCISE_SECTIONS[0]?.title ?? "";
    this.plugin = plugin;
    this.exercisesService = new ExercisesService(
      new MarkdownRepository(this.plugin.app),
      this.plugin.settings.storageDir
    );
  }
  getViewType() {
    return EXERCISES_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u6F14\u7FD2";
  }
  async onOpen() {
    const container = this.contentEl;
    container.empty();
    const view = container.createEl("div", { cls: "lifeplanner-view" });
    view.createEl("h2", { text: "\u6F14\u7FD2" });
    renderNavigation(view, (viewType) => {
      void this.plugin.openViewInLeaf(viewType, this.leaf);
    });
    this.statusEl = view.createEl("div", { cls: "lifeplanner-exercises-status" });
    this.listEl = view.createEl("div", { cls: "lifeplanner-exercises-list" });
    await this.renderExercises();
  }
  async onClose() {
    this.listEl = null;
    this.statusEl = null;
  }
  async renderExercises() {
    if (!this.listEl) {
      return;
    }
    this.listEl.empty();
    const questionSections = EXERCISE_SECTIONS.filter(
      (section) => section.kind !== "table"
    );
    const sections = await this.exercisesService.loadSections(questionSections);
    const tabs = this.listEl.createEl("div", { cls: "lifeplanner-exercises-tabs" });
    const content = this.listEl.createEl("div", { cls: "lifeplanner-exercises-content" });
    const renderSection = async (sectionDef) => {
      content.empty();
      const section = content.createEl("div", { cls: "lifeplanner-exercises-item" });
      section.createEl("h3", { text: sectionDef.title });
      if (sectionDef.kind === "table") {
        await this.renderTableSection(section, sectionDef);
        return;
      }
      if (sectionDef.questions && sectionDef.questions.length > 0) {
        const savedLines = (sections[sectionDef.title] ?? "").split("\n").map((line) => line.trim());
        const answerMap = /* @__PURE__ */ new Map();
        savedLines.forEach((line) => {
          if (!line.startsWith("- ")) {
            return;
          }
          const content2 = line.replace(/^\-\s*/, "");
          const parts = content2.split(":");
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
          cls: sectionDef.layout === "vertical" ? "lifeplanner-exercises-grid is-vertical" : "lifeplanner-exercises-grid"
        });
        sectionDef.questions.forEach((question) => {
          grid.createEl("div", { cls: "lifeplanner-exercises-question", text: question });
          const input = grid.createEl("textarea", { cls: "lifeplanner-exercises-answer" });
          input.rows = 3;
          input.value = answerMap.get(question) ?? "";
          input.addEventListener("input", () => {
            answerMap.set(question, input.value.trim());
            const lines = [];
            sectionDef.questions?.forEach((q) => {
              const value = answerMap.get(q) ?? "";
              lines.push(`- ${q}: ${value}`);
            });
            sections[sectionDef.title] = lines.join("\n");
            void this.exercisesService.saveSections(questionSections, sections);
            this.setStatus("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
          });
        });
      } else {
        const textarea = section.createEl("textarea");
        textarea.rows = 6;
        textarea.value = sections[sectionDef.title] ?? "";
        textarea.placeholder = "\u56DE\u7B54\u3092\u8A18\u5165";
        textarea.addEventListener("input", () => {
          sections[sectionDef.title] = textarea.value;
          void this.exercisesService.saveSections(questionSections, sections);
          this.setStatus("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
        });
      }
    };
    EXERCISE_SECTIONS.forEach((sectionDef) => {
      const tab = tabs.createEl("button", {
        text: sectionDef.title,
        cls: sectionDef.title === this.activeSectionTitle ? "lifeplanner-exercises-tab is-active" : "lifeplanner-exercises-tab"
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
    const initial = EXERCISE_SECTIONS.find((sectionDef) => sectionDef.title === this.activeSectionTitle) ?? EXERCISE_SECTIONS[0];
    if (initial) {
      await renderSection(initial);
    }
  }
  async renderTableSection(container, sectionDef) {
    const service = new TableSectionService(
      new MarkdownRepository(this.plugin.app),
      sectionDef.tableType,
      sectionDef.title,
      sectionDef.columns,
      this.plugin.settings.storageDir
    );
    const actions = container.createEl("div", { cls: "lifeplanner-table-actions" });
    const addButton = actions.createEl("button", { text: "\u8FFD\u52A0" });
    const table = container.createEl("div", { cls: "lifeplanner-table-grid" });
    table.style.gridTemplateColumns = sectionDef.columns.map((column) => {
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
    }).join(" ");
    const rows = await service.loadRows();
    if (rows.length === 0) {
      rows.push([]);
    }
    sectionDef.columns.forEach((column) => {
      table.createEl("div", {
        cls: "lifeplanner-table-cell lifeplanner-table-header",
        text: column.label
      });
    });
    const setCell = (rowIndex, colIndex, value) => {
      const row = rows[rowIndex] ?? [];
      row[colIndex] = value;
      rows[rowIndex] = row;
      void service.saveRows(rows);
      this.setStatus("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
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
  setStatus(message) {
    if (!this.statusEl) {
      return;
    }
    this.statusEl.setText(message);
    window.setTimeout(() => {
      this.statusEl?.setText("");
    }, 2e3);
  }
};

// src/ui/goal_task_view.ts
var import_obsidian3 = require("obsidian");

// src/services/goals_service.ts
var LEVEL_ORDER = [
  "\u4EBA\u751F",
  "\u9577\u671F",
  "\u4E2D\u671F",
  "\u5E74\u9593",
  "\u56DB\u534A\u671F",
  "\u6708\u9593",
  "\u9031\u9593"
];
var GoalsService = class {
  constructor(repository, baseDir) {
    this.repository = repository;
    this.baseDir = baseDir;
  }
  async listGoals() {
    const path = resolveLifePlannerPath("Goals", this.baseDir);
    const content = await this.repository.read(path);
    if (!content) {
      await this.repository.write(path, serializeGoals([]));
      return [];
    }
    const goals = parseGoals(content);
    const idLines = content.match(/^ID:/gm)?.length ?? 0;
    if (goals.length > 0 && idLines < goals.length) {
      await this.repository.write(path, serializeGoals(goals));
    }
    return goals;
  }
  async addGoal(level, title, description, parentGoalId, dueDate) {
    const goals = await this.listGoals();
    const siblingOrders = goals.filter((goal2) => goal2.level === level && goal2.parentGoalId === parentGoalId).map((goal2) => goal2.order ?? 0);
    const nextOrder = siblingOrders.length > 0 ? Math.max(...siblingOrders) + 1 : 1;
    const existingIds = new Set(goals.map((goal2) => goal2.id));
    let id = `goal-${Date.now()}-${Math.floor(Math.random() * 1e3)}`;
    while (existingIds.has(id)) {
      id = `goal-${Date.now()}-${Math.floor(Math.random() * 1e3)}`;
    }
    const goal = {
      id,
      title,
      level,
      status: "active",
      description,
      parentGoalId,
      order: nextOrder,
      dueDate
    };
    goals.push(goal);
    await this.saveGoals(goals);
    return goal;
  }
  async updateGoal(id, update) {
    const goals = await this.listGoals();
    const updated = goals.map((goal) => {
      if (goal.id !== id) {
        return goal;
      }
      return { ...goal, ...update, id: goal.id };
    });
    await this.saveGoals(updated);
  }
  async deleteGoal(id) {
    const goals = await this.listGoals();
    const remaining = goals.filter((goal) => goal.id !== id);
    const cleaned = remaining.map((goal) => {
      if (goal.parentGoalId === id) {
        return { ...goal, parentGoalId: void 0 };
      }
      return goal;
    });
    await this.saveGoals(cleaned);
  }
  async saveGoals(goals) {
    const content = serializeGoals(goals);
    await this.repository.write(resolveLifePlannerPath("Goals", this.baseDir), content);
  }
};
function parseGoals(content) {
  const goals = [];
  const parentRefs = /* @__PURE__ */ new Map();
  let currentLevel = null;
  let currentGoal = null;
  const lines = content.split("\n");
  for (const line of lines) {
    const levelMatch = line.match(/^##\s+(.+)$/);
    if (levelMatch) {
      const raw = levelMatch[1].trim();
      const normalized = raw.endsWith("\u76EE\u6A19") ? raw.replace(/目標$/, "") : raw;
      if (LEVEL_ORDER.includes(normalized)) {
        currentLevel = normalized;
        continue;
      }
      currentLevel = null;
      continue;
    }
    const goalHeading = line.match(/^###\s+(.+)$/);
    if (goalHeading && currentLevel) {
      if (currentGoal) {
        goals.push(currentGoal);
      }
      const title = goalHeading[1].trim();
      const id = `goal-${Date.now()}-${Math.floor(Math.random() * 1e3)}`;
      currentGoal = {
        id,
        title,
        level: currentLevel,
        status: "active",
        description: ""
      };
      continue;
    }
    const legacyGoal = line.match(/^\-\s*(.+)$/);
    if (legacyGoal && currentLevel) {
      const title = legacyGoal[1].trim();
      if (!title) {
        continue;
      }
      goals.push({
        id: `${currentLevel}-${title}`,
        title,
        level: currentLevel,
        status: "active"
      });
      continue;
    }
    if (currentGoal && line.startsWith("\u89AA:")) {
      const rawParent = line.replace("\u89AA:", "").trim();
      if (rawParent) {
        parentRefs.set(currentGoal.id, rawParent);
      }
      continue;
    }
    if (currentGoal && line.startsWith("\u671F\u9650:")) {
      currentGoal.dueDate = line.replace("\u671F\u9650:", "").trim() || void 0;
      continue;
    }
    if (currentGoal && line.startsWith("\u5C55\u958B:")) {
      const raw = line.replace("\u5C55\u958B:", "").trim().toLowerCase();
      currentGoal.expanded = raw === "true";
      continue;
    }
    if (currentGoal && line.startsWith("ID:")) {
      const rawId = line.replace("ID:", "").trim();
      if (rawId) {
        if (parentRefs.has(currentGoal.id)) {
          const parentRef = parentRefs.get(currentGoal.id);
          parentRefs.delete(currentGoal.id);
          if (parentRef) {
            parentRefs.set(rawId, parentRef);
          }
        }
        currentGoal.id = rawId;
      }
      continue;
    }
    if (currentGoal && line.startsWith("\u9806\u5E8F:")) {
      const raw = line.replace("\u9806\u5E8F:", "").trim();
      const parsed = Number.parseInt(raw, 10);
      currentGoal.order = Number.isFinite(parsed) ? parsed : void 0;
      continue;
    }
    if (currentGoal && line.trim().length > 0) {
      currentGoal.description = currentGoal.description ? `${currentGoal.description}
${line.trim()}` : line.trim();
    }
  }
  if (currentGoal) {
    goals.push(currentGoal);
  }
  if (parentRefs.size > 0) {
    const byId = new Map(goals.map((goal) => [goal.id, goal]));
    const byTitle = new Map(goals.map((goal) => [goal.title, goal]));
    for (const goal of goals) {
      const parentRef = parentRefs.get(goal.id);
      if (!parentRef) {
        continue;
      }
      const parentById = byId.get(parentRef);
      const parentByTitle = byTitle.get(parentRef);
      goal.parentGoalId = parentById?.id ?? parentByTitle?.id;
    }
  }
  return goals;
}
function serializeGoals(goals) {
  const lines = [];
  lines.push("# \u76EE\u6A19\u30B4\u30FC\u30EB");
  lines.push("");
  for (const level of LEVEL_ORDER) {
    lines.push(`## ${level}\u76EE\u6A19`);
    const levelGoals = goals.filter((goal) => goal.level === level);
    if (levelGoals.length === 0) {
      lines.push("");
    } else {
      const sorted = [...levelGoals].sort((a, b) => {
        const aParent = a.parentGoalId ?? "";
        const bParent = b.parentGoalId ?? "";
        const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
        return aParent.localeCompare(bParent) || aOrder - bOrder || a.title.localeCompare(b.title);
      });
      for (const goal of sorted) {
        lines.push(`### ${goal.title}`);
        lines.push(`ID: ${goal.id}`);
        if (goal.parentGoalId) {
          lines.push(`\u89AA: ${goal.parentGoalId}`);
        }
        if (goal.dueDate) {
          lines.push(`\u671F\u9650: ${goal.dueDate}`);
        }
        if (goal.expanded !== void 0) {
          lines.push(`\u5C55\u958B: ${goal.expanded ? "true" : "false"}`);
        }
        if (goal.order !== void 0) {
          lines.push(`\u9806\u5E8F: ${goal.order}`);
        }
        if (goal.description) {
          lines.push(goal.description);
        } else {
          lines.push("- ");
        }
        lines.push("");
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

// src/services/tasks_service.ts
var TasksService = class {
  constructor(repository, baseDir) {
    this.repository = repository;
    this.baseDir = baseDir;
  }
  async listTasks() {
    const content = await this.repository.read(resolveLifePlannerPath("Tasks", this.baseDir));
    if (!content) {
      return [];
    }
    return parseTasks(content);
  }
  async addTask(goalTitle, title) {
    const tasks = await this.listTasks();
    const task = {
      id: `${goalTitle}-${Date.now()}`,
      title,
      goalId: goalTitle,
      status: "todo"
    };
    tasks.push(task);
    await this.saveTasks(tasks);
    return task;
  }
  async saveTasks(tasks) {
    const content = serializeTasks(tasks);
    await this.repository.write(resolveLifePlannerPath("Tasks", this.baseDir), content);
  }
};
function parseTasks(content) {
  const tasks = [];
  const lines = content.split("\n");
  let inTaskSection = false;
  for (const line of lines) {
    if (line.startsWith("## \u30BF\u30B9\u30AF")) {
      inTaskSection = true;
      continue;
    }
    if (line.startsWith("## ")) {
      inTaskSection = false;
    }
    if (!inTaskSection) {
      continue;
    }
    const match = line.match(/^- \[(.| )\] \[(.+)\]\s*(.+)$/);
    if (match) {
      const status = match[1].toLowerCase() === "x" ? "done" : "todo";
      tasks.push({
        id: `${match[2]}-${tasks.length}`,
        goalId: match[2],
        title: match[3].trim(),
        status
      });
    }
  }
  return tasks;
}
function serializeTasks(tasks) {
  const lines = [];
  lines.push("# \u76EE\u6A19\u304B\u3089\u30BF\u30B9\u30AF\u5207\u308A\u51FA\u3057");
  lines.push("");
  lines.push("## \u76EE\u6A19");
  lines.push("- ");
  lines.push("");
  lines.push("## \u30BF\u30B9\u30AF");
  if (tasks.length === 0) {
    lines.push("- [ ] ");
  } else {
    for (const task of tasks) {
      const checked = task.status === "done" ? "[x]" : "[ ]";
      lines.push(`- ${checked} [${task.goalId}] ${task.title}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

// src/ui/goal_task_view.ts
var GoalTaskView = class extends import_obsidian3.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.listEl = null;
    this.statusEl = null;
    this.taskRows = [];
    this.goalOptions = [];
    this.saveTimer = null;
    this.plugin = plugin;
    const repository = new MarkdownRepository(this.plugin.app);
    this.goalsService = new GoalsService(repository, this.plugin.settings.storageDir);
    this.tasksService = new TasksService(repository, this.plugin.settings.storageDir);
  }
  getViewType() {
    return GOAL_TASK_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u30A2\u30AF\u30B7\u30E7\u30F3\u30D7\u30E9\u30F3";
  }
  async onOpen() {
    const container = this.contentEl;
    container.empty();
    const view = container.createEl("div", { cls: "lifeplanner-view" });
    view.createEl("h2", { text: "\u30A2\u30AF\u30B7\u30E7\u30F3\u30D7\u30E9\u30F3" });
    renderNavigation(view, (viewType) => {
      void this.plugin.openViewInLeaf(viewType, this.leaf);
    });
    this.statusEl = view.createEl("div", { cls: "lifeplanner-goal-task-status" });
    const section = view.createEl("div", {
      cls: "lifeplanner-weekly-section lifeplanner-action-plan-section"
    });
    const header = section.createEl("div", { cls: "lifeplanner-weekly-section-header" });
    header.createEl("h3", { text: "\u30BF\u30B9\u30AF\u4E00\u89A7" });
    const addButton = header.createEl("button", { text: "\u8FFD\u52A0" });
    section.createEl("div", {
      cls: "lifeplanner-action-plan-hint",
      text: "\u76EE\u6A19\u3068\u30BF\u30B9\u30AF\u3092\u7DE8\u96C6\u30FB\u6574\u7406\u3057\u307E\u3059\u3002"
    });
    this.listEl = section.createEl("div", {
      cls: "lifeplanner-weekly-list lifeplanner-action-plan-list"
    });
    await this.renderTasks();
    addButton.addEventListener("click", (event) => {
      event.preventDefault();
      this.addTaskRow(this.goalOptions);
    });
  }
  async onClose() {
    this.listEl = null;
    this.statusEl = null;
    this.taskRows = [];
    if (this.saveTimer) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }
  async renderTasks() {
    if (!this.listEl) {
      return;
    }
    this.listEl.empty();
    this.taskRows = [];
    const tasks = await this.tasksService.listTasks();
    const goals = await this.goalsService.listGoals();
    this.goalOptions = goals.map((goal) => ({ title: goal.title }));
    if (tasks.length === 0) {
      this.addTaskRow(this.goalOptions);
      return;
    }
    for (const task of tasks) {
      this.addTaskRow(this.goalOptions, task.goalId, task.title, task.status === "done");
    }
  }
  addTaskRow(goals, goalId = "", title = "", done = false) {
    if (!this.listEl) {
      return;
    }
    const row = this.listEl.createEl("div", {
      cls: "lifeplanner-action-plan-row lifeplanner-action-plan-task-row"
    });
    const checkbox = row.createEl("input", {
      type: "checkbox",
      cls: "lifeplanner-action-plan-checkbox"
    });
    checkbox.checked = done;
    const select = row.createEl("select", { cls: "lifeplanner-action-plan-select" });
    const placeholder = select.createEl("option", { text: "\u76EE\u6A19\u3092\u9078\u629E", value: "" });
    placeholder.disabled = true;
    placeholder.selected = !goalId;
    const goalList = goals ?? this.goalOptions;
    if (goalList.length === 0) {
      select.createEl("option", { text: "\u76EE\u6A19\u304C\u672A\u767B\u9332", value: "" });
    } else {
      for (const goal of goalList) {
        select.createEl("option", { text: goal.title, value: goal.title });
      }
    }
    if (goalId && !goalList.some((goal) => goal.title === goalId)) {
      select.createEl("option", { text: goalId, value: goalId });
    }
    select.value = goalId;
    const input = row.createEl("input", {
      type: "text",
      cls: "lifeplanner-action-plan-input"
    });
    input.placeholder = "\u30BF\u30B9\u30AF\u5185\u5BB9";
    input.value = title;
    const remove = row.createEl("button", { text: "\xD7", cls: "lifeplanner-action-plan-remove" });
    const onChange = () => this.scheduleSave();
    checkbox.addEventListener("change", onChange);
    select.addEventListener("change", onChange);
    input.addEventListener("input", onChange);
    remove.addEventListener("click", (event) => {
      event.preventDefault();
      row.remove();
      this.taskRows = this.taskRows.filter((item) => item.titleInput !== input);
      this.scheduleSave();
    });
    this.taskRows.push({ checkbox, goalSelect: select, titleInput: input });
  }
  scheduleSave() {
    if (this.saveTimer) {
      window.clearTimeout(this.saveTimer);
    }
    this.saveTimer = window.setTimeout(() => {
      void this.saveTasks();
    }, 300);
  }
  async saveTasks() {
    if (!this.listEl) {
      return;
    }
    const tasks = this.taskRows.map((row) => ({
      goalId: row.goalSelect.value.trim(),
      title: row.titleInput.value.trim(),
      status: row.checkbox.checked ? "done" : "todo"
    })).filter((task) => task.goalId || task.title).map((task, index) => ({
      id: `task-${index}`,
      ...task
    }));
    await this.tasksService.saveTasks(tasks);
  }
  setStatus(message) {
    if (!this.statusEl) {
      return;
    }
    this.statusEl.setText(message);
    window.setTimeout(() => {
      this.statusEl?.setText("");
    }, 2e3);
  }
};

// src/ui/goals_view.ts
var import_obsidian4 = require("obsidian");
var LEVELS = [
  "\u4EBA\u751F",
  "\u9577\u671F",
  "\u4E2D\u671F",
  "\u5E74\u9593",
  "\u56DB\u534A\u671F",
  "\u6708\u9593",
  "\u9031\u9593"
];
var GoalsView = class extends import_obsidian4.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.listEl = null;
    this.statusEl = null;
    this.parentSelect = null;
    this.descriptionInput = null;
    this.goals = [];
    this.formEl = null;
    this.formWrapEl = null;
    this.handleOutsideClick = null;
    this.handleMenuClose = null;
    this.plugin = plugin;
    this.goalsService = new GoalsService(
      new MarkdownRepository(this.plugin.app),
      this.plugin.settings.storageDir
    );
  }
  getViewType() {
    return GOALS_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u76EE\u6A19";
  }
  async onOpen() {
    const container = this.contentEl;
    container.empty();
    const view = container.createEl("div", { cls: "lifeplanner-view" });
    view.createEl("h2", { text: "\u76EE\u6A19" });
    renderNavigation(view, (viewType) => {
      void this.plugin.openViewInLeaf(viewType, this.leaf);
    });
    const formWrap = view.createEl("div", { cls: "lifeplanner-goals-form-wrap" });
    this.formWrapEl = formWrap;
    const formToggle = formWrap.createEl("button", {
      cls: "lifeplanner-goals-form-toggle",
      text: "\u8FFD\u52A0"
    });
    formToggle.setAttr("type", "button");
    formToggle.setAttr("aria-label", "\u8FFD\u52A0\u30D5\u30A9\u30FC\u30E0");
    const form = formWrap.createEl("div", {
      cls: "lifeplanner-goals-form lifeplanner-form is-collapsed"
    });
    this.formEl = form;
    const levelField = form.createEl("div", {
      cls: "lifeplanner-form-field lifeplanner-form-row"
    });
    levelField.createEl("label", { text: "\u30AB\u30C6\u30B4\u30EA" });
    const levelSelect = levelField.createEl("select");
    for (const level of LEVELS) {
      levelSelect.createEl("option", { text: level, value: level });
    }
    const parentField = form.createEl("div", {
      cls: "lifeplanner-form-field lifeplanner-form-row"
    });
    parentField.createEl("label", { text: "\u89AA\u76EE\u6A19" });
    const parentSelect = parentField.createEl("select");
    parentSelect.createEl("option", { text: "\u89AA\u76EE\u6A19\u306A\u3057", value: "" });
    this.parentSelect = parentSelect;
    const titleField = form.createEl("div", {
      cls: "lifeplanner-form-field lifeplanner-form-row"
    });
    titleField.createEl("label", { text: "\u76EE\u6A19\u30BF\u30A4\u30C8\u30EB" });
    const titleInput = titleField.createEl("input", { type: "text" });
    titleInput.placeholder = "\u76EE\u6A19\u3092\u5165\u529B";
    const descriptionField = form.createEl("div", {
      cls: "lifeplanner-form-field lifeplanner-form-row"
    });
    descriptionField.createEl("label", { text: "\u8AAC\u660E\u6587" });
    const descriptionInput = descriptionField.createEl("textarea");
    descriptionInput.rows = 1;
    descriptionInput.placeholder = "\u76EE\u6A19\u306E\u8AAC\u660E";
    this.descriptionInput = descriptionInput;
    const dueField = form.createEl("div", {
      cls: "lifeplanner-form-field lifeplanner-form-row"
    });
    dueField.createEl("label", { text: "\u671F\u9650" });
    const dueInput = dueField.createEl("input", { type: "date" });
    const actionField = form.createEl("div", {
      cls: "lifeplanner-form-field lifeplanner-form-row"
    });
    actionField.createEl("label", { text: " " });
    const addButton = actionField.createEl("button", { text: "\u8FFD\u52A0" });
    this.statusEl = view.createEl("div", { cls: "lifeplanner-goals-status" });
    this.listEl = view.createEl("div", { cls: "lifeplanner-goals-list" });
    addButton.addEventListener("click", () => {
      const parentValue = parentSelect.value ? parentSelect.value : void 0;
      void this.handleAddGoal(
        levelSelect.value,
        titleInput.value.trim(),
        descriptionInput.value.trim(),
        parentValue,
        dueInput.value ? dueInput.value : void 0
      );
      titleInput.value = "";
      descriptionInput.value = "";
      dueInput.value = "";
    });
    formToggle.addEventListener("click", (event) => {
      event.preventDefault();
      form.classList.toggle("is-collapsed");
    });
    form.addEventListener("focusout", (event) => {
      const related = event.relatedTarget;
      if (related && formWrap.contains(related)) {
        return;
      }
      form.classList.add("is-collapsed");
    });
    this.handleOutsideClick = (event) => {
      if (!this.formWrapEl || !this.formEl) {
        return;
      }
      const target = event.target;
      if (target && this.formWrapEl.contains(target)) {
        return;
      }
      this.formEl.classList.add("is-collapsed");
    };
    document.addEventListener("mousedown", this.handleOutsideClick, true);
    this.handleMenuClose = (event) => {
      const target = event.target;
      if (target && (formWrap.contains(target) || this.listEl?.contains(target))) {
        return;
      }
      this.listEl?.querySelectorAll(".lifeplanner-goal-menu-list.is-open").forEach((menu) => {
        menu.classList.remove("is-open");
      });
    };
    document.addEventListener("mousedown", this.handleMenuClose, true);
    await this.renderGoals();
    await this.populateParents();
  }
  async onClose() {
    this.listEl = null;
    this.statusEl = null;
    this.parentSelect = null;
    this.descriptionInput = null;
    this.goals = [];
    this.formEl = null;
    this.formWrapEl = null;
    if (this.handleOutsideClick) {
      document.removeEventListener("mousedown", this.handleOutsideClick, true);
      this.handleOutsideClick = null;
    }
    if (this.handleMenuClose) {
      document.removeEventListener("mousedown", this.handleMenuClose, true);
      this.handleMenuClose = null;
    }
  }
  async handleAddGoal(level, title, description, parentGoalId, dueDate) {
    if (!title) {
      this.setStatus("\u76EE\u6A19\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
      return;
    }
    await this.goalsService.addGoal(level, title, description, parentGoalId, dueDate);
    this.setStatus("\u8FFD\u52A0\u3057\u307E\u3057\u305F");
    await this.renderGoals();
    await this.populateParents();
  }
  async renderGoals() {
    if (!this.listEl) {
      return;
    }
    this.listEl.empty();
    const goals = await this.goalsService.listGoals();
    this.goals = goals;
    if (goals.length === 0) {
      this.listEl.createEl("div", { text: "(\u672A\u767B\u9332)" });
      return;
    }
    const rootDrop = this.listEl.createEl("div", { cls: "lifeplanner-goal-root-drop" });
    const rootLabel = rootDrop.createEl("div", { cls: "lifeplanner-goal-root-label" });
    rootLabel.setText("\u30EB\u30FC\u30C8\u3078\u79FB\u52D5\uFF08\u3053\u3053\u306B\u30C9\u30ED\u30C3\u30D7\uFF09");
    const isInsideCard = (target) => target instanceof Element && Boolean(target.closest(".lifeplanner-goal-card"));
    rootDrop.addEventListener("dragover", (event) => {
      if (isInsideCard(event.target)) {
        return;
      }
      event.preventDefault();
      rootDrop.addClass("is-drop");
    });
    rootDrop.addEventListener("dragleave", () => {
      rootDrop.removeClass("is-drop");
    });
    rootDrop.addEventListener("drop", (event) => {
      if (isInsideCard(event.target)) {
        return;
      }
      event.preventDefault();
      rootDrop.removeClass("is-drop");
      const sourceId = event.dataTransfer?.getData("lifeplanner-goal-id") || event.dataTransfer?.getData("lifeplanner-goal") || event.dataTransfer?.getData("text/plain");
      if (!sourceId) {
        return;
      }
      void this.handleMoveToRoot(sourceId);
    });
    const tree = buildGoalTree(goals);
    const rootContainer = rootDrop.createEl("div", { cls: "lifeplanner-goal-root-list" });
    renderGoalTree(rootContainer, tree, 0, (node) => {
      void this.handleEdit(node);
    }, (node) => {
      void this.handleDelete(node);
    }, (node) => {
      void this.handleAddChild(node);
    }, (sourceId, targetNode, position) => {
      void this.handleMove(sourceId, targetNode, position);
    }, (node, expanded) => {
      void this.handleToggleExpanded(node, expanded);
    });
  }
  async populateParents() {
    if (!this.parentSelect) {
      return;
    }
    this.parentSelect.empty();
    this.parentSelect.createEl("option", { text: "\u89AA\u76EE\u6A19\u306A\u3057", value: "" });
    const goals = await this.goalsService.listGoals();
    const byId = new Map(goals.map((goal) => [goal.id, goal]));
    for (const goal of goals) {
      const parent = goal.parentGoalId ? byId.get(goal.parentGoalId) : void 0;
      const optionLabel = parent ? `${goal.title} (\u89AA: ${parent.title})` : goal.title;
      this.parentSelect.createEl("option", { text: optionLabel, value: goal.id });
    }
  }
  async handleEdit(node) {
    const parentLevel = node.parentLevel;
    const allowedLevels = parentLevel ? levelsBelow(parentLevel) : LEVELS;
    const goals = await this.goalsService.listGoals();
    const byId = new Map(goals.map((goal) => [goal.id, goal]));
    const parentTitle = node.parentGoalId ? byId.get(node.parentGoalId)?.title ?? "" : "";
    const modal = new GoalEditModal(this.app, {
      title: node.title,
      description: node.description ?? "",
      parentGoalId: parentTitle,
      level: node.level ?? "\u9031\u9593",
      dueDate: node.dueDate ?? "",
      lockLevel: parentLevel ? allowedLevels.length === 1 : false,
      lockParent: Boolean(node.parentGoalId),
      allowedLevels,
      onSubmit: async (values) => {
        const parentId = goals.find((goal) => goal.id === values.parentGoalId)?.id ?? goals.find((goal) => goal.title === values.parentGoalId)?.id;
        await this.goalsService.updateGoal(node.id, {
          title: values.title,
          description: values.description,
          parentGoalId: parentId,
          level: values.level,
          dueDate: values.dueDate || void 0
        });
        this.setStatus("\u66F4\u65B0\u3057\u307E\u3057\u305F");
        await this.renderGoals();
        await this.populateParents();
      }
    });
    modal.open();
  }
  async handleDelete(node) {
    const ok = window.confirm(`"${node.title}" \u3092\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F`);
    if (!ok) {
      return;
    }
    await this.goalsService.deleteGoal(node.id);
    this.setStatus("\u524A\u9664\u3057\u307E\u3057\u305F");
    await this.renderGoals();
    await this.populateParents();
  }
  async handleAddChild(node) {
    const parentLevel = node.level ?? "\u9031\u9593";
    const allowedLevels = levelsBelow(parentLevel);
    const childLevel = allowedLevels[0] ?? parentLevel;
    const modal = new GoalEditModal(this.app, {
      title: "",
      description: "",
      dueDate: "",
      parentGoalId: node.title,
      level: childLevel,
      lockLevel: false,
      lockParent: true,
      allowedLevels,
      onSubmit: async (values) => {
        await this.goalsService.addGoal(
          values.level,
          values.title,
          values.description,
          node.id,
          values.dueDate || void 0
        );
        this.setStatus("\u5B50\u76EE\u6A19\u3092\u8FFD\u52A0\u3057\u307E\u3057\u305F");
        await this.renderGoals();
        await this.populateParents();
      }
    });
    modal.open();
  }
  async handleMove(sourceId, targetNode, position) {
    if (sourceId === targetNode.id) {
      return;
    }
    const source = this.goals.find((goal) => goal.id === sourceId);
    const target = this.goals.find((goal) => goal.id === targetNode.id);
    if (!source || !target) {
      return;
    }
    const goalsById = new Map(this.goals.map((goal) => [goal.id, goal]));
    const isDescendant = (childId, ancestorId) => {
      let current = goalsById.get(childId);
      const visited = /* @__PURE__ */ new Set();
      while (current?.parentGoalId) {
        if (current.parentGoalId === ancestorId) {
          return true;
        }
        if (visited.has(current.parentGoalId)) {
          break;
        }
        visited.add(current.parentGoalId);
        current = goalsById.get(current.parentGoalId);
      }
      return false;
    };
    if (isDescendant(target.id, source.id)) {
      this.setStatus("\u5B50\u5B6B\u306B\u306F\u79FB\u52D5\u3067\u304D\u307E\u305B\u3093");
      return;
    }
    const sourceLevelIndex = LEVELS.indexOf(source.level);
    const targetLevelIndex = target.level ? LEVELS.indexOf(target.level) : -1;
    let newParentId = target.parentGoalId;
    if (targetLevelIndex >= 0 && sourceLevelIndex >= 0) {
      if (targetLevelIndex < sourceLevelIndex) {
        newParentId = target.id;
      } else {
        newParentId = target.parentGoalId;
      }
    }
    const parentGoal = newParentId ? this.goals.find((goal) => goal.id === newParentId) : void 0;
    if (newParentId === source.id) {
      this.setStatus("\u81EA\u8EAB\u306E\u914D\u4E0B\u306B\u306F\u79FB\u52D5\u3067\u304D\u307E\u305B\u3093");
      return;
    }
    if (parentGoal) {
      const parentLevelIndex = LEVELS.indexOf(parentGoal.level);
      if (parentLevelIndex >= sourceLevelIndex) {
        this.setStatus("\u89AA\u76EE\u6A19\u306E\u968E\u5C64\u304C\u4E0A\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059");
        return;
      }
    }
    const oldParentId = source.parentGoalId;
    const sameLevel = source.level === target.level;
    const isSameGroup = sameLevel && (target.parentGoalId ?? "") === (newParentId ?? "");
    const buildGroupFrom = (goals, parentId) => goals.filter(
      (goal) => goal.level === source.level && (goal.parentGoalId ?? "") === (parentId ?? "")
    );
    const updatedGoals = this.goals.map(
      (goal) => goal.id === source.id ? { ...goal, parentGoalId: newParentId } : goal
    );
    const reorderGroup = (parentId, insertTargetId) => {
      const group = buildGroupFrom(updatedGoals, parentId).sort((a, b) => {
        const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder || a.title.localeCompare(b.title);
      });
      const existingIndex = group.findIndex((goal) => goal.id === source.id);
      let working = [...group];
      if (existingIndex >= 0) {
        const [moved] = working.splice(existingIndex, 1);
        let insertIndex = working.length;
        if (insertTargetId) {
          const targetIndex = working.findIndex((goal) => goal.id === insertTargetId);
          if (targetIndex >= 0) {
            insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
          }
        }
        if (insertIndex < 0) {
          insertIndex = 0;
        }
        if (insertIndex > working.length) {
          insertIndex = working.length;
        }
        working.splice(insertIndex, 0, moved);
      }
      const orders = /* @__PURE__ */ new Map();
      working.forEach((goal, index) => {
        orders.set(goal.id, index + 1);
      });
      for (let i = 0; i < updatedGoals.length; i += 1) {
        const goal = updatedGoals[i];
        if (goal.level === source.level && (goal.parentGoalId ?? "") === (parentId ?? "") && orders.has(goal.id)) {
          updatedGoals[i] = { ...goal, order: orders.get(goal.id) };
        }
      }
    };
    if (newParentId !== oldParentId) {
      reorderGroup(oldParentId);
    }
    if (newParentId === target.id) {
      reorderGroup(newParentId);
    } else if (isSameGroup) {
      reorderGroup(newParentId, target.id);
    } else {
      reorderGroup(newParentId);
    }
    await this.goalsService.saveGoals(updatedGoals);
    this.setStatus("\u9806\u5E8F\u3092\u66F4\u65B0\u3057\u307E\u3057\u305F");
    await this.renderGoals();
    await this.populateParents();
  }
  async handleMoveToRoot(sourceId) {
    const source = this.goals.find((goal) => goal.id === sourceId);
    if (!source) {
      return;
    }
    const updatedGoals = this.goals.map(
      (goal) => goal.id === source.id ? { ...goal, parentGoalId: void 0 } : goal
    );
    const rootGroup = updatedGoals.filter((goal) => goal.level === source.level && !goal.parentGoalId).sort((a, b) => {
      const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder || a.title.localeCompare(b.title);
    });
    const sourceIndex = rootGroup.findIndex((goal) => goal.id === source.id);
    if (sourceIndex >= 0) {
      const [moved] = rootGroup.splice(sourceIndex, 1);
      rootGroup.push(moved);
    }
    const orders = /* @__PURE__ */ new Map();
    rootGroup.forEach((goal, index) => {
      orders.set(goal.id, index + 1);
    });
    const reordered = updatedGoals.map(
      (goal) => orders.has(goal.id) ? { ...goal, order: orders.get(goal.id) } : goal
    );
    await this.goalsService.saveGoals(reordered);
    this.setStatus("\u30EB\u30FC\u30C8\u306B\u79FB\u52D5\u3057\u307E\u3057\u305F");
    await this.renderGoals();
    await this.populateParents();
  }
  setStatus(message) {
    if (!this.statusEl) {
      return;
    }
    this.statusEl.setText(message);
    window.setTimeout(() => {
      this.statusEl?.setText("");
    }, 2e3);
  }
  async handleToggleExpanded(node, expanded) {
    await this.goalsService.updateGoal(node.id, { expanded });
  }
};
function buildGoalTree(goals) {
  const map = /* @__PURE__ */ new Map();
  for (const goal of goals) {
    map.set(goal.id, {
      id: goal.id,
      title: goal.title,
      description: goal.description,
      level: goal.level,
      parentGoalId: goal.parentGoalId,
      order: goal.order,
      dueDate: goal.dueDate,
      expanded: goal.expanded,
      children: []
    });
  }
  const roots = [];
  for (const goal of goals) {
    const node = map.get(goal.id);
    if (!node) {
      continue;
    }
    if (goal.parentGoalId) {
      const parent = map.get(goal.parentGoalId);
      if (parent) {
        node.parentLevel = parent.level;
        node.parentTitle = parent.title;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }
  const sortNodes = (nodes) => {
    nodes.sort((a, b) => {
      const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder || a.title.localeCompare(b.title);
    });
    for (const node of nodes) {
      sortNodes(node.children);
    }
  };
  sortNodes(roots);
  return roots;
}
function renderGoalTree(container, nodes, depth, onEdit, onDelete, onAddChild, onMove, onToggle) {
  for (const node of nodes) {
    const card = container.createEl("details", { cls: "lifeplanner-goal-card" });
    card.open = Boolean(node.expanded);
    if (depth > 0) {
      card.style.marginLeft = `${depth * 16}px`;
    }
    const summary = card.createEl("summary", { cls: "lifeplanner-goal-summary" });
    summary.setAttr("aria-label", node.title);
    const dragHandle = summary.createEl("span", {
      cls: "lifeplanner-goal-drag-handle",
      text: "\u22EE\u22EE"
    });
    dragHandle.setAttr("draggable", "true");
    summary.createEl("span", {
      cls: "lifeplanner-goal-title",
      text: node.level ? `\u3010${node.level}\u3011${node.title}` : node.title
    });
    const menuWrap = summary.createEl("div", { cls: "lifeplanner-goal-menu" });
    const menuButton = menuWrap.createEl("button", { text: "\u22EF" });
    menuButton.setAttr("type", "button");
    menuButton.setAttr("aria-label", "\u30E1\u30CB\u30E5\u30FC");
    const menuList = menuWrap.createEl("div", { cls: "lifeplanner-goal-menu-list" });
    const editButton = menuList.createEl("button", { text: "\u7DE8\u96C6" });
    const deleteButton = menuList.createEl("button", { text: "\u524A\u9664" });
    const addChildButton = menuList.createEl("button", { text: "\u5B50\u3092\u8FFD\u52A0" });
    editButton.setAttr("type", "button");
    deleteButton.setAttr("type", "button");
    addChildButton.setAttr("type", "button");
    const meta = card.createEl("div", { cls: "lifeplanner-goal-meta" });
    if (node.parentTitle) {
      meta.createEl("div", { text: `\u89AA: ${node.parentTitle}` });
    }
    if (node.dueDate) {
      meta.createEl("div", { text: `\u671F\u9650: ${node.dueDate}` });
    }
    if (node.description) {
      card.createEl("div", { text: node.description, cls: "lifeplanner-goal-desc" });
    }
    menuButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      menuList.classList.toggle("is-open");
    });
    editButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      menuList.classList.remove("is-open");
      onEdit(node);
    });
    deleteButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      menuList.classList.remove("is-open");
      onDelete(node);
    });
    addChildButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      menuList.classList.remove("is-open");
      onAddChild(node);
    });
    card.addEventListener("toggle", () => {
      onToggle(node, card.open);
    });
    dragHandle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    dragHandle.addEventListener("dragstart", (event) => {
      event.dataTransfer?.setData("text/plain", node.id);
      event.dataTransfer?.setData("lifeplanner-goal", node.id);
      event.dataTransfer?.setData("lifeplanner-goal-id", node.id);
      event.dataTransfer?.setDragImage(card, 0, 0);
      card.classList.add("is-dragging");
    });
    dragHandle.addEventListener("dragend", () => {
      card.classList.remove("is-dragging");
    });
    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = card.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      const position = event.clientY > midpoint ? "after" : "before";
      card.classList.toggle("is-drop-before", position === "before");
      card.classList.toggle("is-drop-after", position === "after");
    });
    card.addEventListener("dragleave", () => {
      card.classList.remove("is-drop-before", "is-drop-after");
    });
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const sourceId = event.dataTransfer?.getData("lifeplanner-goal-id") || event.dataTransfer?.getData("lifeplanner-goal") || event.dataTransfer?.getData("text/plain");
      if (!sourceId) {
        card.classList.remove("is-drop-before", "is-drop-after");
        return;
      }
      const rect = card.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      const position = event.clientY > midpoint ? "after" : "before";
      card.classList.remove("is-drop-before", "is-drop-after");
      onMove(sourceId, node, position);
    });
    if (node.children.length > 0) {
      const childContainer = card.createEl("div", { cls: "lifeplanner-goal-children" });
      renderGoalTree(
        childContainer,
        node.children,
        depth + 1,
        onEdit,
        onDelete,
        onAddChild,
        onMove,
        onToggle
      );
    }
  }
}
function levelsBelow(current) {
  const index = LEVELS.indexOf(current);
  if (index < 0 || index + 1 >= LEVELS.length) {
    return [current];
  }
  return LEVELS.slice(index + 1);
}
var GoalEditModal = class extends import_obsidian4.Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "\u76EE\u6A19\u306E\u7DE8\u96C6" });
    const form = contentEl.createEl("div", { cls: "lifeplanner-form" });
    const levelField = form.createEl("div", { cls: "lifeplanner-form-field" });
    levelField.createEl("label", { text: "\u30AB\u30C6\u30B4\u30EA" });
    const levelSelect = levelField.createEl("select");
    for (const level of this.options.allowedLevels) {
      levelSelect.createEl("option", { text: level, value: level });
    }
    levelSelect.value = this.options.level;
    levelSelect.disabled = this.options.lockLevel;
    const parentField = form.createEl("div", { cls: "lifeplanner-form-field" });
    parentField.createEl("label", { text: "\u89AA\u76EE\u6A19" });
    const parentInput = parentField.createEl("input", { type: "text" });
    parentInput.value = this.options.parentGoalId;
    parentInput.readOnly = this.options.lockParent;
    const titleField = form.createEl("div", { cls: "lifeplanner-form-field" });
    titleField.createEl("label", { text: "\u76EE\u6A19\u30BF\u30A4\u30C8\u30EB" });
    const titleInput = titleField.createEl("input", { type: "text" });
    titleInput.value = this.options.title;
    const descField = form.createEl("div", { cls: "lifeplanner-form-field" });
    descField.createEl("label", { text: "\u8AAC\u660E\u6587" });
    const descInput = descField.createEl("textarea");
    descInput.rows = 4;
    descInput.value = this.options.description;
    const dueField = form.createEl("div", { cls: "lifeplanner-form-field" });
    dueField.createEl("label", { text: "\u671F\u9650" });
    const dueInput = dueField.createEl("input", { type: "date" });
    dueInput.value = this.options.dueDate;
    const actions = contentEl.createEl("div", { cls: "lifeplanner-goal-actions" });
    const saveButton = actions.createEl("button", { text: "\u4FDD\u5B58" });
    const cancelButton = actions.createEl("button", { text: "\u30AD\u30E3\u30F3\u30BB\u30EB" });
    saveButton.addEventListener("click", () => {
      const title = titleInput.value.trim();
      if (!title) {
        return;
      }
      void this.options.onSubmit({
        title,
        description: descInput.value.trim(),
        parentGoalId: parentInput.value.trim(),
        level: levelSelect.value,
        dueDate: dueInput.value.trim()
      });
      this.close();
    });
    cancelButton.addEventListener("click", () => {
      this.close();
    });
  }
};

// src/ui/inbox_view.ts
var import_obsidian5 = require("obsidian");

// src/services/inbox_service.ts
var InboxService = class {
  constructor(repository, baseDir) {
    this.repository = repository;
    this.baseDir = baseDir;
  }
  async listItems() {
    const content = await this.repository.read(resolveLifePlannerPath("Inbox", this.baseDir));
    if (!content) {
      return [];
    }
    return parseInboxItems(content);
  }
  async addItem(content) {
    const items = await this.listItems();
    const item = {
      id: `inbox-${Date.now()}`,
      content,
      destination: "none",
      status: "new"
    };
    items.push(item);
    await this.saveItems(items);
    return item;
  }
  async markTriaged(itemId, destination) {
    const items = await this.listItems();
    const remaining = items.filter((item) => item.id !== itemId);
    await this.saveItems(remaining);
  }
  async saveItems(items) {
    const content = serializeInboxItems(items);
    await this.repository.write(resolveLifePlannerPath("Inbox", this.baseDir), content);
  }
};
function parseInboxItems(content) {
  const items = [];
  const lines = content.split("\n");
  for (const line of lines) {
    const match = line.match(/^- \[.\] (.+?)(?: \[dest:(.+)\])?$/);
    if (!match) {
      continue;
    }
    const destination = match[2] || "none";
    items.push({
      id: `inbox-${items.length}`,
      content: match[1].trim(),
      destination,
      status: destination === "none" ? "new" : "triaged"
    });
  }
  return items;
}
function serializeInboxItems(items) {
  const lines = [];
  lines.push("# Inbox");
  lines.push("");
  if (items.length === 0) {
    lines.push("- [ ] ");
  } else {
    for (const item of items) {
      const dest = item.destination === "none" ? "" : ` [dest:${item.destination}]`;
      lines.push(`- [ ] ${item.content}${dest}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

// src/services/weekly_plan_io.ts
var DAYS = ["\u6708", "\u706B", "\u6C34", "\u6728", "\u91D1", "\u571F", "\u65E5"];
var ROUTINE_DAYS = ["\u6708", "\u706B", "\u6C34", "\u6728", "\u91D1", "\u571F"];
function serializeWeeklyPlan(plan) {
  const lines = [];
  lines.push("# \u9031\u9593\u8A08\u753B");
  lines.push("");
  lines.push(`\u9031\u8868\u793A: ${plan.weekLabel ?? ""}`);
  lines.push("");
  lines.push("## \u4ECA\u6708\u306E\u30C6\u30FC\u30DE");
  lines.push("");
  lines.push(plan.monthTheme ? `- ${plan.monthTheme}` : "- ");
  lines.push("");
  lines.push("## \u30EB\u30FC\u30C6\u30A3\u30F3\u884C\u52D5");
  lines.push("");
  lines.push(`| \u884C\u52D5 | ${ROUTINE_DAYS.join(" | ")} |`);
  lines.push(`| --- | ${ROUTINE_DAYS.map(() => "---").join(" | ")} |`);
  if (plan.routineActions.length === 0) {
    lines.push(`|  | ${ROUTINE_DAYS.map(() => "[ ]").join(" | ")} |`);
  } else {
    for (const action of plan.routineActions) {
      const checks = ROUTINE_DAYS.map((day) => action.checks[day] ? "[x]" : "[ ]");
      lines.push(`| ${action.title} | ${checks.join(" | ")} |`);
    }
  }
  lines.push("");
  lines.push("## \u5F79\u5272\u3068\u91CD\u70B9\u30BF\u30B9\u30AF");
  lines.push("");
  if (plan.roles.length === 0) {
    lines.push("### \u5F79\u52721");
    lines.push("- ");
    lines.push("");
  } else {
    for (const role of plan.roles) {
      lines.push(`### ${role.role}`);
      if (role.goals.length === 0) {
        lines.push("- ");
      } else {
        for (const goal of role.goals) {
          lines.push(`- ${goal}`);
        }
      }
      lines.push("");
    }
  }
  lines.push("## \u30A2\u30AF\u30B7\u30E7\u30F3\u30D7\u30E9\u30F3");
  lines.push("");
  if (plan.actionPlans.length === 0) {
    lines.push("- [ ] ");
  } else {
    for (const item of plan.actionPlans) {
      const checked = item.done ? "[x]" : "[ ]";
      lines.push(`- ${checked} ${item.title}`);
    }
  }
  lines.push("## \u4ECA\u9031\u306E\u632F\u308A\u8FD4\u308A");
  lines.push("");
  lines.push("### \u826F\u304B\u3063\u305F\u3053\u3068");
  if (plan.reflectionGood.length === 0) {
    lines.push("- ");
  } else {
    for (const item of plan.reflectionGood) {
      lines.push(`- ${item}`);
    }
  }
  lines.push("");
  lines.push("### \u8AB2\u984C");
  if (plan.reflectionIssues.length === 0) {
    lines.push("- ");
  } else {
    for (const item of plan.reflectionIssues) {
      lines.push(`- ${item}`);
    }
  }
  lines.push("");
  lines.push("## \u65E5\u4ED8\u3054\u3068\u306E\u4E00\u8A00\u30E1\u30E2\u6B04");
  lines.push("");
  for (const day of DAYS) {
    lines.push(`### ${day}`);
    const memos = plan.dailyMemos[day] ?? [];
    if (memos.length === 0) {
      lines.push("- ");
    } else {
      for (const memo of memos) {
        lines.push(`- ${memo}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}
function parseWeeklyPlan(content) {
  const slots = DAYS.map((day) => ({ day, entries: [] }));
  const dailyMemos = {
    \u6708: [],
    \u706B: [],
    \u6C34: [],
    \u6728: [],
    \u91D1: [],
    \u571F: [],
    \u65E5: []
  };
  const routineActions = [];
  const roles = [];
  const reflectionGood = [];
  const reflectionIssues = [];
  const actionPlans = [];
  let monthTheme = "";
  let weekLabel = "";
  let section = "";
  let currentDay = null;
  let currentRole = null;
  const lines = content.split("\n");
  for (const line of lines) {
    if (line.startsWith("## ")) {
      section = line.replace(/^##\s+/, "");
      currentDay = null;
      currentRole = null;
      continue;
    }
    if (line.startsWith("\u9031\u8868\u793A:")) {
      weekLabel = line.replace("\u9031\u8868\u793A:", "").trim();
      continue;
    }
    if (section === "\u4ECA\u6708\u306E\u30C6\u30FC\u30DE") {
      const match = line.match(/^\-\s*(.+)$/);
      if (match && match[1].trim()) {
        monthTheme = match[1].trim();
      }
      continue;
    }
    if (section === "\u30EB\u30FC\u30C6\u30A3\u30F3\u884C\u52D5") {
      if (line.startsWith("|")) {
        const cells = line.split("|").map((cell) => cell.trim());
        if (cells.length >= 3 && cells[1] !== "\u884C\u52D5" && cells[1] !== "---") {
          const title = cells[1] || "";
          if (title) {
            const checks = {};
            ROUTINE_DAYS.forEach((day, idx) => {
              const cell = cells[idx + 2] || "";
              checks[day] = cell.includes("[x]");
            });
            routineActions.push({ title, checks });
          }
        }
      }
      continue;
    }
    if (section === "\u5F79\u5272\u3068\u91CD\u70B9\u30BF\u30B9\u30AF") {
      const roleMatch = line.match(/^###\s+(.+)$/);
      if (roleMatch) {
        currentRole = { role: roleMatch[1].trim(), goals: [] };
        roles.push(currentRole);
        continue;
      }
      const goalMatch = line.match(/^\-\s*(.+)$/);
      if (goalMatch && currentRole && goalMatch[1].trim()) {
        currentRole.goals.push(goalMatch[1].trim());
      }
      continue;
    }
    if (section === "\u30A2\u30AF\u30B7\u30E7\u30F3\u30D7\u30E9\u30F3") {
      const itemMatch = line.match(/^\-\s*\[( |x)\]\s*(.+)$/);
      if (itemMatch && itemMatch[2].trim()) {
        actionPlans.push({ title: itemMatch[2].trim(), done: itemMatch[1] === "x" });
      }
      continue;
    }
    if (section === "\u4ECA\u9031\u306E\u632F\u308A\u8FD4\u308A") {
      if (line.startsWith("### \u826F\u304B\u3063\u305F\u3053\u3068")) {
        currentDay = "good";
        continue;
      }
      if (line.startsWith("### \u8AB2\u984C")) {
        currentDay = "issue";
        continue;
      }
      const entryMatch = line.match(/^\-\s*(.+)$/);
      if (entryMatch && entryMatch[1].trim()) {
        if (currentDay === "good") {
          reflectionGood.push(entryMatch[1].trim());
        } else if (currentDay === "issue") {
          reflectionIssues.push(entryMatch[1].trim());
        }
      }
      continue;
    }
    if (section === "\u65E5\u4ED8\u3054\u3068\u306E\u4E00\u8A00\u30E1\u30E2\u6B04") {
      const dayMatch = line.match(/^###\s+([月火水木金土日])$/);
      if (dayMatch) {
        currentDay = dayMatch[1];
        continue;
      }
      const entryMatch = line.match(/^\-\s*(.+)$/);
      if (entryMatch && currentDay && entryMatch[1].trim()) {
        dailyMemos[currentDay].push(entryMatch[1].trim());
      }
    }
  }
  return {
    id: "weekly",
    weekStart: "",
    weekEnd: "",
    weeklyGoals: [],
    weekLabel,
    monthTheme,
    routineActions,
    roles,
    actionPlans,
    reflectionGood,
    reflectionIssues,
    dailyMemos,
    slots
  };
}

// src/services/inbox_triage.ts
var InboxTriage = class {
  constructor(repository, baseDir, weekStart) {
    this.repository = repository;
    this.baseDir = baseDir;
    this.weekStart = weekStart;
    this.goalsService = new GoalsService(repository, baseDir);
    this.tasksService = new TasksService(repository, baseDir);
  }
  async toGoal(item) {
    await this.goalsService.addGoal("\u9031\u9593", item.content);
  }
  async toTask(item) {
    await this.tasksService.addTask("\u9031\u9593", item.content);
  }
  async toWeekly(item) {
    const weekStart = computeWeekStart(/* @__PURE__ */ new Date(), 0, this.weekStart);
    const path = resolveWeeklyPlanPath(weekStart, this.baseDir);
    const content = await this.repository.read(path);
    const plan = content ? parseWeeklyPlan(content) : emptyPlan();
    plan.actionPlans.push({ title: item.content, done: false });
    await this.repository.write(path, serializeWeeklyPlan(plan));
  }
};
function emptyPlan() {
  return {
    id: "weekly",
    weekStart: "",
    weekEnd: "",
    slots: [
      { day: "\u6708", entries: [] },
      { day: "\u706B", entries: [] },
      { day: "\u6C34", entries: [] },
      { day: "\u6728", entries: [] },
      { day: "\u91D1", entries: [] },
      { day: "\u571F", entries: [] },
      { day: "\u65E5", entries: [] }
    ],
    weeklyGoals: [],
    weekLabel: "",
    monthTheme: "",
    routineActions: [],
    roles: [],
    actionPlans: [],
    reflectionGood: [],
    reflectionIssues: [],
    dailyMemos: { \u6708: [], \u706B: [], \u6C34: [], \u6728: [], \u91D1: [], \u571F: [], \u65E5: [] },
    reviewNotes: ""
  };
}
function computeWeekStart(today, offset, weekStart) {
  const base = new Date(today);
  base.setDate(base.getDate() + offset * 7);
  const day = base.getDay();
  const startIndex = weekStart === "sunday" ? 0 : 1;
  const diff = (day - startIndex + 7) % 7;
  const start = new Date(base);
  start.setDate(base.getDate() - diff);
  return start;
}

// src/ui/inbox_view.ts
var InboxView = class extends import_obsidian5.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.listEl = null;
    this.statusEl = null;
    this.plugin = plugin;
    const repository = new MarkdownRepository(this.plugin.app);
    this.inboxService = new InboxService(repository, this.plugin.settings.storageDir);
    this.inboxTriage = new InboxTriage(
      repository,
      this.plugin.settings.storageDir,
      this.plugin.settings.weekStart
    );
  }
  getViewType() {
    return INBOX_VIEW_TYPE;
  }
  getDisplayText() {
    return "Inbox";
  }
  async onOpen() {
    const container = this.contentEl;
    container.empty();
    const view = container.createEl("div", { cls: "lifeplanner-view" });
    view.createEl("h2", { text: "Inbox" });
    renderNavigation(view, (viewType) => {
      void this.plugin.openViewInLeaf(viewType, this.leaf);
    });
    const form = view.createEl("div", { cls: "lifeplanner-inbox-form lifeplanner-form" });
    const input = form.createEl("input", { type: "text" });
    input.placeholder = "\u30E1\u30E2\u3092\u5165\u529B";
    const addButton = form.createEl("button", { text: "\u8FFD\u52A0" });
    this.statusEl = view.createEl("div", { cls: "lifeplanner-inbox-status" });
    this.listEl = view.createEl("div", { cls: "lifeplanner-inbox-list" });
    addButton.addEventListener("click", () => {
      void this.handleAdd(input.value.trim());
      input.value = "";
    });
    await this.renderItems();
  }
  async onClose() {
    this.listEl = null;
    this.statusEl = null;
  }
  async handleAdd(content) {
    if (!content) {
      this.setStatus("\u30E1\u30E2\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
      return;
    }
    await this.inboxService.addItem(content);
    this.setStatus("\u8FFD\u52A0\u3057\u307E\u3057\u305F");
    await this.renderItems();
  }
  async handleTriage(item, destination) {
    if (destination === "goal") {
      await this.inboxTriage.toGoal(item);
    } else if (destination === "task") {
      await this.inboxTriage.toTask(item);
    } else {
      await this.inboxTriage.toWeekly(item);
    }
    await this.inboxService.markTriaged(item.id, destination);
    this.setStatus("\u632F\u308A\u5206\u3051\u307E\u3057\u305F");
    await this.renderItems();
  }
  async renderItems() {
    if (!this.listEl) {
      return;
    }
    this.listEl.empty();
    const items = await this.inboxService.listItems();
    if (items.length === 0) {
      this.listEl.createEl("div", { text: "(\u672A\u767B\u9332)" });
      return;
    }
    for (const item of items) {
      const row = this.listEl.createEl("div", { cls: "lifeplanner-inbox-row" });
      row.createEl("span", { text: item.content });
      const controls = row.createEl("div", { cls: "lifeplanner-inbox-controls" });
      const toGoal = controls.createEl("button", { text: "\u76EE\u6A19\u3078" });
      const toTask = controls.createEl("button", { text: "\u30BF\u30B9\u30AF\u3078" });
      const toWeekly = controls.createEl("button", { text: "\u9031\u9593\u3078" });
      toGoal.addEventListener("click", () => void this.handleTriage(item, "goal"));
      toTask.addEventListener("click", () => void this.handleTriage(item, "task"));
      toWeekly.addEventListener("click", () => void this.handleTriage(item, "weekly"));
    }
  }
  setStatus(message) {
    if (!this.statusEl) {
      return;
    }
    this.statusEl.setText(message);
    window.setTimeout(() => {
      this.statusEl?.setText("");
    }, 2e3);
  }
};

// src/ui/issues_view.ts
var import_obsidian6 = require("obsidian");

// src/services/issues_service.ts
var IssuesService = class {
  constructor(repository, baseDir) {
    this.repository = repository;
    this.baseDir = baseDir;
  }
  async listIssues() {
    const path = resolveLifePlannerPath("Issues", this.baseDir);
    const content = await this.repository.read(path);
    if (!content) {
      await this.repository.write(path, serializeIssues([]));
      return [];
    }
    return parseIssues(content);
  }
  async saveIssues(issues) {
    const content = serializeIssues(issues);
    await this.repository.write(resolveLifePlannerPath("Issues", this.baseDir), content);
  }
};
function serializeIssues(issues) {
  const lines = [];
  lines.push("# Issues");
  lines.push("");
  const grouped = /* @__PURE__ */ new Map();
  for (const issue of issues) {
    const list = grouped.get(issue.status) ?? [];
    list.push(issue);
    grouped.set(issue.status, list);
  }
  for (const [status, items] of grouped) {
    lines.push(`## ${status}`);
    lines.push("");
    for (const issue of items) {
      lines.push(`### ${issue.title}`);
      lines.push(`ID: ${issue.id}`);
      if (issue.linkedGoalId) {
        lines.push(`Goal: ${issue.linkedGoalId}`);
      }
      if (issue.tags && issue.tags.length > 0) {
        lines.push(`Tags: ${issue.tags.join(", ")}`);
      }
      if (issue.dueDate) {
        lines.push(`Due: ${issue.dueDate}`);
      }
      if (issue.priority) {
        lines.push(`Priority: ${issue.priority}`);
      }
      lines.push("");
      if (issue.body) {
        lines.push(issue.body);
      } else {
        lines.push("- ");
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}
function parseIssues(content) {
  const issues = [];
  const lines = content.split("\n");
  let currentStatus = "";
  let current = null;
  let bodyLines = [];
  const flush = () => {
    if (!current) {
      return;
    }
    current.body = bodyLines.join("\n").trim();
    issues.push(current);
    current = null;
    bodyLines = [];
  };
  for (const line of lines) {
    const statusMatch = line.match(/^##\s+(.+)$/);
    if (statusMatch) {
      flush();
      currentStatus = statusMatch[1].trim();
      continue;
    }
    const issueMatch = line.match(/^###\s+(.+)$/);
    if (issueMatch) {
      flush();
      const title = issueMatch[1].trim();
      current = {
        id: `issue-${Date.now()}`,
        title,
        status: currentStatus || "Backlog",
        body: ""
      };
      continue;
    }
    if (!current) {
      continue;
    }
    if (line.startsWith("ID:")) {
      const id = line.replace("ID:", "").trim();
      current.id = id || current.id;
      continue;
    }
    if (line.startsWith("Goal:")) {
      const goal = line.replace("Goal:", "").trim();
      current.linkedGoalId = goal || void 0;
      continue;
    }
    if (line.startsWith("Tags:")) {
      const raw = line.replace("Tags:", "").trim();
      current.tags = raw ? raw.split(",").map((tag) => tag.trim()).filter(Boolean) : void 0;
      continue;
    }
    if (line.startsWith("Due:")) {
      const due = line.replace("Due:", "").trim();
      current.dueDate = due || void 0;
      continue;
    }
    if (line.startsWith("Priority:")) {
      const priority = line.replace("Priority:", "").trim();
      current.priority = priority || void 0;
      continue;
    }
    bodyLines.push(line);
  }
  flush();
  return issues;
}

// src/ui/issues_view.ts
var PRIORITIES = ["Low", "Medium", "High"];
var IssuesView = class extends import_obsidian6.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.listEl = null;
    this.statusEl = null;
    this.issues = [];
    this.handleMenuClose = null;
    this.plugin = plugin;
    const repo = new MarkdownRepository(this.plugin.app);
    this.issuesService = new IssuesService(repo, this.plugin.settings.storageDir);
    this.goalsService = new GoalsService(repo, this.plugin.settings.storageDir);
  }
  getViewType() {
    return ISSUES_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u30A4\u30B7\u30E5\u30FC";
  }
  async onOpen() {
    const container = this.contentEl;
    container.empty();
    const view = container.createEl("div", { cls: "lifeplanner-view" });
    view.createEl("h2", { text: "\u30A4\u30B7\u30E5\u30FC" });
    renderNavigation(view, (viewType) => {
      void this.plugin.openViewInLeaf(viewType, this.leaf);
    });
    this.statusEl = view.createEl("div", { cls: "lifeplanner-issues-status" });
    this.listEl = view.createEl("div", { cls: "lifeplanner-kanban" });
    this.handleMenuClose = (event) => {
      const target = event.target;
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
  async onClose() {
    this.listEl = null;
    this.statusEl = null;
    this.issues = [];
    if (this.handleMenuClose) {
      document.removeEventListener("mousedown", this.handleMenuClose, true);
      this.handleMenuClose = null;
    }
  }
  async renderBoard() {
    if (!this.listEl) {
      return;
    }
    this.listEl.empty();
    const columns = this.plugin.settings.kanbanColumns.length ? this.plugin.settings.kanbanColumns : ["Backlog"];
    this.issues = await this.issuesService.listIssues();
    const goals = await this.goalsService.listGoals();
    const grouped = {};
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
      const addButton = header.createEl("button", { text: "\u8FFD\u52A0" });
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
        const issueId = event.dataTransfer?.getData("lifeplanner-issue") || event.dataTransfer?.getData("text/plain");
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
            body: ""
          },
          columns,
          goals.map((goal) => goal.title),
          true
        );
      });
      const items = grouped[column] ?? [];
      if (items.length === 0) {
        list.createEl("div", { text: "(\u7A7A)", cls: "lifeplanner-kanban-empty" });
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
        const menuButton = menu.createEl("button", { text: "\u22EF" });
        menuButton.setAttr("type", "button");
        const menuList = menu.createEl("div", { cls: "lifeplanner-kanban-menu-list" });
        const editButton = menuList.createEl("button", { text: "\u7DE8\u96C6" });
        const deleteButton = menuList.createEl("button", { text: "\u524A\u9664" });
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
          const body = card.createEl("div", { cls: "lifeplanner-kanban-body" });
          void import_obsidian6.MarkdownRenderer.renderMarkdown(issue.body, body, "", this);
        }
      }
    }
  }
  async moveIssue(issueId, status) {
    const updated = this.issues.map(
      (issue) => issue.id === issueId ? { ...issue, status } : issue
    );
    await this.issuesService.saveIssues(updated);
    this.setStatus("\u79FB\u52D5\u3057\u307E\u3057\u305F");
    await this.renderBoard();
  }
  async deleteIssue(issue) {
    const ok = window.confirm(`"${issue.title}" \u3092\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F`);
    if (!ok) {
      return;
    }
    const updated = this.issues.filter((item) => item.id !== issue.id);
    await this.issuesService.saveIssues(updated);
    this.setStatus("\u524A\u9664\u3057\u307E\u3057\u305F");
    await this.renderBoard();
  }
  openIssueModal(issue, columns, goals, isNew) {
    const modal = new IssueEditModal(this.app, issue, columns, goals, async (updated) => {
      const others = this.issues.filter((item) => item.id !== updated.id);
      const next = isNew ? [...others, updated] : [...others, updated];
      await this.issuesService.saveIssues(next);
      this.setStatus(isNew ? "\u8FFD\u52A0\u3057\u307E\u3057\u305F" : "\u66F4\u65B0\u3057\u307E\u3057\u305F");
      await this.renderBoard();
    });
    modal.open();
  }
  setStatus(message) {
    if (!this.statusEl) {
      return;
    }
    this.statusEl.setText(message);
    window.setTimeout(() => {
      this.statusEl?.setText("");
    }, 2e3);
  }
};
var IssueEditModal = class extends import_obsidian6.Modal {
  constructor(app, issue, columns, goals, onSubmit) {
    super(app);
    this.issue = { ...issue };
    this.columns = columns;
    this.goals = goals;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const content = this.contentEl;
    content.empty();
    content.createEl("h3", { text: "Issue" });
    const titleField = content.createEl("div", { cls: "lifeplanner-form-field" });
    titleField.createEl("label", { text: "\u30BF\u30A4\u30C8\u30EB" });
    const titleInput = titleField.createEl("input", { type: "text" });
    titleInput.value = this.issue.title;
    const statusField = content.createEl("div", { cls: "lifeplanner-form-field" });
    statusField.createEl("label", { text: "\u5217" });
    const statusSelect = statusField.createEl("select");
    this.columns.forEach((column) => {
      statusSelect.createEl("option", { text: column, value: column });
    });
    statusSelect.value = this.issue.status || this.columns[0];
    const goalField = content.createEl("div", { cls: "lifeplanner-form-field" });
    goalField.createEl("label", { text: "\u95A2\u9023\u76EE\u6A19" });
    const goalSelect = goalField.createEl("select");
    goalSelect.createEl("option", { text: "\u306A\u3057", value: "" });
    this.goals.forEach((goal) => {
      goalSelect.createEl("option", { text: goal, value: goal });
    });
    goalSelect.value = this.issue.linkedGoalId ?? "";
    const tagsField = content.createEl("div", { cls: "lifeplanner-form-field" });
    tagsField.createEl("label", { text: "\u30BF\u30B0" });
    const tagsInput = tagsField.createEl("input", { type: "text" });
    tagsInput.placeholder = "tag1, tag2";
    tagsInput.value = this.issue.tags?.join(", ") ?? "";
    const dueField = content.createEl("div", { cls: "lifeplanner-form-field" });
    dueField.createEl("label", { text: "\u671F\u9650" });
    const dueInput = dueField.createEl("input", { type: "date" });
    dueInput.value = this.issue.dueDate ?? "";
    const priorityField = content.createEl("div", { cls: "lifeplanner-form-field" });
    priorityField.createEl("label", { text: "\u512A\u5148\u5EA6" });
    const prioritySelect = priorityField.createEl("select");
    prioritySelect.createEl("option", { text: "\u672A\u8A2D\u5B9A", value: "" });
    PRIORITIES.forEach((priority) => {
      prioritySelect.createEl("option", { text: priority, value: priority });
    });
    prioritySelect.value = this.issue.priority ?? "";
    const bodyField = content.createEl("div", { cls: "lifeplanner-form-field" });
    bodyField.createEl("label", { text: "\u672C\u6587" });
    const bodyInput = bodyField.createEl("textarea");
    bodyInput.rows = 6;
    bodyInput.value = this.issue.body ?? "";
    const action = content.createEl("div", { cls: "lifeplanner-form-field" });
    const saveButton = action.createEl("button", { text: "\u4FDD\u5B58" });
    saveButton.addEventListener("click", async () => {
      const title = titleInput.value.trim();
      if (!title) {
        return;
      }
      const tags = tagsInput.value.split(",").map((tag) => tag.trim()).filter((tag) => tag.length > 0);
      const updated = {
        ...this.issue,
        title,
        status: statusSelect.value || this.columns[0],
        linkedGoalId: goalSelect.value || void 0,
        tags: tags.length > 0 ? tags : void 0,
        dueDate: dueInput.value || void 0,
        priority: prioritySelect.value || void 0,
        body: bodyInput.value.trim()
      };
      await this.onSubmit(updated);
      this.close();
    });
  }
};

// src/ui/simple_section_view.ts
var import_obsidian7 = require("obsidian");

// src/services/simple_section_service.ts
var SimpleSectionService = class {
  constructor(repository, type, title, baseDir) {
    this.repository = repository;
    this.type = type;
    this.title = title;
    this.baseDir = baseDir;
  }
  async load() {
    const content = await this.repository.read(resolveLifePlannerPath(this.type, this.baseDir));
    if (!content) {
      await this.repository.write(resolveLifePlannerPath(this.type, this.baseDir), this.serialize(""));
      return "";
    }
    return this.parse(content);
  }
  async save(body) {
    await this.repository.write(resolveLifePlannerPath(this.type, this.baseDir), this.serialize(body));
  }
  serialize(body) {
    const lines = [];
    lines.push(`# ${this.title}`);
    lines.push("");
    if (body.trim().length > 0) {
      lines.push(body.trim());
    } else {
      lines.push("- ");
    }
    lines.push("");
    return lines.join("\n");
  }
  parse(content) {
    const lines = content.split("\n");
    const body = [];
    let started = false;
    for (const line of lines) {
      if (line.startsWith("#")) {
        if (!started) {
          started = true;
          continue;
        }
      }
      if (!started) {
        continue;
      }
      body.push(line);
    }
    return body.join("\n").trim();
  }
};

// src/ui/simple_section_view.ts
var SimpleSectionView = class extends import_obsidian7.ItemView {
  constructor(leaf, plugin, viewType, type, titleText) {
    super(leaf);
    this.statusEl = null;
    this.inputEl = null;
    this.plugin = plugin;
    this.viewType = viewType;
    this.titleText = titleText;
    this.service = new SimpleSectionService(
      new MarkdownRepository(this.plugin.app),
      type,
      titleText,
      this.plugin.settings.storageDir
    );
  }
  getDisplayText() {
    return this.titleText;
  }
  getViewType() {
    return this.viewType;
  }
  async onOpen() {
    const container = this.contentEl;
    container.empty();
    const view = container.createEl("div", { cls: "lifeplanner-view" });
    view.createEl("h2", { text: this.titleText });
    renderNavigation(view, (viewType) => {
      void this.plugin.openViewInLeaf(viewType, this.leaf);
    });
    this.statusEl = view.createEl("div", { cls: "lifeplanner-exercises-status" });
    this.inputEl = view.createEl("textarea");
    this.inputEl.rows = 12;
    this.inputEl.value = await this.service.load();
    this.inputEl.addEventListener("input", () => {
      void this.service.save(this.inputEl?.value ?? "");
      this.setStatus("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
    });
  }
  async onClose() {
    this.statusEl = null;
    this.inputEl = null;
  }
  setStatus(message) {
    if (!this.statusEl) {
      return;
    }
    this.statusEl.setText(message);
    window.setTimeout(() => {
      this.statusEl?.setText("");
    }, 2e3);
  }
};

// src/ui/table_section_view.ts
var import_obsidian8 = require("obsidian");
var TableSectionView = class extends import_obsidian8.ItemView {
  constructor(leaf, plugin, viewType, type, titleText, columns) {
    super(leaf);
    this.statusEl = null;
    this.rows = [];
    this.tableEl = null;
    this.plugin = plugin;
    this.viewType = viewType;
    this.titleText = titleText;
    this.columns = columns;
    this.service = new TableSectionService(
      new MarkdownRepository(this.plugin.app),
      type,
      titleText,
      columns,
      this.plugin.settings.storageDir
    );
  }
  getViewType() {
    return this.viewType;
  }
  getDisplayText() {
    return this.titleText;
  }
  async onOpen() {
    const container = this.contentEl;
    container.empty();
    const view = container.createEl("div", { cls: "lifeplanner-view" });
    view.createEl("h2", { text: this.titleText });
    renderNavigation(view, (viewType) => {
      void this.plugin.openViewInLeaf(viewType, this.leaf);
    });
    this.statusEl = view.createEl("div", { cls: "lifeplanner-exercises-status" });
    const header = view.createEl("div", { cls: "lifeplanner-table-actions" });
    const addButton = header.createEl("button", { text: "\u8FFD\u52A0" });
    this.tableEl = view.createEl("div", { cls: "lifeplanner-table-grid" });
    await this.renderTable();
    addButton.addEventListener("click", () => {
      this.rows.push([]);
      void this.save();
      void this.renderTable();
    });
  }
  async onClose() {
    this.statusEl = null;
    this.tableEl = null;
    this.rows = [];
  }
  async renderTable() {
    if (!this.tableEl) {
      return;
    }
    this.tableEl.empty();
    this.tableEl.style.gridTemplateColumns = this.columns.map((column) => {
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
    }).join(" ");
    this.rows = await this.service.loadRows();
    if (this.rows.length === 0) {
      this.rows.push([]);
    }
    this.columns.forEach((column) => {
      this.tableEl?.createEl("div", {
        cls: "lifeplanner-table-cell lifeplanner-table-header",
        text: column.label
      });
    });
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
          const input = cell.createEl("input", { type: "text" });
          input.value = value;
          input.addEventListener("input", () => {
            this.setCell(rowIndex, colIndex, input.value);
          });
        }
      });
    });
  }
  setCell(rowIndex, colIndex, value) {
    const row = this.rows[rowIndex] ?? [];
    row[colIndex] = value;
    this.rows[rowIndex] = row;
    void this.save();
  }
  async save() {
    await this.service.saveRows(this.rows);
    this.setStatus("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
  }
  setStatus(message) {
    if (!this.statusEl) {
      return;
    }
    this.statusEl.setText(message);
    window.setTimeout(() => {
      this.statusEl?.setText("");
    }, 2e3);
  }
};

// src/ui/weekly_plan_view.ts
var import_obsidian9 = require("obsidian");

// src/services/weekly_shared_io.ts
var ROUTINE_DAYS2 = ["\u6708", "\u706B", "\u6C34", "\u6728", "\u91D1", "\u571F"];
function serializeWeeklyShared(shared) {
  const lines = [];
  lines.push("# \u9031\u9593\u5171\u6709");
  lines.push("");
  lines.push("## \u30EB\u30FC\u30C6\u30A3\u30F3\u884C\u52D5");
  lines.push("");
  lines.push(`| \u884C\u52D5 | ${ROUTINE_DAYS2.join(" | ")} |`);
  lines.push(`| --- | ${ROUTINE_DAYS2.map(() => "---").join(" | ")} |`);
  if (shared.routineActions.length === 0) {
    lines.push(`|  | ${ROUTINE_DAYS2.map(() => "[ ]").join(" | ")} |`);
  } else {
    for (const action of shared.routineActions) {
      const checks = ROUTINE_DAYS2.map((day) => action.checks[day] ? "[x]" : "[ ]");
      lines.push(`| ${action.title} | ${checks.join(" | ")} |`);
    }
  }
  lines.push("");
  lines.push("## \u5F79\u5272\u3068\u91CD\u70B9\u30BF\u30B9\u30AF");
  lines.push("");
  if (shared.roles.length === 0) {
    lines.push("### \u5F79\u52721");
    lines.push("");
  } else {
    for (const role of shared.roles) {
      lines.push(`### ${role}`);
      lines.push("");
    }
  }
  lines.push("## \u6708\u9593\u30C6\u30FC\u30DE");
  lines.push("");
  const entries = Object.entries(shared.monthThemes);
  if (entries.length === 0) {
    lines.push("- ");
  } else {
    for (const [month, theme] of entries) {
      lines.push(`- ${month}: ${theme}`);
    }
  }
  return lines.join("\n");
}
function parseWeeklyShared(content) {
  const routineActions = [];
  const roles = [];
  const monthThemes = {};
  let section = "";
  let currentRole = null;
  const lines = content.split("\n");
  for (const line of lines) {
    if (line.startsWith("## ")) {
      section = line.replace(/^##\s+/, "");
      currentRole = null;
      continue;
    }
    if (section === "\u30EB\u30FC\u30C6\u30A3\u30F3\u884C\u52D5") {
      if (line.startsWith("|")) {
        const cells = line.split("|").map((cell) => cell.trim());
        if (cells.length >= 3 && cells[1] !== "\u884C\u52D5" && cells[1] !== "---") {
          const title = cells[1] || "";
          if (title) {
            const checks = {};
            ROUTINE_DAYS2.forEach((day, idx) => {
              const cell = cells[idx + 2] || "";
              checks[day] = cell.includes("[x]");
            });
            routineActions.push({ title, checks });
          }
        }
      }
      continue;
    }
    if (section === "\u5F79\u5272\u3068\u91CD\u70B9\u30BF\u30B9\u30AF") {
      const roleMatch = line.match(/^###\s+(.+)$/);
      if (roleMatch) {
        currentRole = roleMatch[1].trim();
        if (currentRole) {
          roles.push(currentRole);
        }
        continue;
      }
      continue;
    }
    if (section === "\u6708\u9593\u30C6\u30FC\u30DE") {
      const themeMatch = line.match(/^\-\s*([0-9]{4}\-[0-9]{2})\s*:\s*(.+)$/);
      if (themeMatch) {
        monthThemes[themeMatch[1]] = themeMatch[2].trim();
      }
    }
  }
  return { routineActions, roles, monthThemes };
}

// src/ui/weekly_plan_view.ts
var BASE_DAYS = ["\u6708", "\u706B", "\u6C34", "\u6728", "\u91D1", "\u571F", "\u65E5"];
var ROUTINE_DAYS3 = ["\u6708", "\u706B", "\u6C34", "\u6728", "\u91D1", "\u571F"];
var LEVELS2 = ["\u4EBA\u751F", "\u9577\u671F", "\u4E2D\u671F", "\u5E74\u9593", "\u56DB\u534A\u671F", "\u6708\u9593", "\u9031\u9593"];
var WeeklyPlanView = class extends import_obsidian9.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.statusEl = null;
    this.rootEl = null;
    this.lastSavedContent = "";
    this.weekLabelInput = null;
    this.monthThemeInput = null;
    this.routineRows = [];
    this.roleSections = [];
    this.actionPlanRows = [];
    this.reflectionGoodInputs = [];
    this.reflectionIssueInputs = [];
    this.memoInputs = /* @__PURE__ */ new Map();
    this.dayDateLabels = /* @__PURE__ */ new Map();
    this.dailyMemoCards = /* @__PURE__ */ new Map();
    this.saveTimer = null;
    this.weekOffset = 0;
    this.weekStart = /* @__PURE__ */ new Date();
    this.currentWeekPath = "";
    this.dayOrder = BASE_DAYS;
    this.plugin = plugin;
    this.repository = new MarkdownRepository(this.plugin.app);
    this.tasksService = new TasksService(
      new MarkdownRepository(this.plugin.app),
      this.plugin.settings.storageDir
    );
  }
  getViewType() {
    return WEEKLY_PLAN_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u9031\u9593\u8A08\u753B";
  }
  async onOpen() {
    this.rootEl = this.contentEl;
    await this.renderWeek();
  }
  async onClose() {
    this.statusEl = null;
    this.rootEl = null;
    this.weekLabelInput = null;
    this.monthThemeInput = null;
    this.routineRows = [];
    this.roleSections = [];
    this.actionPlanRows = [];
    this.reflectionGoodInputs = [];
    this.reflectionIssueInputs = [];
    this.memoInputs.clear();
    this.dayDateLabels.clear();
    this.dailyMemoCards.clear();
    if (this.saveTimer) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }
  async renderWeek() {
    if (!this.rootEl) {
      return;
    }
    this.resetViewState();
    this.rootEl.empty();
    const view = this.rootEl.createEl("div", { cls: "lifeplanner-view" });
    const header = view.createEl("div", { cls: "lifeplanner-weekly-header" });
    header.createEl("h2", { text: "\u9031\u9593\u8A08\u753B" });
    const navButtons = header.createEl("div", { cls: "lifeplanner-weekly-nav" });
    const prevButton = navButtons.createEl("button", { text: "\u25C0 \u524D\u9031" });
    const todayButton = navButtons.createEl("button", { text: "\u4ECA\u65E5" });
    const nextButton = navButtons.createEl("button", { text: "\u6B21\u9031 \u25B6" });
    this.statusEl = view.createEl("div", { cls: "lifeplanner-weekly-status" });
    renderNavigation(view, (viewType) => {
      void this.plugin.openViewInLeaf(viewType, this.leaf);
    });
    this.weekStart = computeWeekStart2(/* @__PURE__ */ new Date(), this.weekOffset, this.plugin.settings.weekStart);
    this.dayOrder = dayOrder(this.plugin.settings.weekStart);
    const plan = await this.loadPlanForWeek(this.weekStart);
    this.renderHeaderMeta(view, plan);
    this.renderMonthTheme(view, plan);
    this.renderRoutineActions(view, plan);
    await this.renderRoles(view, plan);
    await this.renderActionPlans(view, plan);
    this.renderReflection(view, plan);
    this.renderDailyMemos(view, plan);
    this.updateWeekMeta();
    prevButton.addEventListener("click", () => {
      void this.changeWeek(-1);
    });
    todayButton.addEventListener("click", () => {
      void this.resetToToday();
    });
    nextButton.addEventListener("click", () => {
      void this.changeWeek(1);
    });
  }
  resetViewState() {
    this.weekLabelInput = null;
    this.monthThemeInput = null;
    this.routineRows = [];
    this.roleSections = [];
    this.actionPlanRows = [];
    this.reflectionGoodInputs = [];
    this.reflectionIssueInputs = [];
    this.memoInputs.clear();
    this.dayDateLabels.clear();
    if (this.saveTimer) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }
  async changeWeek(delta) {
    await this.savePlan();
    this.weekOffset += delta;
    await this.renderWeek();
  }
  async resetToToday() {
    await this.savePlan();
    this.weekOffset = 0;
    await this.renderWeek();
  }
  renderHeaderMeta(container, plan) {
    const section = container.createEl("div", { cls: "lifeplanner-weekly-top" });
    const meta = section.createEl("div", { cls: "lifeplanner-weekly-goals" });
    const header = meta.createEl("div", { cls: "lifeplanner-weekly-section-header" });
    header.createEl("h3", { text: "\u9031\u8868\u793A" });
    const weekLabel = header.createEl("input", { type: "text" });
    weekLabel.placeholder = "2026\u5E74 1\u6708 \u7B2C3\u9031";
    weekLabel.value = plan.weekLabel ?? "";
    weekLabel.readOnly = true;
    this.weekLabelInput = weekLabel;
  }
  renderMonthTheme(container, plan) {
    const section = container.createEl("div", { cls: "lifeplanner-weekly-section" });
    section.createEl("h3", { text: "\u4ECA\u6708\u306E\u30C6\u30FC\u30DE" });
    const input = section.createEl("textarea");
    input.placeholder = "\u4ECA\u6708\u306E\u30C6\u30FC\u30DE";
    input.rows = 2;
    input.value = plan.monthTheme ?? "";
    input.addEventListener("input", () => {
      this.autoResize(input);
      this.scheduleSave();
    });
    this.autoResize(input);
    this.monthThemeInput = input;
  }
  renderRoutineActions(container, plan) {
    const section = container.createEl("div", { cls: "lifeplanner-weekly-section" });
    const header = section.createEl("div", { cls: "lifeplanner-weekly-section-header" });
    header.createEl("h3", { text: "\u30EB\u30FC\u30C6\u30A3\u30F3\u884C\u52D5" });
    const addButton = header.createEl("button", { text: "\u8FFD\u52A0" });
    const table = section.createEl("div", { cls: "lifeplanner-routine-table" });
    const headerRow = table.createEl("div", { cls: "lifeplanner-routine-row is-header" });
    headerRow.createEl("div", { text: "\u884C\u52D5" });
    const routineDays = ROUTINE_DAYS3;
    routineDays.forEach((day) => {
      headerRow.createEl("div", { text: day });
    });
    const addRow = (title, checks) => {
      const row = table.createEl("div", { cls: "lifeplanner-routine-row" });
      const titleInput = row.createEl("input", { type: "text" });
      titleInput.value = title;
      titleInput.placeholder = "\u30EB\u30FC\u30C6\u30A3\u30F3";
      titleInput.addEventListener("input", () => this.scheduleSave());
      const checksMap = /* @__PURE__ */ new Map();
      routineDays.forEach((day) => {
        const cell = row.createEl("div");
        const checkbox = cell.createEl("input", { type: "checkbox" });
        checkbox.checked = Boolean(checks[day]);
        checkbox.addEventListener("change", () => this.scheduleSave());
        checksMap.set(day, checkbox);
      });
      const remove = row.createEl("button", { text: "\xD7" });
      remove.addEventListener("click", (event) => {
        event.preventDefault();
        row.remove();
        this.routineRows = this.routineRows.filter((item) => item.titleInput !== titleInput);
        this.scheduleSave();
      });
      this.routineRows.push({ titleInput, checks: checksMap });
    };
    addButton.addEventListener("click", (event) => {
      event.preventDefault();
      addRow("", {});
      this.scheduleSave();
    });
    if (plan.routineActions.length === 0) {
      addRow("", {});
    } else {
      plan.routineActions.forEach((action) => addRow(action.title, action.checks));
    }
  }
  async renderRoles(container, plan) {
    const section = container.createEl("div", { cls: "lifeplanner-weekly-section" });
    const header = section.createEl("div", { cls: "lifeplanner-weekly-section-header" });
    header.createEl("h3", { text: "\u5F79\u5272\u3068\u91CD\u70B9\u30BF\u30B9\u30AF" });
    const addRoleButton = header.createEl("button", { text: "\u5F79\u5272\u3092\u8FFD\u52A0" });
    const rolesWrap = section.createEl("div", { cls: "lifeplanner-roles" });
    const shared = await this.loadShared();
    const sharedRoles = shared.roles.length > 0 ? shared.roles : plan.roles.map((role) => role.role);
    const addRole = (roleName, goals) => {
      const roleCard = rolesWrap.createEl("div", { cls: "lifeplanner-role-card" });
      const roleHeader = roleCard.createEl("div", { cls: "lifeplanner-role-header" });
      const roleInput = roleHeader.createEl("input", { type: "text" });
      roleInput.placeholder = "\u5F79\u5272\u540D";
      roleInput.value = roleName;
      roleInput.addEventListener("input", () => this.scheduleSave());
      const removeRole = roleHeader.createEl("button", { text: "\xD7" });
      const goalsWrap = roleCard.createEl("div", { cls: "lifeplanner-weekly-list" });
      const actions = roleCard.createEl("div", { cls: "lifeplanner-weekly-list-actions" });
      const addGoalButton = actions.createEl("button", { text: "\u76EE\u6A19\u3092\u8FFD\u52A0" });
      const goalInputs = [];
      const addGoal = (goalValue) => {
        const row = goalsWrap.createEl("div", { cls: "lifeplanner-weekly-list-row" });
        const input = row.createEl("input", { type: "text" });
        input.placeholder = "\u76EE\u6A19";
        input.value = goalValue;
        input.addEventListener("input", () => this.scheduleSave());
        const remove = row.createEl("button", { text: "\xD7" });
        remove.addEventListener("click", (event) => {
          event.preventDefault();
          row.remove();
          const index = goalInputs.indexOf(input);
          if (index >= 0) {
            goalInputs.splice(index, 1);
          }
          this.scheduleSave();
        });
        goalInputs.push(input);
      };
      addGoalButton.addEventListener("click", (event) => {
        event.preventDefault();
        addGoal("");
        this.scheduleSave();
      });
      removeRole.addEventListener("click", (event) => {
        event.preventDefault();
        roleCard.remove();
        this.roleSections = this.roleSections.filter((item) => item.roleInput !== roleInput);
        this.scheduleSave();
      });
      if (goals.length === 0) {
        addGoal("");
      } else {
        goals.forEach((goal) => addGoal(goal));
      }
      this.roleSections.push({ roleInput, goalInputs });
    };
    addRoleButton.addEventListener("click", (event) => {
      event.preventDefault();
      addRole("\u65B0\u3057\u3044\u5F79\u5272", []);
      this.scheduleSave();
    });
    if (sharedRoles.length === 0) {
      addRole("\u5F79\u52721", []);
    } else {
      sharedRoles.forEach((roleName) => {
        const planRole = plan.roles.find((role) => role.role === roleName);
        addRole(roleName, planRole?.goals ?? []);
      });
    }
  }
  async renderActionPlans(container, plan) {
    const section = container.createEl("div", {
      cls: "lifeplanner-weekly-section lifeplanner-action-plan-section"
    });
    const header = section.createEl("div", { cls: "lifeplanner-weekly-section-header" });
    header.createEl("h3", { text: "\u30A2\u30AF\u30B7\u30E7\u30F3\u30D7\u30E9\u30F3" });
    const addButton = header.createEl("button", { text: "\u8FFD\u52A0" });
    section.createEl("div", {
      cls: "lifeplanner-action-plan-hint",
      text: "\u76EE\u6A19/\u30BF\u30B9\u30AF\u304B\u3089\u9078\u3093\u3067\u9031\u9593\u8A08\u753B\u306B\u7D10\u3065\u3051\u307E\u3059\u3002"
    });
    const list = section.createEl("div", { cls: "lifeplanner-weekly-list lifeplanner-action-plan-list" });
    this.actionPlanRows = [];
    const tasks = await this.tasksService.listTasks();
    const goalsService = new GoalsService(
      new MarkdownRepository(this.plugin.app),
      this.plugin.settings.storageDir
    );
    const goals = await goalsService.listGoals();
    const minLevelIndex = LEVELS2.indexOf(this.plugin.settings.actionPlanMinLevel);
    const goalLevelMap = /* @__PURE__ */ new Map();
    const goalTitleMap = /* @__PURE__ */ new Map();
    goals.forEach((goal) => {
      const levelIndex = LEVELS2.indexOf(goal.level);
      if (levelIndex >= minLevelIndex) {
        goalLevelMap.set(goal.id, goal.level);
        goalLevelMap.set(goal.title, goal.level);
      }
      goalTitleMap.set(goal.id, goal.title);
      goalTitleMap.set(goal.title, goal.title);
    });
    const options = tasks.filter((task) => {
      const level = goalLevelMap.get(task.goalId);
      if (!level) {
        return true;
      }
      const levelIndex = LEVELS2.indexOf(level);
      return levelIndex >= minLevelIndex;
    }).map((task) => {
      const level = goalLevelMap.get(task.goalId);
      const goalTitle = goalTitleMap.get(task.goalId) ?? task.goalId;
      const value = `${task.goalId} / ${task.title}`;
      const label = level ? `\u3010${level}\u3011${goalTitle} / ${task.title}` : `${goalTitle} / ${task.title}`;
      return { value, label };
    });
    const addRow = (value, done) => {
      const row = list.createEl("div", { cls: "lifeplanner-action-plan-row" });
      const checkbox = row.createEl("input", {
        type: "checkbox",
        cls: "lifeplanner-action-plan-checkbox"
      });
      checkbox.checked = done;
      checkbox.addEventListener("change", () => this.scheduleSave());
      const select = row.createEl("select", { cls: "lifeplanner-action-plan-select" });
      const placeholder = select.createEl("option", { text: "\u9078\u629E", value: "" });
      placeholder.disabled = true;
      placeholder.selected = !value;
      options.forEach((option) => {
        select.createEl("option", { text: option.label, value: option.value });
      });
      const optionValues = options.map((option) => option.value);
      if (value && !optionValues.includes(value)) {
        const goalId = value.split(" / ")[0];
        const existingLevel = goalLevelMap.get(goalId);
        const goalTitle = goalTitleMap.get(goalId) ?? goalId;
        const label = existingLevel ? `\u3010${existingLevel}\u3011${goalTitle} / ${value.split(" / ")[1] ?? ""}` : value;
        select.createEl("option", { text: label, value });
      }
      select.value = value;
      select.addEventListener("change", () => this.scheduleSave());
      const remove = row.createEl("button", { text: "\xD7", cls: "lifeplanner-action-plan-remove" });
      remove.addEventListener("click", (event) => {
        event.preventDefault();
        row.remove();
        this.actionPlanRows = this.actionPlanRows.filter((item) => item.select !== select);
        this.scheduleSave();
      });
      this.actionPlanRows.push({ select, checkbox });
    };
    const actions = section.createEl("div", { cls: "lifeplanner-weekly-list-actions" });
    actions.appendChild(addButton);
    addButton.addEventListener("click", (event) => {
      event.preventDefault();
      addRow("", false);
      this.scheduleSave();
    });
    if (plan.actionPlans.length === 0) {
      addRow("", false);
    } else {
      plan.actionPlans.forEach((item) => addRow(item.title, item.done));
    }
  }
  renderReflection(container, plan) {
    const section = container.createEl("div", { cls: "lifeplanner-weekly-section" });
    section.createEl("h3", { text: "\u4ECA\u9031\u306E\u632F\u308A\u8FD4\u308A" });
    const grid = section.createEl("div", { cls: "lifeplanner-weekly-reflection" });
    const goodWrap = grid.createEl("div", { cls: "lifeplanner-weekly-reflection-card" });
    goodWrap.createEl("h4", { text: "\u826F\u304B\u3063\u305F\u3053\u3068" });
    const goodList = goodWrap.createEl("div", { cls: "lifeplanner-weekly-list" });
    const goodActions = goodWrap.createEl("div", { cls: "lifeplanner-weekly-list-actions" });
    const addGood = goodActions.createEl("button", { text: "\u8FFD\u52A0" });
    const issueWrap = grid.createEl("div", { cls: "lifeplanner-weekly-reflection-card" });
    issueWrap.createEl("h4", { text: "\u8AB2\u984C" });
    const issueList = issueWrap.createEl("div", { cls: "lifeplanner-weekly-list" });
    const issueActions = issueWrap.createEl("div", { cls: "lifeplanner-weekly-list-actions" });
    const addIssue = issueActions.createEl("button", { text: "\u8FFD\u52A0" });
    addGood.addEventListener("click", (event) => {
      event.preventDefault();
      this.addReflectionItem(goodList, this.reflectionGoodInputs, "\u632F\u308A\u8FD4\u308A");
      this.scheduleSave();
    });
    addIssue.addEventListener("click", (event) => {
      event.preventDefault();
      this.addReflectionItem(issueList, this.reflectionIssueInputs, "\u8AB2\u984C");
      this.scheduleSave();
    });
    if (plan.reflectionGood.length === 0) {
      this.addReflectionItem(goodList, this.reflectionGoodInputs, "\u632F\u308A\u8FD4\u308A");
    } else {
      plan.reflectionGood.forEach(
        (item) => this.addReflectionItem(goodList, this.reflectionGoodInputs, "\u632F\u308A\u8FD4\u308A", item)
      );
    }
    if (plan.reflectionIssues.length === 0) {
      this.addReflectionItem(issueList, this.reflectionIssueInputs, "\u8AB2\u984C");
    } else {
      plan.reflectionIssues.forEach(
        (item) => this.addReflectionItem(issueList, this.reflectionIssueInputs, "\u8AB2\u984C", item)
      );
    }
  }
  addReflectionItem(container, inputs, placeholder, value = "") {
    const row = container.createEl("div", { cls: "lifeplanner-weekly-list-row" });
    const input = row.createEl("input", { type: "text" });
    input.placeholder = placeholder;
    input.value = value;
    input.addEventListener("input", () => this.scheduleSave());
    const remove = row.createEl("button", { text: "\xD7" });
    remove.addEventListener("click", (event) => {
      event.preventDefault();
      row.remove();
      const index = inputs.indexOf(input);
      if (index >= 0) {
        inputs.splice(index, 1);
      }
      this.scheduleSave();
    });
    inputs.push(input);
  }
  renderDailyMemos(container, plan) {
    const section = container.createEl("div", { cls: "lifeplanner-weekly-section" });
    section.createEl("h3", { text: "\u65E5\u4ED8\u3054\u3068\u306E\u4E00\u8A00\u30E1\u30E2\u6B04" });
    const grid = section.createEl("div", { cls: "lifeplanner-daily-memos" });
    for (const day of this.dayOrder) {
      const card = grid.createEl("div", { cls: "lifeplanner-daily-memo-card" });
      this.dailyMemoCards.set(day, card);
      const header = card.createEl("div", { cls: "lifeplanner-daily-memo-header" });
      header.createEl("h4", { text: day });
      const dateLabel = header.createEl("span", { cls: "lifeplanner-daily-memo-date" });
      this.dayDateLabels.set(day, dateLabel);
      const list = card.createEl("div", { cls: "lifeplanner-weekly-list" });
      const actions = card.createEl("div", { cls: "lifeplanner-weekly-list-actions" });
      const addButton = actions.createEl("button", { text: "\u8FFD\u52A0" });
      const inputs = [];
      this.memoInputs.set(day, inputs);
      const addMemo = (value) => {
        const row = list.createEl("div", { cls: "lifeplanner-weekly-list-row" });
        const input = row.createEl("input", { type: "text" });
        input.placeholder = "\u4ECA\u65E5\u306E\u4E00\u8A00";
        input.value = value;
        input.addEventListener("input", () => this.scheduleSave());
        const remove = row.createEl("button", { text: "\xD7" });
        remove.addEventListener("click", (event) => {
          event.preventDefault();
          row.remove();
          const index = inputs.indexOf(input);
          if (index >= 0) {
            inputs.splice(index, 1);
          }
          this.scheduleSave();
        });
        inputs.push(input);
      };
      addButton.addEventListener("click", (event) => {
        event.preventDefault();
        addMemo("");
        this.scheduleSave();
      });
      const memos = plan.dailyMemos[day] ?? [];
      memos.forEach((memo) => addMemo(memo));
      addMemo("");
    }
  }
  async loadPlanForWeek(weekStart) {
    const path = resolveWeeklyPlanPath(weekStart, this.plugin.settings.storageDir);
    this.currentWeekPath = path;
    const content = await this.repository.read(path);
    if (!content) {
      const emptyPlan2 = this.buildEmptyPlan();
      const shared = await this.loadShared();
      emptyPlan2.weekLabel = formatWeekLabel(weekStart, this.plugin.settings.weekStart);
      emptyPlan2.monthTheme = shared.monthThemes[getMonthKey(weekStart)] ?? "";
      emptyPlan2.routineActions = shared.routineActions.map((action) => ({
        title: action.title,
        checks: { ...action.checks }
      }));
      emptyPlan2.roles = shared.roles.map((role) => ({
        role,
        goals: []
      }));
      const serialized = serializeWeeklyPlan(emptyPlan2);
      this.lastSavedContent = serialized;
      await this.repository.write(path, serialized);
      return emptyPlan2;
    }
    this.lastSavedContent = content;
    return parseWeeklyPlan(content);
  }
  async loadShared() {
    const path = resolveLifePlannerPath("Weekly Shared", this.plugin.settings.storageDir);
    const content = await this.repository.read(path);
    if (!content) {
      const emptyShared = {
        routineActions: [],
        roles: [],
        monthThemes: {}
      };
      await this.repository.write(path, serializeWeeklyShared(emptyShared));
      return emptyShared;
    }
    return parseWeeklyShared(content);
  }
  async saveShared(plan) {
    const shared = await this.loadShared();
    shared.routineActions = plan.routineActions.map((action) => ({
      title: action.title,
      checks: { ...action.checks }
    }));
    shared.roles = this.roleSections.map((role) => role.roleInput.value.trim()).filter((value) => value.length > 0);
    shared.monthThemes[getMonthKey(this.weekStart)] = plan.monthTheme ?? "";
    const path = resolveLifePlannerPath("Weekly Shared", this.plugin.settings.storageDir);
    await this.repository.write(path, serializeWeeklyShared(shared));
  }
  buildEmptyPlan() {
    const slots = BASE_DAYS.map((day) => ({ day, entries: [] }));
    return {
      id: "weekly",
      weekStart: "",
      weekEnd: "",
      weeklyGoals: [],
      weekLabel: "",
      monthTheme: "",
      routineActions: [],
      roles: [],
      actionPlans: [],
      reflectionGood: [],
      reflectionIssues: [],
      dailyMemos: { \u6708: [], \u706B: [], \u6C34: [], \u6728: [], \u91D1: [], \u571F: [], \u65E5: [] },
      slots
    };
  }
  async savePlan() {
    const plan = this.buildEmptyPlan();
    plan.weeklyGoals = [];
    plan.weekLabel = this.weekLabelInput ? this.weekLabelInput.value.trim() : "";
    plan.monthTheme = this.monthThemeInput ? this.monthThemeInput.value.trim() : "";
    plan.routineActions = this.routineRows.map((row) => {
      const title = row.titleInput.value.trim();
      const checks = {};
      row.checks.forEach((checkbox, day) => {
        checks[day] = checkbox.checked;
      });
      return { title, checks };
    }).filter((row) => row.title.length > 0);
    plan.roles = this.roleSections.map((role) => ({
      role: role.roleInput.value.trim(),
      goals: role.goalInputs.map((input) => input.value.trim()).filter((value) => value.length > 0)
    })).filter((role) => role.role.length > 0);
    plan.actionPlans = this.actionPlanRows.map((row) => ({
      title: row.select.value.trim(),
      done: row.checkbox.checked
    })).filter((item) => item.title.length > 0);
    plan.reflectionGood = this.reflectionGoodInputs.map((input) => input.value.trim()).filter((value) => value.length > 0);
    plan.reflectionIssues = this.reflectionIssueInputs.map((input) => input.value.trim()).filter((value) => value.length > 0);
    for (const day of BASE_DAYS) {
      const inputs = this.memoInputs.get(day) ?? [];
      plan.dailyMemos[day] = inputs.map((input) => input.value.trim()).filter((value) => value.length > 0);
      const slot = plan.slots.find((entry) => entry.day === day);
      if (slot) {
        const dateLabel = this.dayDateLabels.get(day);
        slot.dateLabel = dateLabel ? dateLabel.textContent ?? "" : "";
      }
    }
    const serialized = serializeWeeklyPlan(plan);
    if (serialized === this.lastSavedContent) {
      this.setStatus("\u5909\u66F4\u306F\u3042\u308A\u307E\u305B\u3093");
      return;
    }
    await this.repository.write(this.currentWeekPath, serialized);
    this.lastSavedContent = serialized;
    await this.saveShared(plan);
    this.setStatus("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
  }
  setStatus(message) {
    if (!this.statusEl) {
      return;
    }
    this.statusEl.setText(message);
    window.setTimeout(() => {
      this.statusEl?.setText("");
    }, 2e3);
  }
  scheduleSave() {
    if (this.saveTimer) {
      window.clearTimeout(this.saveTimer);
    }
    this.saveTimer = window.setTimeout(() => {
      void this.savePlan();
    }, 500);
  }
  updateWeekMeta() {
    this.weekStart = computeWeekStart2(/* @__PURE__ */ new Date(), this.weekOffset, this.plugin.settings.weekStart);
    const weekLabel = formatWeekLabel(this.weekStart, this.plugin.settings.weekStart);
    if (this.weekLabelInput) {
      this.weekLabelInput.value = weekLabel;
    }
    this.dayOrder.forEach((day, index) => {
      const date = new Date(this.weekStart);
      date.setDate(this.weekStart.getDate() + index);
      const label = this.dayDateLabels.get(day);
      if (label) {
        label.setText(formatFullDate(date));
      }
      const card = this.dailyMemoCards.get(day);
      if (card) {
        card.classList.toggle("is-today", isSameDay(date, /* @__PURE__ */ new Date()));
      }
    });
  }
  autoResize(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }
};
function computeWeekStart2(today, offset, weekStart) {
  const base = new Date(today);
  base.setDate(base.getDate() + offset * 7);
  const day = base.getDay();
  const startIndex = weekStart === "sunday" ? 0 : 1;
  const diff = (day - startIndex + 7) % 7;
  const start = new Date(base);
  start.setDate(base.getDate() - diff);
  return start;
}
function formatWeekLabel(weekStart, weekStartSetting) {
  const year = weekStart.getFullYear();
  const month = weekStart.getMonth() + 1;
  const weekNumber = weekOfMonth(weekStart, weekStartSetting);
  return `${year}\u5E74 ${month}\u6708 \u7B2C${weekNumber}\u9031`;
}
function weekOfMonth(date, weekStartSetting) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const firstDay = firstOfMonth.getDay();
  const firstWeekStart = new Date(firstOfMonth);
  const startIndex = weekStartSetting === "sunday" ? 0 : 1;
  const offset = (firstDay - startIndex + 7) % 7;
  firstWeekStart.setDate(firstOfMonth.getDate() - offset);
  const diffMs = date.getTime() - firstWeekStart.getTime();
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1e3)) + 1;
}
function getMonthKey(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}
function formatFullDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}/${month}/${day}`;
}
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function dayOrder(weekStart) {
  return weekStart === "sunday" ? ["\u65E5", "\u6708", "\u706B", "\u6C34", "\u6728", "\u91D1", "\u571F"] : BASE_DAYS;
}

// src/settings.ts
var import_obsidian10 = require("obsidian");
var DEFAULT_SETTINGS = {
  weekStart: "monday",
  storageDir: "LifePlanner",
  kanbanColumns: ["Backlog", "Todo", "Doing", "Done"],
  actionPlanMinLevel: "\u6708\u9593"
};
var LifePlannerSettingTab = class extends import_obsidian10.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian10.Setting(containerEl).setName("Week start").setDesc("Weekly filenames use the start date of the week.").addDropdown((dropdown) => {
      dropdown.addOption("monday", "Monday").addOption("sunday", "Sunday").setValue(this.plugin.settings.weekStart).onChange(async (value) => {
        this.plugin.settings.weekStart = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian10.Setting(containerEl).setName("Storage folder").setDesc("Folder path in your vault for LifePlanner files.").addText((input) => {
      input.setPlaceholder("LifePlanner");
      input.setValue(this.plugin.settings.storageDir);
      input.onChange(async (value) => {
        this.plugin.settings.storageDir = value.trim() || "LifePlanner";
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian10.Setting(containerEl).setName("Kanban columns").setDesc("Comma-separated column names for the Issues board.").addTextArea((input) => {
      input.setValue(this.plugin.settings.kanbanColumns.join(", "));
      input.onChange(async (value) => {
        const columns = value.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
        this.plugin.settings.kanbanColumns = columns.length > 0 ? columns : ["Backlog"];
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian10.Setting(containerEl).setName("Action plan minimum level").setDesc("Show goals at or below this level in Action Plan candidates.").addDropdown((dropdown) => {
      ["\u4EBA\u751F", "\u9577\u671F", "\u4E2D\u671F", "\u5E74\u9593", "\u56DB\u534A\u671F", "\u6708\u9593", "\u9031\u9593"].forEach((level) => {
        dropdown.addOption(level, level);
      });
      dropdown.setValue(this.plugin.settings.actionPlanMinLevel);
      dropdown.onChange(async (value) => {
        this.plugin.settings.actionPlanMinLevel = value;
        await this.plugin.saveSettings();
      });
    });
  }
};

// src/main.ts
var LifePlannerPlugin = class extends import_obsidian11.Plugin {
  constructor() {
    super(...arguments);
    this.primaryLeaf = null;
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    this.registerView(WEEKLY_PLAN_VIEW_TYPE, (leaf) => new WeeklyPlanView(leaf, this));
    this.registerView(INBOX_VIEW_TYPE, (leaf) => new InboxView(leaf, this));
    this.registerView(GOALS_VIEW_TYPE, (leaf) => new GoalsView(leaf, this));
    this.registerView(GOAL_TASK_VIEW_TYPE, (leaf) => new GoalTaskView(leaf, this));
    this.registerView(EXERCISES_VIEW_TYPE, (leaf) => new ExercisesView(leaf, this));
    this.registerView(ISSUES_VIEW_TYPE, (leaf) => new IssuesView(leaf, this));
    this.registerView(
      MISSION_VIEW_TYPE,
      (leaf) => new SimpleSectionView(leaf, this, MISSION_VIEW_TYPE, "Mission", "\u30DF\u30C3\u30B7\u30E7\u30F3")
    );
    this.registerView(
      VALUES_VIEW_TYPE,
      (leaf) => new TableSectionView(leaf, this, VALUES_VIEW_TYPE, "Values", "\u4FA1\u5024\u89B3", [
        { label: "\u4FA1\u5024\u89B3", type: "text", width: "140px" },
        { label: "\u8AAC\u660E\u6587", type: "text", width: "minmax(260px, 1fr)" }
      ])
    );
    this.registerView(
      HAVE_DO_BE_VIEW_TYPE,
      (leaf) => new TableSectionView(leaf, this, HAVE_DO_BE_VIEW_TYPE, "Have Do Be", "Have / Do / Be", [
        { label: "\u7A2E\u5225", type: "select", options: ["Have", "Do", "Be"], width: "120px" },
        { label: "\u4F55\uFF1F", type: "text", width: "minmax(260px, 1fr)" }
      ])
    );
    this.registerView(
      PROMISE_VIEW_TYPE,
      (leaf) => new TableSectionView(leaf, this, PROMISE_VIEW_TYPE, "Promise", "\u7D04\u675F", [
        { label: "\u51E6\u7406", type: "checkbox", width: "56px" },
        { label: "\u8AB0\u3068", type: "text", width: "140px" },
        { label: "\u4F55\u3092\uFF1F", type: "text", width: "minmax(260px, 1fr)" }
      ])
    );
    this.addSettingTab(new LifePlannerSettingTab(this.app, this));
    this.addRibbonIcon("calendar", "LifePlanner", () => {
      void this.openView(WEEKLY_PLAN_VIEW_TYPE);
    });
  }
  onunload() {
    this.app.workspace.detachLeavesOfType(WEEKLY_PLAN_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(INBOX_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(GOALS_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(GOAL_TASK_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(EXERCISES_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(ISSUES_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(MISSION_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(VALUES_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(HAVE_DO_BE_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(PROMISE_VIEW_TYPE);
  }
  async openView(viewType) {
    if (this.primaryLeaf && !this.primaryLeaf.containerEl.isConnected) {
      this.primaryLeaf = null;
    }
    const leaf = this.primaryLeaf ?? this.app.workspace.getLeaf(false);
    this.primaryLeaf = leaf;
    await leaf.setViewState({ type: viewType, active: true });
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
  }
  async openViewInLeaf(viewType, leaf) {
    this.primaryLeaf = leaf;
    await leaf.setViewState({ type: viewType, active: true });
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
//# sourceMappingURL=main.js.map
