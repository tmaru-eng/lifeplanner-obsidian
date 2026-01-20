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
var import_obsidian13 = require("obsidian");

// src/ui/dashboard_view.ts
var import_obsidian3 = require("obsidian");

// src/services/markdown_tags.ts
function normalizeTags(rawTags) {
  if (!rawTags || rawTags.length === 0) {
    return [];
  }
  const seen = /* @__PURE__ */ new Set();
  const normalized = [];
  for (const raw of rawTags) {
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }
    const cleaned = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
    if (!cleaned) {
      continue;
    }
    const key = cleaned.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(cleaned);
  }
  return normalized;
}
function prependTagFrontmatter(lines, rawTags) {
  const tags = normalizeTags(rawTags);
  if (tags.length === 0) {
    return lines;
  }
  const frontmatter = ["---", "tags:"];
  tags.forEach((tag) => {
    frontmatter.push(`  - ${tag}`);
  });
  frontmatter.push("---", "");
  return [...frontmatter, ...lines];
}

// src/storage/path_resolver.ts
var TEMPLATE_PREFIX = "LifePlanner";
function resolveLifePlannerPath(type, baseDir = "LifePlanner") {
  const dir = normalizeBaseDir(baseDir);
  const filename = `${TEMPLATE_PREFIX} - ${type}.md`;
  return dir ? `${dir}/${filename}` : filename;
}
function resolveTemplateSectionPath(templateId, baseDir = "LifePlanner") {
  const dir = normalizeBaseDir(baseDir);
  const safeId = sanitizeSegment(templateId);
  const folder = dir ? `${dir}/Templates` : "Templates";
  return `${folder}/${safeId}.md`;
}
function resolveWeeklyPlanPath(weekStart, baseDir = "LifePlanner", options = {}) {
  const dir = normalizeBaseDir(baseDir);
  const forceMonday = options.forceMonday !== false;
  const normalized = forceMonday ? normalizeWeeklyPlanDate(weekStart) : new Date(weekStart);
  const formatted = formatDate(normalized);
  const filename = `${TEMPLATE_PREFIX} - Weekly - ${formatted}.md`;
  return dir ? `${dir}/${filename}` : filename;
}
function formatDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function normalizeWeeklyPlanDate(date) {
  const normalized = new Date(date);
  const day = normalized.getDay();
  if (day === 0) {
    normalized.setDate(normalized.getDate() + 1);
  } else if (day !== 1) {
    normalized.setDate(normalized.getDate() - (day - 1));
  }
  return normalized;
}
function normalizeBaseDir(value) {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
  return trimmed;
}
function sanitizeSegment(value) {
  const cleaned = value.replace(/[\\/:*?"<>|]/g, "-").trim();
  return cleaned.length > 0 ? cleaned : "template";
}

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
  constructor(repository, baseDir, defaultTags) {
    this.repository = repository;
    this.baseDir = baseDir;
    this.defaultTags = defaultTags;
  }
  async listGoals() {
    const path = resolveLifePlannerPath("Goals", this.baseDir);
    const content = await this.repository.read(path);
    if (!content) {
      await this.repository.write(path, serializeGoals([], this.defaultTags));
      return [];
    }
    const goals = parseGoals(content);
    const idLines = content.match(/^ID:/gm)?.length ?? 0;
    if (goals.length > 0 && idLines < goals.length) {
      await this.repository.write(path, serializeGoals(goals, this.defaultTags));
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
    const content = serializeGoals(goals, this.defaultTags);
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
function serializeGoals(goals, defaultTags = []) {
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
  return prependTagFrontmatter(lines, defaultTags).join("\n");
}

// src/services/inbox_service.ts
var InboxService = class {
  constructor(repository, baseDir, defaultTags) {
    this.repository = repository;
    this.baseDir = baseDir;
    this.defaultTags = defaultTags;
  }
  async listItems() {
    const content = await this.repository.read(resolveLifePlannerPath("Inbox", this.baseDir));
    if (!content) {
      return [];
    }
    const items = parseInboxItems(content);
    const activeItems = items.filter((item) => item.destination === "none");
    if (activeItems.length !== items.length) {
      await this.saveItems(activeItems);
    }
    return activeItems;
  }
  async addItem(content, createdAt = Date.now()) {
    const items = await this.listItems();
    const item = {
      id: `inbox-${Date.now()}`,
      content,
      createdAt,
      destination: "none",
      status: "new"
    };
    items.push(item);
    await this.saveItems(items);
    return item;
  }
  async markTriaged(itemId, destination) {
    const items = await this.listItems();
    const index = items.findIndex((item) => item.id === itemId);
    if (index === -1) {
      return;
    }
    items[index] = {
      ...items[index],
      destination,
      status: destination === "none" ? "new" : "triaged",
      createdAt: items[index].createdAt ?? Date.now()
    };
    await this.saveItems(items);
  }
  async updateItem(itemId, content) {
    const items = await this.listItems();
    const index = items.findIndex((item) => item.id === itemId);
    if (index === -1) {
      return;
    }
    items[index] = {
      ...items[index],
      content,
      createdAt: items[index].createdAt ?? Date.now()
    };
    await this.saveItems(items);
  }
  async deleteItem(itemId) {
    const items = await this.listItems();
    const remaining = items.filter((item) => item.id !== itemId);
    await this.saveItems(remaining);
  }
  async saveItems(items) {
    const content = serializeInboxItems(items, this.defaultTags);
    await this.repository.write(resolveLifePlannerPath("Inbox", this.baseDir), content);
  }
};
function parseInboxItems(content) {
  const items = [];
  const lines = content.split("\n");
  for (const line of lines) {
    const match = line.match(/^- \[.\] (.+)$/);
    if (!match) {
      continue;
    }
    const parsed = extractMetadata(match[1]);
    const destination = parsed.dest || "none";
    const createdAt = parseTimestamp(parsed.ts);
    items.push({
      id: `inbox-${items.length}`,
      content: parsed.content,
      createdAt,
      destination,
      status: destination === "none" ? "new" : "triaged"
    });
  }
  return items;
}
function serializeInboxItems(items, defaultTags = []) {
  const lines = [];
  lines.push("# Inbox");
  lines.push("");
  if (items.length === 0) {
    lines.push("- [ ] ");
  } else {
    for (const item of items) {
      const tokens = [];
      if (typeof item.createdAt === "number") {
        tokens.push(`ts:${item.createdAt}`);
      }
      if (item.destination !== "none") {
        tokens.push(`dest:${item.destination}`);
      }
      const suffix = tokens.length > 0 ? ` ${tokens.map((token) => `[${token}]`).join(" ")}` : "";
      lines.push(`- [ ] ${item.content}${suffix}`);
    }
  }
  lines.push("");
  return prependTagFrontmatter(lines, defaultTags).join("\n");
}
function extractMetadata(raw) {
  let content = raw.trim();
  const meta = {};
  const metaPattern = /\s\[(ts|dest):([^\]]+)\]\s*$/;
  while (true) {
    const match = content.match(metaPattern);
    if (!match) {
      break;
    }
    meta[match[1]] = match[2];
    content = content.slice(0, match.index).trim();
  }
  return { content, ts: meta.ts, dest: meta.dest };
}
function parseTimestamp(raw) {
  if (!raw) {
    return void 0;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : void 0;
}

// src/services/issues_service.ts
var IssuesService = class {
  constructor(repository, baseDir, defaultTags) {
    this.repository = repository;
    this.baseDir = baseDir;
    this.defaultTags = defaultTags;
  }
  async listIssues() {
    const path = resolveLifePlannerPath("Issues", this.baseDir);
    const content = await this.repository.read(path);
    if (!content) {
      await this.repository.write(path, serializeIssues([], this.defaultTags));
      return [];
    }
    return parseIssues(content);
  }
  async saveIssues(issues) {
    const content = serializeIssues(issues, this.defaultTags);
    await this.repository.write(resolveLifePlannerPath("Issues", this.baseDir), content);
  }
};
function serializeIssues(issues, defaultTags = []) {
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
  return prependTagFrontmatter(lines, defaultTags).join("\n");
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

// src/services/tasks_service.ts
var TasksService = class {
  constructor(repository, baseDir, defaultTags) {
    this.repository = repository;
    this.baseDir = baseDir;
    this.defaultTags = defaultTags;
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
    const content = serializeTasks(tasks, this.defaultTags);
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
function serializeTasks(tasks, defaultTags = []) {
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
  return prependTagFrontmatter(lines, defaultTags).join("\n");
}

// src/services/weekly_plan_io.ts
var DAYS = ["\u6708", "\u706B", "\u6C34", "\u6728", "\u91D1", "\u571F", "\u65E5"];
var ROUTINE_DAYS = ["\u6708", "\u706B", "\u6C34", "\u6728", "\u91D1", "\u571F"];
function serializeWeeklyPlan(plan, defaultTags = []) {
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
  return prependTagFrontmatter(lines, defaultTags).join("\n");
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
  constructor(repository, baseDir, weekStart, defaultTags) {
    this.repository = repository;
    this.baseDir = baseDir;
    this.weekStart = weekStart;
    this.defaultTags = defaultTags;
    this.goalsService = new GoalsService(repository, baseDir, defaultTags);
    this.tasksService = new TasksService(repository, baseDir, defaultTags);
    this.issuesService = new IssuesService(repository, baseDir, defaultTags);
  }
  async toGoal(item, level) {
    await this.goalsService.addGoal(level, item.content);
  }
  async toTask(item, goalTitle) {
    await this.tasksService.addTask(goalTitle, item.content);
  }
  async toWeekly(item) {
    const weekStart = computeWeekStart(/* @__PURE__ */ new Date(), 0, this.weekStart);
    const path = resolveWeeklyPlanPath(weekStart, this.baseDir);
    const content = await this.repository.read(path);
    const plan = content ? parseWeeklyPlan(content) : emptyPlan();
    plan.actionPlans.push({ title: item.content, done: false });
    await this.repository.write(path, serializeWeeklyPlan(plan, this.defaultTags));
  }
  async toIssue(item) {
    const issues = await this.issuesService.listIssues();
    issues.push({
      id: `issue-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
      title: item.content,
      status: "Backlog",
      body: ""
    });
    await this.issuesService.saveIssues(issues);
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

// src/ui/interaction.ts
function enableTapToBlur(container) {
  container.addEventListener("click", (event) => {
    const target = event.target;
    if (!target) {
      return;
    }
    if (target.closest("input, textarea, select, button, a, .lifeplanner-no-blur")) {
      return;
    }
    const active = document.activeElement;
    if (active && container.contains(active)) {
      active.blur();
    }
  });
}
function registerRowMenuClose(scope) {
  const handler = (event) => {
    const target = event.target;
    if (target && target.closest(".lifeplanner-row-menu")) {
      return;
    }
    scope.querySelectorAll(".lifeplanner-row-menu-list.is-open").forEach((menu) => {
      menu.classList.remove("is-open");
    });
  };
  document.addEventListener("mousedown", handler, true);
  return () => {
    document.removeEventListener("mousedown", handler, true);
  };
}
function attachDeleteMenu(container, scope, onDelete) {
  attachRowMenu(container, scope, [{ label: "\u524A\u9664", onSelect: onDelete }]);
}
function attachRowMenu(container, scope, items) {
  const menu = container.createEl("div", { cls: "lifeplanner-row-menu" });
  const menuButton = menu.createEl("button", {
    text: "\u22EF",
    cls: "lifeplanner-row-menu-button"
  });
  menuButton.setAttr("type", "button");
  menuButton.setAttr("aria-label", "\u30E1\u30CB\u30E5\u30FC");
  const menuList = menu.createEl("div", { cls: "lifeplanner-row-menu-list" });
  items.forEach((item) => {
    const button = menuList.createEl("button", { text: item.label });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      menuList.classList.remove("is-open");
      item.onSelect();
    });
  });
  menuButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    scope.querySelectorAll(".lifeplanner-row-menu-list.is-open").forEach((openMenu) => {
      if (openMenu !== menuList) {
        openMenu.classList.remove("is-open");
      }
    });
    menuList.classList.toggle("is-open");
  });
}

// src/ui/view_types.ts
var DASHBOARD_VIEW_TYPE = "lifeplanner-dashboard";
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
var TEMPLATE_SECTION_VIEW_TYPE = "lifeplanner-template";

// src/services/section_templates.ts
var BUILTIN_TEMPLATES = [
  {
    id: "promise",
    label: "\u7D04\u675F",
    viewType: PROMISE_VIEW_TYPE,
    formatLabel: "\u8868(\u30C1\u30A7\u30C3\u30AF)"
  },
  {
    id: "mission",
    label: "\u30DF\u30C3\u30B7\u30E7\u30F3",
    viewType: MISSION_VIEW_TYPE,
    formatLabel: "\u30D5\u30EA\u30FC\u8A18\u5165"
  },
  {
    id: "values",
    label: "\u4FA1\u5024\u89B3",
    viewType: VALUES_VIEW_TYPE,
    formatLabel: "\u9805\u76EE/\u5185\u5BB9"
  },
  {
    id: "have-do-be",
    label: "Have/Do/Be",
    viewType: HAVE_DO_BE_VIEW_TYPE,
    formatLabel: "\u9078\u629E/\u5185\u5BB9"
  },
  {
    id: "exercises",
    label: "\u6F14\u7FD2",
    viewType: EXERCISES_VIEW_TYPE,
    formatLabel: "\u6F14\u7FD2\u96C6"
  }
];
var DEFAULT_TEMPLATE_IDS = BUILTIN_TEMPLATES.map((template) => template.id);
var BUILTIN_TEMPLATE_BY_ID = new Map(
  BUILTIN_TEMPLATES.map((template) => [template.id, template])
);
var BUILTIN_TEMPLATE_BY_VIEW = new Map(
  BUILTIN_TEMPLATES.map((template) => [template.viewType, template.id])
);
var TEMPLATE_FORMAT_LABELS = {
  free: "\u30D5\u30EA\u30FC\u8A18\u5165",
  pairs: "\u9805\u76EE/\u5185\u5BB9",
  select: "\u9078\u629E/\u5185\u5BB9",
  list: "\u30EA\u30B9\u30C8",
  qa: "\u8CEA\u554F/\u89E3\u7B54"
};
function getAllTemplates(customTemplates = []) {
  return [...BUILTIN_TEMPLATES, ...customTemplates];
}
function isBuiltinTemplateId(id) {
  return BUILTIN_TEMPLATE_BY_ID.has(id);
}

// src/ui/navigation.ts
var NAV_GROUPS = [
  {
    id: "operations",
    label: "\u65E5\u5E38",
    items: [
      { label: "\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9", viewType: DASHBOARD_VIEW_TYPE },
      { label: "\u9031\u9593\u8A08\u753B", viewType: WEEKLY_PLAN_VIEW_TYPE },
      { label: "Inbox", viewType: INBOX_VIEW_TYPE },
      { label: "\u30A2\u30AF\u30B7\u30E7\u30F3\u30D7\u30E9\u30F3", viewType: GOAL_TASK_VIEW_TYPE },
      { label: "\u30A4\u30B7\u30E5\u30FC", viewType: ISSUES_VIEW_TYPE },
      { label: "\u76EE\u6A19", viewType: GOALS_VIEW_TYPE },
      { label: "\u7D04\u675F", viewType: PROMISE_VIEW_TYPE }
    ]
  },
  {
    id: "foundation",
    label: "\u5185\u7701",
    items: [
      { label: "\u30DF\u30C3\u30B7\u30E7\u30F3", viewType: MISSION_VIEW_TYPE },
      { label: "\u4FA1\u5024\u89B3", viewType: VALUES_VIEW_TYPE },
      { label: "Have/Do/Be", viewType: HAVE_DO_BE_VIEW_TYPE },
      { label: "\u6F14\u7FD2", viewType: EXERCISES_VIEW_TYPE }
    ]
  }
];
var NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);
var NAV_ITEM_LABELS = new Map(
  NAV_ITEMS.map((item) => [item.viewType, item.label])
);
function getNavItemLabel(viewType) {
  return NAV_ITEM_LABELS.get(viewType) ?? viewType;
}
var LEGACY_DEFAULT_CHILD_LABEL = "\u30E1\u30A4\u30F3";
var getTemplateIdForView = (viewType) => BUILTIN_TEMPLATE_BY_VIEW.get(viewType) ?? null;
var getTemplateDefaultLabel = (templateId) => BUILTIN_TEMPLATE_BY_ID.get(templateId)?.label ?? templateId;
function navTargetKey(target) {
  switch (target.type) {
    case "view":
      return `view::${target.viewType}`;
    case "template":
      return `template::${target.templateId}`;
    case "exercise":
      return `exercise::${target.section}`;
    default:
      return "view::unknown";
  }
}
function navTargetFromKey(key) {
  const separatorIndex = key.indexOf("::");
  if (separatorIndex <= 0) {
    return null;
  }
  const type = key.slice(0, separatorIndex);
  const value = key.slice(separatorIndex + 2);
  if (!value) {
    return null;
  }
  if (type === "view") {
    return { type: "view", viewType: value };
  }
  if (type === "template") {
    return { type: "template", templateId: value };
  }
  if (type === "exercise") {
    return { type: "exercise", section: value };
  }
  return null;
}
function navChildHasItems(child) {
  return Array.isArray(child.items);
}
function getNavTargetViewType(target) {
  if (target.type === "view") {
    return target.viewType;
  }
  if (target.type === "exercise") {
    return EXERCISES_VIEW_TYPE;
  }
  if (target.type === "template") {
    return BUILTIN_TEMPLATE_BY_ID.get(target.templateId)?.viewType ?? null;
  }
  return null;
}
function getNavTargetLabel(target, templateLabels) {
  switch (target.type) {
    case "view":
      return getNavItemLabel(target.viewType);
    case "template":
      return templateLabels?.get(target.templateId) ?? target.templateId;
    case "exercise":
      return target.section;
    default:
      return "";
  }
}
function buildDefaultNavLayout() {
  return NAV_GROUPS.map((group) => ({
    label: group.label,
    children: group.items.map((item) => ({
      label: item.label,
      target: (() => {
        const templateId = getTemplateIdForView(item.viewType);
        return templateId ? { type: "template", templateId } : { type: "view", viewType: item.viewType };
      })()
    }))
  }));
}
function normalizeNavLayout(layout, options = {}) {
  const allowedViews = new Set(NAV_ITEMS.map((item) => item.viewType));
  const defaultLayout = buildDefaultNavLayout();
  if (!Array.isArray(layout) || layout.length === 0) {
    return defaultLayout;
  }
  const seenTargets = /* @__PURE__ */ new Set();
  const normalized = [];
  const normalizeTarget = (value) => {
    if (typeof value === "string") {
      if (allowedViews.has(value)) {
        const viewType = value;
        const templateId = getTemplateIdForView(viewType);
        return templateId ? { type: "template", templateId } : { type: "view", viewType };
      }
      return null;
    }
    if (!value || typeof value !== "object") {
      return null;
    }
    const candidate = value;
    if (candidate.type === "view" || typeof candidate.viewType === "string") {
      const viewType = (candidate.viewType ?? "").trim();
      if (allowedViews.has(viewType)) {
        const templateId = getTemplateIdForView(viewType);
        return templateId ? { type: "template", templateId } : { type: "view", viewType };
      }
      return null;
    }
    if (candidate.type === "template" || typeof candidate.templateId === "string") {
      const templateId = (candidate.templateId ?? "").trim();
      if (templateId) {
        return { type: "template", templateId };
      }
      return null;
    }
    if (candidate.type === "exercise" || typeof candidate.section === "string") {
      const section = (candidate.section ?? "").trim();
      if (section) {
        return { type: "exercise", section };
      }
      return null;
    }
    return null;
  };
  const registerTarget = (target) => {
    const key = navTargetKey(target);
    if (seenTargets.has(key)) {
      return false;
    }
    seenTargets.add(key);
    return true;
  };
  layout.forEach((group) => {
    const label = (group?.label ?? "").trim();
    if (!label) {
      return;
    }
    const children = Array.isArray(group.children) ? group.children : [];
    const normalizedChildren = [];
    children.forEach((child) => {
      if (!child) {
        return;
      }
      const childLabel = String(child.label ?? "").trim();
      const rawItems = child.items;
      if (Array.isArray(rawItems)) {
        const itemTargets = [];
        rawItems.forEach((item) => {
          const target2 = normalizeTarget(item);
          if (!target2) {
            return;
          }
          if (registerTarget(target2)) {
            itemTargets.push(target2);
          }
        });
        const isLegacyMain = !childLabel || childLabel === LEGACY_DEFAULT_CHILD_LABEL;
        if (isLegacyMain) {
          itemTargets.forEach((target2) => {
            normalizedChildren.push({
              label: target2.type === "template" ? getTemplateDefaultLabel(target2.templateId) : getNavTargetLabel(target2),
              target: target2
            });
          });
          return;
        }
        const labelValue = childLabel || "2\u968E\u5C64\u76EE";
        if (itemTargets.length > 0 || options.keepEmpty) {
          normalizedChildren.push({ label: labelValue, items: itemTargets });
        }
        return;
      }
      const target = normalizeTarget(child.target ?? child);
      if (target && registerTarget(target)) {
        const labelValue = childLabel || (target.type === "template" ? getTemplateDefaultLabel(target.templateId) : getNavTargetLabel(target));
        normalizedChildren.push({ label: labelValue, target });
        return;
      }
      if (options.keepEmpty && childLabel) {
        normalizedChildren.push({ label: childLabel, items: [] });
      }
    });
    if (normalizedChildren.length > 0 || options.keepEmpty) {
      normalized.push({ label, children: normalizedChildren });
    }
  });
  if (normalized.length === 0) {
    return defaultLayout;
  }
  return normalized;
}
var lastVisitedByGroup = {};
var lastVisitedByChild = {};
function renderNavigation(container, activeViewType, onNavigate, hiddenViewTypes = [], navLayout, extras = {}) {
  const hiddenSet = new Set(hiddenViewTypes);
  const hasEnabledTemplates = Array.isArray(extras.enabledTemplates);
  const enabledTemplateSet = new Set(extras.enabledTemplates ?? []);
  const nav = container.createEl("div", { cls: "lifeplanner-nav" });
  const layout = normalizeNavLayout(navLayout);
  const templateLabels = extras.templateLabels;
  const viewKey = navTargetKey({ type: "view", viewType: activeViewType });
  const detailKey = extras.activeExerciseSection ? navTargetKey({ type: "exercise", section: extras.activeExerciseSection }) : null;
  const templateKey = extras.activeTemplateId ? navTargetKey({ type: "template", templateId: extras.activeTemplateId }) : null;
  const activeKeys = [detailKey, templateKey, viewKey].filter(
    (key) => Boolean(key)
  );
  const isTargetVisible = (target) => {
    const viewType = getNavTargetViewType(target);
    if (viewType && hiddenSet.has(viewType) && viewType !== activeViewType) {
      return false;
    }
    if (target.type === "template" && hasEnabledTemplates && !enabledTemplateSet.has(target.templateId) && target.templateId !== extras.activeTemplateId) {
      return false;
    }
    return true;
  };
  const childTargets = (child) => navChildHasItems(child) ? child.items : [child.target];
  const groupTargets = (group) => group.children.flatMap((child) => childTargets(child));
  const hasTargetKey = (targets, key) => targets.some((target) => navTargetKey(target) === key);
  const groupHasKey = (group, key) => group.children.some((child) => hasTargetKey(childTargets(child), key));
  const findTargetByKey = (targets, key) => {
    if (!key) {
      return null;
    }
    return targets.find((target) => navTargetKey(target) === key) ?? null;
  };
  const visibleGroups = layout.map((group) => {
    const children = group.children.flatMap((child) => {
      if (navChildHasItems(child)) {
        const items = child.items.filter((target) => isTargetVisible(target));
        if (items.length === 0) {
          return [];
        }
        return [{ ...child, items }];
      }
      if (!isTargetVisible(child.target)) {
        return [];
      }
      return [child];
    });
    return { ...group, children };
  }).filter((group) => group.children.length > 0);
  const activeGroup = visibleGroups.find((group) => activeKeys.some((key) => groupHasKey(group, key))) ?? visibleGroups[0];
  if (!activeGroup) {
    return;
  }
  const activeKey = activeKeys.find((key) => groupHasKey(activeGroup, key)) ?? viewKey;
  const activeChild = activeGroup.children.find((child) => hasTargetKey(childTargets(child), activeKey)) ?? activeGroup.children[0];
  if (!activeChild) {
    return;
  }
  lastVisitedByGroup[activeGroup.label] = activeKey;
  lastVisitedByChild[`${activeGroup.label}::${activeChild.label}`] = activeKey;
  const groupRow = nav.createEl("div", { cls: "lifeplanner-nav-groups" });
  visibleGroups.forEach((group) => {
    const button = groupRow.createEl("button", {
      text: group.label,
      cls: "lifeplanner-nav-group"
    });
    button.setAttr("type", "button");
    if (group === activeGroup) {
      button.classList.add("is-active");
      button.setAttr("aria-current", "page");
    }
    button.addEventListener("click", () => {
      const last = lastVisitedByGroup[group.label];
      const targets = groupTargets(group);
      const fallbackTarget = { type: "view", viewType: activeViewType };
      const target = findTargetByKey(targets, last) ?? targets[0] ?? fallbackTarget;
      onNavigate(target);
    });
  });
  const childRow = nav.createEl("div", { cls: "lifeplanner-nav-children" });
  activeGroup.children.forEach((child) => {
    const button = childRow.createEl("button", {
      text: child.label,
      cls: "lifeplanner-nav-child"
    });
    button.setAttr("type", "button");
    if (child === activeChild) {
      button.classList.add("is-active");
      button.setAttr("aria-current", "page");
    }
    button.addEventListener("click", () => {
      if (navChildHasItems(child)) {
        const key = `${activeGroup.label}::${child.label}`;
        const last = lastVisitedByChild[key];
        const fallbackTarget = { type: "view", viewType: activeViewType };
        const target = findTargetByKey(child.items, last) ?? child.items[0] ?? fallbackTarget;
        onNavigate(target);
        return;
      }
      onNavigate(child.target);
    });
  });
  const shouldHideTabs = navChildHasItems(activeChild) && activeViewType === EXERCISES_VIEW_TYPE && activeChild.items.length > 0 && activeChild.items.every((target) => target.type === "exercise");
  if (navChildHasItems(activeChild) && !shouldHideTabs) {
    nav.classList.add("has-tabs");
    const activeTabKey = hasTargetKey(activeChild.items, activeKey) ? activeKey : hasTargetKey(activeChild.items, viewKey) ? viewKey : null;
    const tabRow = nav.createEl("div", { cls: "lifeplanner-nav-tabs" });
    activeChild.items.forEach((target) => {
      const label = getNavTargetLabel(target, templateLabels);
      const button = tabRow.createEl("button", {
        text: label,
        cls: "lifeplanner-nav-tab"
      });
      button.setAttr("type", "button");
      const key = navTargetKey(target);
      if (activeTabKey && key === activeTabKey) {
        button.classList.add("is-active");
        button.setAttr("aria-current", "page");
      }
      button.addEventListener("click", () => onNavigate(target));
    });
  }
}

// src/ui/weekly_plan_view.ts
var import_obsidian2 = require("obsidian");

// src/services/weekly_shared_io.ts
var ROUTINE_DAYS2 = ["\u6708", "\u706B", "\u6C34", "\u6728", "\u91D1", "\u571F"];
function serializeWeeklyShared(shared, defaultTags = []) {
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
      const checks = ROUTINE_DAYS2.map(() => "[ ]");
      lines.push(`| ${action} | ${checks.join(" | ")} |`);
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
  return prependTagFrontmatter(lines, defaultTags).join("\n");
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
          const title = (cells[1] || "").trim();
          if (title) {
            routineActions.push(title);
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
var ROUTINE_DAYS3 = BASE_DAYS;
var LEVELS = ["\u4EBA\u751F", "\u9577\u671F", "\u4E2D\u671F", "\u5E74\u9593", "\u56DB\u534A\u671F", "\u6708\u9593", "\u9031\u9593"];
var DAY_MS = 24 * 60 * 60 * 1e3;
var WeeklyPlanRenderer = class {
  constructor(plugin) {
    this.statusEl = null;
    this.statusTimer = null;
    this.rootEl = null;
    this.viewEl = null;
    this.disposeMenuClose = null;
    this.lastSavedContent = "";
    this.loadedPlan = null;
    this.renderOptions = {};
    this.weekLabelInput = null;
    this.monthThemeInput = null;
    this.routineRows = [];
    this.roleSections = [];
    this.actionPlanRows = [];
    this.reflectionGoodInputs = [];
    this.reflectionIssueInputs = [];
    this.dayDateLabels = /* @__PURE__ */ new Map();
    this.dailyMemoCards = /* @__PURE__ */ new Map();
    this.tweetSaveTimers = /* @__PURE__ */ new Map();
    this.saveTimer = null;
    this.weekOffset = 0;
    this.weekStart = /* @__PURE__ */ new Date();
    this.currentWeekPath = "";
    this.dayOrder = BASE_DAYS;
    this.plugin = plugin;
    this.repository = new MarkdownRepository(this.plugin.app);
    this.tasksService = new TasksService(
      new MarkdownRepository(this.plugin.app),
      this.plugin.settings.storageDir,
      this.plugin.settings.defaultTags
    );
    this.inboxService = new InboxService(
      this.repository,
      this.plugin.settings.storageDir,
      this.plugin.settings.defaultTags
    );
  }
  async render(container, options = {}) {
    this.rootEl = container;
    await this.renderWeek(options);
  }
  async onClose() {
    this.statusEl = null;
    if (this.statusTimer) {
      window.clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
    this.rootEl = null;
    this.viewEl = null;
    this.disposeMenuClose?.();
    this.disposeMenuClose = null;
    this.weekLabelInput = null;
    this.monthThemeInput = null;
    this.routineRows = [];
    this.roleSections = [];
    this.actionPlanRows = [];
    this.reflectionGoodInputs = [];
    this.reflectionIssueInputs = [];
    this.dayDateLabels.clear();
    this.dailyMemoCards.clear();
    this.clearTweetSaveTimers();
    if (this.saveTimer) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }
  async renderWeek(options = {}) {
    if (!this.rootEl) {
      return;
    }
    const resolvedOptions = {
      showNavigation: options.showNavigation ?? true,
      showHeader: options.showHeader ?? true,
      attachMenuClose: options.attachMenuClose ?? true,
      onNavigate: options.onNavigate,
      hiddenViewTypes: options.hiddenViewTypes ?? []
    };
    this.renderOptions = resolvedOptions;
    this.resetViewState();
    this.rootEl.empty();
    const view = this.rootEl.createEl("div", { cls: "lifeplanner-view" });
    this.viewEl = view;
    enableTapToBlur(view);
    if (resolvedOptions.attachMenuClose) {
      this.disposeMenuClose = registerRowMenuClose(view);
    }
    let prevButton = null;
    let todayButton = null;
    let nextButton = null;
    if (resolvedOptions.showHeader) {
      const header = view.createEl("div", { cls: "lifeplanner-weekly-header" });
      header.createEl("h2", { text: "\u9031\u9593\u8A08\u753B" });
      const navButtons = header.createEl("div", { cls: "lifeplanner-weekly-nav" });
      prevButton = navButtons.createEl("button", { text: "\u25C0 \u524D\u9031" });
      todayButton = navButtons.createEl("button", { text: "\u4ECA\u65E5" });
      nextButton = navButtons.createEl("button", { text: "\u6B21\u9031 \u25B6" });
    }
    if (resolvedOptions.showNavigation) {
      const onNavigate = resolvedOptions.onNavigate ?? ((target) => {
        void this.plugin.navigateToTarget(target);
      });
      renderNavigation(
        view,
        WEEKLY_PLAN_VIEW_TYPE,
        onNavigate,
        resolvedOptions.hiddenViewTypes,
        this.plugin.settings.navLayout,
        {
          templateLabels: this.plugin.getTemplateLabelMap(),
          enabledTemplates: this.plugin.settings.enabledTemplates
        }
      );
    }
    this.statusEl = view.createEl("div", { cls: "lifeplanner-status lifeplanner-weekly-status" });
    this.weekStart = computeWeekStart2(/* @__PURE__ */ new Date(), this.weekOffset, this.plugin.settings.weekStart);
    this.dayOrder = dayOrder(this.plugin.settings.weekStart);
    const plan = await this.loadPlanForWeek(this.weekStart);
    this.renderHeaderMeta(view, plan);
    this.renderMonthTheme(view, plan);
    this.renderRoutineActions(view, plan);
    await this.renderRoles(view, plan);
    await this.renderActionPlans(view, plan);
    await this.renderDailyMemos(view);
    this.renderReflection(view, plan);
    this.updateWeekMeta();
    if (this.statusEl) {
      view.appendChild(this.statusEl);
    }
    if (prevButton) {
      prevButton.addEventListener("click", () => {
        void this.changeWeek(-1);
      });
    }
    if (todayButton) {
      todayButton.addEventListener("click", () => {
        void this.resetToToday();
      });
    }
    if (nextButton) {
      nextButton.addEventListener("click", () => {
        void this.changeWeek(1);
      });
    }
  }
  resetViewState() {
    this.weekLabelInput = null;
    this.monthThemeInput = null;
    this.routineRows = [];
    this.roleSections = [];
    this.actionPlanRows = [];
    this.reflectionGoodInputs = [];
    this.reflectionIssueInputs = [];
    this.dayDateLabels.clear();
    this.viewEl = null;
    this.disposeMenuClose?.();
    this.disposeMenuClose = null;
    this.clearTweetSaveTimers();
    if (this.saveTimer) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }
  async changeWeek(delta) {
    await this.savePlan();
    this.weekOffset += delta;
    await this.renderWeek(this.renderOptions);
  }
  async resetToToday() {
    await this.savePlan();
    this.weekOffset = 0;
    await this.renderWeek(this.renderOptions);
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
    const section = container.createEl("div", {
      cls: "lifeplanner-weekly-section lifeplanner-month-theme"
    });
    const header = section.createEl("div", { cls: "lifeplanner-weekly-section-header" });
    header.createEl("h3", { text: "\u4ECA\u6708\u306E\u30C6\u30FC\u30DE" });
    const menuScope = this.viewEl ?? section;
    const body = section.createEl("div", { cls: "lifeplanner-month-theme-body" });
    const display = body.createEl("div", { cls: "lifeplanner-month-theme-display" });
    const input = body.createEl("textarea", { cls: "lifeplanner-month-theme-input" });
    input.placeholder = "\u4ECA\u6708\u306E\u30C6\u30FC\u30DE";
    input.rows = 2;
    input.value = plan.monthTheme ?? "";
    const updateDisplay = () => {
      const value = input.value.trim();
      display.setText(value || "(\u672A\u8A18\u5165)");
      display.classList.toggle("is-empty", value.length === 0);
    };
    const setEditMode = (editing) => {
      input.classList.toggle("lifeplanner-hidden", !editing);
      display.classList.toggle("lifeplanner-hidden", editing);
      if (editing) {
        this.autoResize(input);
        input.focus();
      }
    };
    attachRowMenu(header, menuScope, [
      {
        label: "\u7DE8\u96C6",
        onSelect: () => {
          setEditMode(true);
        }
      },
      {
        label: "\u524A\u9664",
        onSelect: () => {
          input.value = "";
          updateDisplay();
          setEditMode(false);
          this.autoResize(input);
          this.scheduleSave();
        }
      }
    ]);
    input.addEventListener("input", () => {
      updateDisplay();
      this.autoResize(input);
      this.scheduleSave();
    });
    input.addEventListener("blur", () => {
      updateDisplay();
      setEditMode(false);
    });
    updateDisplay();
    setEditMode(false);
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
        const cell = row.createEl("div", { cls: "lifeplanner-routine-day" });
        cell.setAttr("data-day", day);
        const checkbox = cell.createEl("input", { type: "checkbox" });
        checkbox.checked = Boolean(checks[day]);
        checkbox.addEventListener("change", () => this.scheduleSave());
        checksMap.set(day, checkbox);
      });
      const menuScope = this.viewEl ?? row;
      attachDeleteMenu(row, menuScope, () => {
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
        const menuScope2 = this.viewEl ?? row;
        attachDeleteMenu(row, menuScope2, () => {
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
      const menuScope = this.viewEl ?? roleCard;
      attachDeleteMenu(roleHeader, menuScope, () => {
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
    const list = section.createEl("div", {
      cls: "lifeplanner-weekly-list lifeplanner-action-plan-list"
    });
    const hiddenWrap = section.createEl("div", { cls: "lifeplanner-action-plan-hidden" });
    const hiddenHeader = hiddenWrap.createEl("div", {
      cls: "lifeplanner-action-plan-hidden-header"
    });
    const hiddenToggle = hiddenHeader.createEl("button", { text: "\u975E\u8868\u793A\u30EA\u30B9\u30C8" });
    const hiddenList = hiddenWrap.createEl("div", {
      cls: "lifeplanner-weekly-list lifeplanner-action-plan-list is-hidden"
    });
    this.actionPlanRows = [];
    const tasks = await this.tasksService.listTasks();
    const goalsService = new GoalsService(
      new MarkdownRepository(this.plugin.app),
      this.plugin.settings.storageDir,
      this.plugin.settings.defaultTags
    );
    const goals = await goalsService.listGoals();
    const minLevelIndex = LEVELS.indexOf(this.plugin.settings.actionPlanMinLevel);
    const goalLevelMap = /* @__PURE__ */ new Map();
    const goalTitleMap = /* @__PURE__ */ new Map();
    goals.forEach((goal) => {
      const levelIndex = LEVELS.indexOf(goal.level);
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
      const levelIndex = LEVELS.indexOf(level);
      return levelIndex >= minLevelIndex;
    }).map((task) => {
      const value = `${task.goalId} / ${task.title}`;
      const label = task.title;
      return { value, label };
    });
    let hiddenOpen = false;
    const setHiddenOpen = (open) => {
      hiddenOpen = open;
      hiddenList.classList.toggle("is-hidden", !hiddenOpen);
    };
    const updateHiddenCount = () => {
      const count = hiddenList.querySelectorAll(".lifeplanner-action-plan-row").length;
      hiddenToggle.setText(`\u975E\u8868\u793A\u30EA\u30B9\u30C8 (${count})`);
      hiddenWrap.classList.toggle("is-empty", count === 0);
      if (count === 0) {
        setHiddenOpen(false);
      }
    };
    const moveRow = (row, done) => {
      const target = done ? hiddenList : list;
      if (row.parentElement !== target) {
        target.appendChild(row);
      }
      updateHiddenCount();
    };
    hiddenToggle.addEventListener("click", (event) => {
      event.preventDefault();
      setHiddenOpen(!hiddenOpen);
    });
    const addRow = (value, done) => {
      const row = list.createEl("div", { cls: "lifeplanner-action-plan-row" });
      const checkbox = row.createEl("input", {
        type: "checkbox",
        cls: "lifeplanner-action-plan-checkbox"
      });
      checkbox.checked = done;
      checkbox.addEventListener("change", () => {
        moveRow(row, checkbox.checked);
        this.scheduleSave();
      });
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
        const label = value.split(" / ")[1] ?? goalTitleMap.get(goalId) ?? value;
        select.createEl("option", { text: label, value });
      }
      select.value = value;
      select.addEventListener("change", () => this.scheduleSave());
      const menuScope = this.viewEl ?? row;
      attachDeleteMenu(row, menuScope, () => {
        row.remove();
        this.actionPlanRows = this.actionPlanRows.filter((item) => item.select !== select);
        updateHiddenCount();
        this.scheduleSave();
      });
      this.actionPlanRows.push({ select, checkbox });
      moveRow(row, done);
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
    updateHiddenCount();
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
    const menuScope = this.viewEl ?? row;
    attachDeleteMenu(row, menuScope, () => {
      row.remove();
      const index = inputs.indexOf(input);
      if (index >= 0) {
        inputs.splice(index, 1);
      }
      this.scheduleSave();
    });
    inputs.push(input);
  }
  async renderDailyMemos(container) {
    const section = container.createEl("div", { cls: "lifeplanner-weekly-section" });
    section.createEl("h3", { text: "\u65E5\u4ED8\u3054\u3068\u306E\u30E1\u30E2" });
    const grid = section.createEl("div", { cls: "lifeplanner-daily-memos" });
    const items = await this.inboxService.listItems();
    const weekStart = new Date(this.weekStart);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const itemsByDay = /* @__PURE__ */ new Map();
    this.dayOrder.forEach((day) => itemsByDay.set(day, []));
    items.forEach((item) => {
      if (typeof item.createdAt !== "number") {
        return;
      }
      const created = new Date(item.createdAt);
      if (created < weekStart || created >= weekEnd) {
        return;
      }
      const diff = Math.floor((startOfDay(created).getTime() - weekStart.getTime()) / DAY_MS);
      const day = this.dayOrder[diff];
      if (!day) {
        return;
      }
      itemsByDay.get(day)?.push(item);
    });
    const buildMemoRow = (list, item) => {
      const row = list.createEl("div", { cls: "lifeplanner-tweet-row" });
      row.setAttribute("data-created-at", `${item.createdAt ?? 0}`);
      row.createEl("span", {
        cls: "lifeplanner-tweet-time",
        text: formatTime(item.createdAt)
      });
      const input = row.createEl("input", { type: "text", cls: "lifeplanner-tweet-input" });
      input.value = item.content;
      let lastSaved = item.content;
      input.addEventListener("input", () => {
        const nextValue = input.value.trim();
        if (!nextValue || nextValue === lastSaved) {
          return;
        }
        lastSaved = nextValue;
        this.scheduleTweetSave(item.id, nextValue);
      });
      input.addEventListener("blur", () => {
        if (input.value.trim().length === 0) {
          input.value = lastSaved;
          this.setStatus("\u30E1\u30E2\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
        }
      });
      const menuScope = this.viewEl ?? row;
      attachDeleteMenu(row, menuScope, () => {
        void this.inboxService.deleteItem(item.id).then(() => {
          row.remove();
          if (list.querySelectorAll(".lifeplanner-tweet-row").length === 0) {
            list.createEl("div", { cls: "lifeplanner-tweet-empty", text: "(\u672A\u767B\u9332)" });
          }
          this.setStatus("\u524A\u9664\u3057\u307E\u3057\u305F");
        });
      });
      return row;
    };
    const insertMemoRow = (list, row, createdAt) => {
      const value = createdAt ?? 0;
      const rows = Array.from(list.querySelectorAll(".lifeplanner-tweet-row"));
      const before = rows.find((existing) => {
        const existingValue = Number(existing.getAttribute("data-created-at") ?? 0);
        return existingValue > value;
      });
      if (before) {
        list.insertBefore(row, before);
      } else {
        list.appendChild(row);
      }
    };
    const clearEmptyState = (list) => {
      list.querySelectorAll(".lifeplanner-tweet-empty").forEach((empty) => {
        empty.remove();
      });
    };
    const addMemo = async (list, baseDate, input) => {
      const content = input.value.trim();
      if (!content) {
        this.setStatus("\u30E1\u30E2\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
        input.focus();
        return;
      }
      const now = /* @__PURE__ */ new Date();
      const created = new Date(baseDate);
      created.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      const item = await this.inboxService.addItem(content, created.getTime());
      input.value = "";
      clearEmptyState(list);
      const row = buildMemoRow(list, item);
      insertMemoRow(list, row, item.createdAt);
      this.setStatus("\u30E1\u30E2\u3092\u8FFD\u52A0\u3057\u307E\u3057\u305F");
    };
    this.dayOrder.forEach((day, index) => {
      const card = grid.createEl("div", { cls: "lifeplanner-daily-memo-card" });
      this.dailyMemoCards.set(day, card);
      const header = card.createEl("div", { cls: "lifeplanner-daily-memo-header" });
      header.createEl("h4", { text: day });
      const dateLabel = header.createEl("span", { cls: "lifeplanner-daily-memo-date" });
      this.dayDateLabels.set(day, dateLabel);
      const addRow = card.createEl("div", { cls: "lifeplanner-daily-memo-add" });
      const addInput = addRow.createEl("input", {
        type: "text",
        cls: "lifeplanner-daily-memo-input"
      });
      addInput.placeholder = "\u30E1\u30E2\u3092\u8FFD\u52A0";
      const addButton = addRow.createEl("button", { text: "\u8FFD\u52A0" });
      addButton.setAttr("type", "button");
      const list = card.createEl("div", { cls: "lifeplanner-weekly-list" });
      const dayItems = itemsByDay.get(day) ?? [];
      if (dayItems.length === 0) {
        list.createEl("div", { cls: "lifeplanner-tweet-empty", text: "(\u672A\u767B\u9332)" });
      }
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + index);
      const handleAdd = () => {
        void addMemo(list, dayDate, addInput);
      };
      addButton.addEventListener("click", (event) => {
        event.preventDefault();
        handleAdd();
      });
      addInput.addEventListener("keydown", (event) => {
        if (event.isComposing || event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        handleAdd();
      });
      dayItems.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)).forEach((item) => {
        const row = buildMemoRow(list, item);
        insertMemoRow(list, row, item.createdAt);
      });
    });
  }
  async loadPlanForWeek(weekStart) {
    const path = resolveWeeklyPlanPath(weekStart, this.plugin.settings.storageDir);
    this.currentWeekPath = path;
    let content = await this.repository.read(path);
    if (!content) {
      const legacyPath = resolveWeeklyPlanPath(weekStart, this.plugin.settings.storageDir, {
        forceMonday: false
      });
      if (legacyPath !== path) {
        const legacyContent = await this.repository.read(legacyPath);
        if (legacyContent) {
          await this.repository.write(path, legacyContent);
          content = legacyContent;
        }
      }
    }
    if (!content) {
      const emptyPlan2 = this.buildEmptyPlan();
      const shared = await this.loadShared();
      emptyPlan2.weekLabel = formatWeekLabel(weekStart, this.plugin.settings.weekStart);
      emptyPlan2.monthTheme = shared.monthThemes[getMonthKey(weekStart)] ?? "";
      emptyPlan2.routineActions = shared.routineActions.map((title) => ({
        title,
        checks: {}
      }));
      emptyPlan2.roles = shared.roles.map((role) => ({
        role,
        goals: []
      }));
      const serialized = serializeWeeklyPlan(emptyPlan2, this.plugin.settings.defaultTags);
      this.lastSavedContent = serialized;
      await this.repository.write(path, serialized);
      this.loadedPlan = emptyPlan2;
      return emptyPlan2;
    }
    this.lastSavedContent = content;
    const plan = parseWeeklyPlan(content);
    this.loadedPlan = plan;
    return plan;
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
      await this.repository.write(
        path,
        serializeWeeklyShared(emptyShared, this.plugin.settings.defaultTags)
      );
      return emptyShared;
    }
    return parseWeeklyShared(content);
  }
  async saveShared(plan) {
    const shared = await this.loadShared();
    shared.routineActions = plan.routineActions.map((action) => action.title.trim()).filter((title) => title.length > 0);
    shared.roles = this.roleSections.map((role) => role.roleInput.value.trim()).filter((value) => value.length > 0);
    shared.monthThemes[getMonthKey(this.weekStart)] = plan.monthTheme ?? "";
    const path = resolveLifePlannerPath("Weekly Shared", this.plugin.settings.storageDir);
    await this.repository.write(
      path,
      serializeWeeklyShared(shared, this.plugin.settings.defaultTags)
    );
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
    const plan = this.loadedPlan ? { ...this.loadedPlan } : this.buildEmptyPlan();
    if (!plan.slots || plan.slots.length === 0) {
      plan.slots = BASE_DAYS.map((day) => ({ day, entries: [] }));
    }
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
      const slot = plan.slots.find((entry) => entry.day === day);
      if (slot) {
        const dateLabel = this.dayDateLabels.get(day);
        slot.dateLabel = dateLabel ? dateLabel.textContent ?? "" : "";
      }
    }
    const serialized = serializeWeeklyPlan(plan, this.plugin.settings.defaultTags);
    if (serialized === this.lastSavedContent) {
      this.setStatus("\u5909\u66F4\u306F\u3042\u308A\u307E\u305B\u3093");
      return;
    }
    await this.repository.write(this.currentWeekPath, serialized);
    this.lastSavedContent = serialized;
    this.loadedPlan = plan;
    await this.saveShared(plan);
    this.setStatus("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
  }
  setStatus(message) {
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
  scheduleTweetSave(itemId, content) {
    const existing = this.tweetSaveTimers.get(itemId);
    if (existing) {
      window.clearTimeout(existing);
    }
    const timer = window.setTimeout(() => {
      void this.inboxService.updateItem(itemId, content).then(() => {
        this.setStatus("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
      });
      this.tweetSaveTimers.delete(itemId);
    }, 400);
    this.tweetSaveTimers.set(itemId, timer);
  }
  scheduleSave() {
    if (this.saveTimer) {
      window.clearTimeout(this.saveTimer);
    }
    this.saveTimer = window.setTimeout(() => {
      void this.savePlan();
    }, 500);
  }
  clearTweetSaveTimers() {
    this.tweetSaveTimers.forEach((timer) => {
      window.clearTimeout(timer);
    });
    this.tweetSaveTimers.clear();
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
var WeeklyPlanView = class extends import_obsidian2.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.renderer = new WeeklyPlanRenderer(plugin);
  }
  getViewType() {
    return WEEKLY_PLAN_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u9031\u9593\u8A08\u753B";
  }
  async onOpen() {
    await this.renderer.render(this.contentEl, {
      showNavigation: true,
      showHeader: true,
      attachMenuClose: true,
      onNavigate: (target) => {
        void this.plugin.navigateToTarget(target, this.leaf);
      },
      hiddenViewTypes: this.plugin.settings.hiddenTabs
    });
  }
  async renderEmbedded(container, options = {}) {
    await this.renderer.render(container, {
      showNavigation: options.showNavigation ?? false,
      showHeader: options.showHeader ?? true,
      attachMenuClose: options.attachMenuClose ?? false,
      onNavigate: options.onNavigate,
      hiddenViewTypes: options.hiddenViewTypes
    });
  }
  async onClose() {
    await this.renderer.onClose();
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
function formatTime(timestamp) {
  if (!timestamp) {
    return "--:--";
  }
  const date = new Date(timestamp);
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}
function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function dayOrder(weekStart) {
  return weekStart === "sunday" ? ["\u65E5", "\u6708", "\u706B", "\u6C34", "\u6728", "\u91D1", "\u571F"] : BASE_DAYS;
}

// src/ui/dashboard_view.ts
var DASHBOARD_SECTIONS = NAV_GROUPS.flatMap(
  (group) => group.items.map((item) => ({
    label: item.label,
    viewType: item.viewType,
    groupLabel: group.label
  }))
).filter((item) => item.viewType !== DASHBOARD_VIEW_TYPE);
var DashboardView = class extends import_obsidian3.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.embeddedWeekly = null;
    this.disposeMenuClose = null;
    this.statusEl = null;
    this.statusTimer = null;
    this.showControls = false;
    this.plugin = plugin;
  }
  getViewType() {
    return DASHBOARD_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9";
  }
  async onOpen() {
    await this.renderDashboard();
  }
  async onClose() {
    await this.cleanupEmbeddedWeekly();
    this.disposeMenuClose?.();
    this.disposeMenuClose = null;
    this.statusEl = null;
    if (this.statusTimer) {
      window.clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
    this.showControls = false;
    this.contentEl.empty();
  }
  async cleanupEmbeddedWeekly() {
    if (!this.embeddedWeekly) {
      return;
    }
    await this.embeddedWeekly.onClose();
    this.embeddedWeekly = null;
  }
  buildServices() {
    const repository = new MarkdownRepository(this.plugin.app);
    return {
      repository,
      inboxService: new InboxService(
        repository,
        this.plugin.settings.storageDir,
        this.plugin.settings.defaultTags
      ),
      inboxTriage: new InboxTriage(
        repository,
        this.plugin.settings.storageDir,
        this.plugin.settings.weekStart,
        this.plugin.settings.defaultTags
      ),
      goalsService: new GoalsService(
        repository,
        this.plugin.settings.storageDir,
        this.plugin.settings.defaultTags
      ),
      tasksService: new TasksService(
        repository,
        this.plugin.settings.storageDir,
        this.plugin.settings.defaultTags
      ),
      issuesService: new IssuesService(
        repository,
        this.plugin.settings.storageDir,
        this.plugin.settings.defaultTags
      )
    };
  }
  async renderDashboard() {
    const container = this.contentEl;
    await this.cleanupEmbeddedWeekly();
    this.disposeMenuClose?.();
    container.empty();
    const view = container.createEl("div", { cls: "lifeplanner-view" });
    enableTapToBlur(view);
    this.disposeMenuClose = registerRowMenuClose(view);
    const header = view.createEl("div", { cls: "lifeplanner-dashboard-header" });
    header.createEl("h2", { text: "\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9" });
    const headerActions = header.createEl("div", { cls: "lifeplanner-dashboard-header-actions" });
    const editToggle = headerActions.createEl("button", {
      cls: "lifeplanner-dashboard-edit-toggle",
      text: this.showControls ? "\u7DE8\u96C6\u3092\u9589\u3058\u308B" : "\u7DE8\u96C6"
    });
    editToggle.setAttr("type", "button");
    renderNavigation(
      view,
      DASHBOARD_VIEW_TYPE,
      (target) => {
        void this.plugin.navigateToTarget(target, this.leaf);
      },
      this.plugin.settings.hiddenTabs,
      this.plugin.settings.navLayout,
      {
        templateLabels: this.plugin.getTemplateLabelMap(),
        enabledTemplates: this.plugin.settings.enabledTemplates
      }
    );
    this.statusEl = view.createEl("div", {
      cls: "lifeplanner-status lifeplanner-dashboard-status"
    });
    const selected = new Set(this.plugin.settings.dashboardSections);
    const controls = view.createEl("div", { cls: "lifeplanner-dashboard-controls" });
    const grid = view.createEl("div", { cls: "lifeplanner-dashboard-grid" });
    const setControlsVisible = (visible) => {
      this.showControls = visible;
      controls.classList.toggle("lifeplanner-hidden", !visible);
      grid.classList.toggle("lifeplanner-hidden", visible);
      editToggle.setText(visible ? "\u7DE8\u96C6\u3092\u9589\u3058\u308B" : "\u7DE8\u96C6");
    };
    setControlsVisible(this.showControls);
    editToggle.addEventListener("click", () => {
      setControlsVisible(!this.showControls);
    });
    controls.createEl("h3", { text: "\u8868\u793A\u30BB\u30AF\u30B7\u30E7\u30F3" });
    const groupsWrap = controls.createEl("div", { cls: "lifeplanner-dashboard-groups" });
    const updateSettings = async (viewType, enabled) => {
      const updated = new Set(this.plugin.settings.dashboardSections);
      if (enabled) {
        updated.add(viewType);
      } else {
        updated.delete(viewType);
      }
      this.plugin.settings.dashboardSections = Array.from(updated);
      await this.plugin.saveSettings();
      void this.renderDashboard();
    };
    NAV_GROUPS.forEach((group) => {
      const items = group.items.filter((item) => item.viewType !== DASHBOARD_VIEW_TYPE);
      if (items.length === 0) {
        return;
      }
      const groupBlock = groupsWrap.createEl("div", { cls: "lifeplanner-dashboard-group" });
      groupBlock.createEl("h4", { text: group.label });
      const toggles = groupBlock.createEl("div", { cls: "lifeplanner-dashboard-toggles" });
      items.forEach((item) => {
        const label = toggles.createEl("label", { cls: "lifeplanner-dashboard-toggle" });
        const checkbox = label.createEl("input", { type: "checkbox" });
        checkbox.checked = selected.has(item.viewType);
        label.createEl("span", { text: item.label });
        checkbox.addEventListener("change", () => {
          void updateSettings(item.viewType, checkbox.checked);
        });
      });
    });
    const services = this.buildServices();
    if (this.plugin.settings.showDashboardCalendar) {
      const body = this.createSection(grid, "\u6708\u9593\u30AB\u30EC\u30F3\u30C0\u30FC");
      this.renderMonthlyCalendar(body, /* @__PURE__ */ new Date());
    }
    const sectionMap = new Map(
      DASHBOARD_SECTIONS.map((item) => [item.viewType, item])
    );
    const orderedSections = this.plugin.settings.dashboardSections.map((viewType) => sectionMap.get(viewType)).filter((item) => Boolean(item));
    if (orderedSections.length === 0 && !this.plugin.settings.showDashboardCalendar) {
      const empty = grid.createEl("div", { cls: "lifeplanner-dashboard-empty" });
      empty.setText("\u8868\u793A\u3059\u308B\u30BB\u30AF\u30B7\u30E7\u30F3\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
      if (this.statusEl) {
        view.appendChild(this.statusEl);
      }
      return;
    }
    for (const section of orderedSections) {
      const includeHeader = section.viewType !== WEEKLY_PLAN_VIEW_TYPE;
      const body = this.createSection(grid, section.label, includeHeader);
      await this.renderSection(section.viewType, body, services);
    }
    if (this.statusEl) {
      view.appendChild(this.statusEl);
    }
  }
  createSection(container, title, includeHeader = true) {
    const section = container.createEl("section", { cls: "lifeplanner-dashboard-section" });
    if (includeHeader) {
      const header = section.createEl("div", { cls: "lifeplanner-dashboard-section-header" });
      header.createEl("h3", { text: title });
    }
    return section.createEl("div", { cls: "lifeplanner-dashboard-section-body" });
  }
  async renderSection(viewType, container, services) {
    switch (viewType) {
      case INBOX_VIEW_TYPE:
        await this.renderInboxSection(container, services);
        return;
      case WEEKLY_PLAN_VIEW_TYPE:
        await this.renderWeeklySection(container);
        return;
      case GOAL_TASK_VIEW_TYPE:
        await this.renderActionPlanSection(container, services);
        return;
      case ISSUES_VIEW_TYPE:
        await this.renderIssuesSection(container, services);
        return;
      default:
        container.createEl("div", {
          text: "\u3053\u306E\u30BB\u30AF\u30B7\u30E7\u30F3\u306F\u30BF\u30D6\u3067\u7BA1\u7406\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
          cls: "lifeplanner-dashboard-placeholder"
        });
    }
  }
  async renderInboxSection(container, services) {
    const form = container.createEl("div", { cls: "lifeplanner-inbox-form lifeplanner-form" });
    const input = form.createEl("input", { type: "text" });
    input.placeholder = "\u30E1\u30E2\u3092\u5165\u529B";
    const addButton = form.createEl("button", { text: "\u8FFD\u52A0" });
    const listEl = container.createEl("div", { cls: "lifeplanner-inbox-list" });
    const handleAdd = async (content) => {
      if (!content) {
        this.setStatus("\u30E1\u30E2\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
        return;
      }
      await services.inboxService.addItem(content);
      this.setStatus("\u30E1\u30E2\u3092\u8FFD\u52A0\u3057\u307E\u3057\u305F");
      await renderItems();
    };
    const handleGoalTriage = async (item, level) => {
      await services.inboxTriage.toGoal(item, level);
      await services.inboxService.deleteItem(item.id);
      this.setStatus("\u76EE\u6A19\u3078\u8FFD\u52A0\u3057\u307E\u3057\u305F");
      await renderItems();
    };
    const handleTaskTriage = async (item, goalTitle) => {
      await services.inboxTriage.toTask(item, goalTitle);
      await services.inboxService.deleteItem(item.id);
      this.setStatus("\u30BF\u30B9\u30AF\u3078\u8FFD\u52A0\u3057\u307E\u3057\u305F");
      await renderItems();
    };
    const handleWeeklyTriage = async (item) => {
      await services.inboxTriage.toWeekly(item);
      await services.inboxService.deleteItem(item.id);
      this.setStatus("\u9031\u9593\u8A08\u753B\u3078\u8FFD\u52A0\u3057\u307E\u3057\u305F");
      await renderItems();
    };
    const handleIssueTriage = async (item) => {
      await services.inboxTriage.toIssue(item);
      await services.inboxService.deleteItem(item.id);
      this.setStatus("\u30A4\u30B7\u30E5\u30FC\u3078\u8FFD\u52A0\u3057\u307E\u3057\u305F");
      await renderItems();
    };
    const handleDelete = async (itemId) => {
      await services.inboxService.deleteItem(itemId);
      this.setStatus("\u524A\u9664\u3057\u307E\u3057\u305F");
      await renderItems();
    };
    const renderItems = async () => {
      listEl.empty();
      const items = await services.inboxService.listItems();
      if (items.length === 0) {
        listEl.createEl("div", { text: "(\u672A\u767B\u9332)" });
        return;
      }
      const sortedItems = [...items].sort(
        (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
      );
      const goals = await services.goalsService.listGoals();
      const goalTitles = goals.map((goal) => goal.title);
      const goalLevels = ["\u4EBA\u751F", "\u9577\u671F", "\u4E2D\u671F", "\u5E74\u9593", "\u56DB\u534A\u671F", "\u6708\u9593", "\u9031\u9593"];
      for (const item of sortedItems) {
        const row = listEl.createEl("div", { cls: "lifeplanner-inbox-row" });
        const meta = row.createEl("div", { cls: "lifeplanner-inbox-meta" });
        meta.createEl("span", {
          cls: "lifeplanner-inbox-timestamp",
          text: this.formatTimestamp(item.createdAt)
        });
        const destLabel = this.formatDestination(item.destination);
        if (destLabel) {
          meta.createEl("span", { cls: "lifeplanner-inbox-destination", text: destLabel });
        }
        const inputRow = row.createEl("div", { cls: "lifeplanner-inbox-input-row" });
        const rowInput = inputRow.createEl("input", {
          type: "text",
          cls: "lifeplanner-inbox-input"
        });
        rowInput.placeholder = "\u30E1\u30E2";
        rowInput.value = item.content;
        let lastSaved = item.content;
        rowInput.addEventListener("input", () => {
          const nextValue = rowInput.value.trim();
          if (!nextValue || nextValue === lastSaved) {
            return;
          }
          lastSaved = nextValue;
          void services.inboxService.updateItem(item.id, nextValue).then(() => {
            this.setStatus("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
          });
        });
        rowInput.addEventListener("blur", () => {
          if (rowInput.value.trim().length === 0) {
            rowInput.value = lastSaved;
            this.setStatus("\u30E1\u30E2\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
          }
        });
        const menuHost = inputRow.createEl("div", { cls: "lifeplanner-inbox-menu" });
        const resolveContent = () => {
          const content = rowInput.value.trim();
          if (!content) {
            rowInput.value = lastSaved;
            this.setStatus("\u30E1\u30E2\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
            rowInput.focus();
            return null;
          }
          if (content !== item.content) {
            return { ...item, content };
          }
          return item;
        };
        const panels = row.createEl("div", { cls: "lifeplanner-inbox-panels" });
        const goalPanel = panels.createEl("div", {
          cls: "lifeplanner-inbox-panel lifeplanner-hidden"
        });
        goalPanel.createEl("span", { cls: "lifeplanner-inbox-panel-label", text: "\u30B9\u30D1\u30F3" });
        const goalSelect = goalPanel.createEl("select");
        goalLevels.forEach((level) => {
          goalSelect.createEl("option", { text: level, value: level });
        });
        goalSelect.value = "\u9031\u9593";
        const goalConfirm = goalPanel.createEl("button", { text: "\u8FFD\u52A0" });
        const taskPanel = panels.createEl("div", {
          cls: "lifeplanner-inbox-panel lifeplanner-hidden"
        });
        taskPanel.createEl("span", { cls: "lifeplanner-inbox-panel-label", text: "\u76EE\u6A19" });
        const taskSelect = taskPanel.createEl("select");
        if (goalTitles.length > 0) {
          const placeholder = taskSelect.createEl("option", { text: "\u76EE\u6A19\u3092\u9078\u629E", value: "" });
          placeholder.disabled = true;
          placeholder.selected = true;
          goalTitles.forEach((title) => {
            taskSelect.createEl("option", { text: title, value: title });
          });
        } else {
          taskSelect.createEl("option", { text: "\u9031\u9593", value: "\u9031\u9593" });
          taskSelect.value = "\u9031\u9593";
        }
        const taskConfirm = taskPanel.createEl("button", { text: "\u8FFD\u52A0" });
        const togglePanel = (panel) => {
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
          void handleGoalTriage(current, goalSelect.value);
          goalPanel.classList.add("lifeplanner-hidden");
        });
        taskConfirm.addEventListener("click", () => {
          const current = resolveContent();
          if (!current) {
            return;
          }
          if (!taskSelect.value) {
            this.setStatus("\u76EE\u6A19\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044");
            return;
          }
          void handleTaskTriage(current, taskSelect.value);
          taskPanel.classList.add("lifeplanner-hidden");
        });
        attachRowMenu(menuHost, this.contentEl, [
          {
            label: "\u76EE\u6A19\u3078",
            onSelect: () => togglePanel(goalPanel)
          },
          {
            label: "\u30BF\u30B9\u30AF\u3078",
            onSelect: () => togglePanel(taskPanel)
          },
          {
            label: "\u9031\u9593\u3078",
            onSelect: () => {
              const current = resolveContent();
              if (!current) {
                return;
              }
              void handleWeeklyTriage(current);
              goalPanel.classList.add("lifeplanner-hidden");
              taskPanel.classList.add("lifeplanner-hidden");
            }
          },
          {
            label: "\u30A4\u30B7\u30E5\u30FC\u3078",
            onSelect: () => {
              const current = resolveContent();
              if (!current) {
                return;
              }
              void handleIssueTriage(current);
              goalPanel.classList.add("lifeplanner-hidden");
              taskPanel.classList.add("lifeplanner-hidden");
            }
          },
          {
            label: "\u524A\u9664",
            onSelect: () => {
              void handleDelete(item.id);
            }
          }
        ]);
      }
    };
    addButton.addEventListener("click", () => {
      void handleAdd(input.value.trim());
      input.value = "";
    });
    await renderItems();
  }
  async renderWeeklySection(container) {
    if (!this.embeddedWeekly) {
      this.embeddedWeekly = new WeeklyPlanRenderer(this.plugin);
    }
    await this.embeddedWeekly.render(container, {
      showNavigation: false,
      showHeader: true,
      attachMenuClose: false
    });
  }
  async renderActionPlanSection(container, services) {
    const tasks = await services.tasksService.listTasks();
    const list = container.createEl("div", {
      cls: "lifeplanner-weekly-list lifeplanner-action-plan-list"
    });
    const hiddenWrap = container.createEl("div", { cls: "lifeplanner-action-plan-hidden" });
    const hiddenHeader = hiddenWrap.createEl("div", {
      cls: "lifeplanner-action-plan-hidden-header"
    });
    const hiddenToggle = hiddenHeader.createEl("button", { text: "\u975E\u8868\u793A\u30EA\u30B9\u30C8" });
    const hiddenList = hiddenWrap.createEl("div", {
      cls: "lifeplanner-weekly-list lifeplanner-action-plan-list is-hidden"
    });
    let hiddenOpen = false;
    const setHiddenOpen = (open) => {
      hiddenOpen = open;
      hiddenList.classList.toggle("is-hidden", !hiddenOpen);
    };
    const updateHiddenCount = () => {
      const count = hiddenList.querySelectorAll(".lifeplanner-weekly-list-row").length;
      hiddenToggle.setText(`\u975E\u8868\u793A\u30EA\u30B9\u30C8 (${count})`);
      hiddenWrap.classList.toggle("is-empty", count === 0);
      if (count === 0) {
        setHiddenOpen(false);
      }
    };
    const moveRow = (row, done) => {
      const target = done ? hiddenList : list;
      if (row.parentElement !== target) {
        target.appendChild(row);
      }
      updateHiddenCount();
    };
    hiddenToggle.addEventListener("click", (event) => {
      event.preventDefault();
      setHiddenOpen(!hiddenOpen);
    });
    if (tasks.length === 0) {
      list.createEl("div", { text: "(\u672A\u767B\u9332)" });
      updateHiddenCount();
      return;
    }
    tasks.forEach((task) => {
      const row = list.createEl("div", { cls: "lifeplanner-weekly-list-row" });
      const label = row.createEl("span", {
        text: `${task.goalId ? `[${task.goalId}] ` : ""}${task.title}`
      });
      label.classList.add("lifeplanner-action-plan-label");
      const checkbox = row.createEl("input", { type: "checkbox" });
      checkbox.checked = task.status === "done";
      if (checkbox.checked) {
        moveRow(row, true);
      }
      checkbox.addEventListener("change", () => {
        task.status = checkbox.checked ? "done" : "todo";
        moveRow(row, checkbox.checked);
        void services.tasksService.saveTasks(tasks).then(() => {
          this.setStatus("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
        });
      });
    });
    updateHiddenCount();
  }
  async renderIssuesSection(container, services) {
    const board = container.createEl("div", { cls: "lifeplanner-kanban" });
    const columns = this.plugin.settings.kanbanColumns.length ? this.plugin.settings.kanbanColumns : ["Backlog"];
    const issues = await services.issuesService.listIssues();
    const grouped = {};
    columns.forEach((column) => {
      grouped[column] = [];
    });
    issues.forEach((issue) => {
      const status = grouped[issue.status] ? issue.status : columns[0];
      if (!grouped[status]) {
        grouped[status] = [];
      }
      grouped[status].push(issue.title || "(\u7121\u984C)");
    });
    columns.forEach((column) => {
      const columnEl = board.createEl("div", { cls: "lifeplanner-kanban-column" });
      const header = columnEl.createEl("div", { cls: "lifeplanner-kanban-header" });
      const count = grouped[column]?.length ?? 0;
      header.createEl("h3", { text: `${column} (${count})` });
      const list = columnEl.createEl("div", { cls: "lifeplanner-kanban-list" });
      const titles = grouped[column] ?? [];
      if (titles.length === 0) {
        list.createEl("div", { text: "(\u7A7A)", cls: "lifeplanner-kanban-empty" });
        return;
      }
      titles.slice(0, 5).forEach((title) => {
        const card = list.createEl("div", { cls: "lifeplanner-kanban-card" });
        card.createEl("div", { text: title });
      });
      if (titles.length > 5) {
        list.createEl("div", {
          text: `\u4ED6 ${titles.length - 5} \u4EF6`,
          cls: "lifeplanner-kanban-empty"
        });
      }
    });
  }
  renderMonthlyCalendar(container, date) {
    const weekStart = this.computeWeekStart(date);
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startIndex = this.plugin.settings.weekStart === "sunday" ? firstDay.getDay() : (firstDay.getDay() + 6) % 7;
    const dayLabels = this.plugin.settings.weekStart === "sunday" ? ["\u65E5", "\u6708", "\u706B", "\u6C34", "\u6728", "\u91D1", "\u571F"] : ["\u6708", "\u706B", "\u6C34", "\u6728", "\u91D1", "\u571F", "\u65E5"];
    const weekStartDate = new Date(year, month, weekStart.getDate());
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);
    const today = /* @__PURE__ */ new Date();
    const calendar = container.createEl("div", { cls: "lifeplanner-monthly-calendar" });
    calendar.createEl("div", {
      cls: "lifeplanner-monthly-title",
      text: `${year}\u5E74${month + 1}\u6708`
    });
    const grid = calendar.createEl("div", { cls: "lifeplanner-monthly-grid" });
    dayLabels.forEach((label) => {
      grid.createEl("div", {
        cls: "lifeplanner-monthly-cell is-header",
        text: label
      });
    });
    for (let i = 0; i < startIndex; i += 1) {
      grid.createEl("div", { cls: "lifeplanner-monthly-cell is-empty" });
    }
    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const current = new Date(year, month, day);
      const cell = grid.createEl("div", {
        cls: "lifeplanner-monthly-cell",
        text: `${day}`
      });
      if (current >= weekStartDate && current <= weekEndDate) {
        cell.classList.add("is-in-week");
      }
      if (this.isSameDay(current, today)) {
        cell.classList.add("is-today");
      }
    }
  }
  computeWeekStart(today) {
    const base = new Date(today);
    const day = base.getDay();
    const startIndex = this.plugin.settings.weekStart === "sunday" ? 0 : 1;
    const diff = (day - startIndex + 7) % 7;
    const start = new Date(base);
    start.setDate(base.getDate() - diff);
    return start;
  }
  isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  formatTimestamp(value) {
    if (!value) {
      return "\u65E5\u6642\u672A\u8A2D\u5B9A";
    }
    const date = new Date(value);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    const hours = `${date.getHours()}`.padStart(2, "0");
    const minutes = `${date.getMinutes()}`.padStart(2, "0");
    return `${year}/${month}/${day} ${hours}:${minutes}`;
  }
  formatDestination(destination) {
    switch (destination) {
      case "goal":
        return "\u632F\u308A\u5206\u3051: \u76EE\u6A19";
      case "task":
        return "\u632F\u308A\u5206\u3051: \u30BF\u30B9\u30AF";
      case "weekly":
        return "\u632F\u308A\u5206\u3051: \u9031\u9593";
      case "issue":
        return "\u632F\u308A\u5206\u3051: \u30A4\u30B7\u30E5\u30FC";
      default:
        return "";
    }
  }
  setStatus(message) {
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
};

// src/ui/exercises_view.ts
var import_obsidian4 = require("obsidian");

// src/services/exercises_service.ts
var ExercisesService = class {
  constructor(repository, baseDir, defaultTags) {
    this.repository = repository;
    this.baseDir = baseDir;
    this.defaultTags = defaultTags;
  }
  async loadSections(sectionDefs) {
    const resolved = resolveLifePlannerPath("Exercises", this.baseDir);
    const content = await this.repository.read(resolved);
    if (!content) {
      const seed = serializeSections(sectionDefs, {}, this.defaultTags);
      await this.repository.write(resolved, seed);
      return buildSectionMap(sectionDefs, {});
    }
    const parsed = parseSections(content);
    const normalized = normalizeSections(sectionDefs, parsed);
    return buildSectionMap(sectionDefs, normalized);
  }
  async saveSections(sectionDefs, sections) {
    const content = serializeSections(sectionDefs, sections, this.defaultTags);
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
function serializeSections(sectionDefs, sections, defaultTags = []) {
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
  return prependTagFrontmatter(lines, defaultTags).join("\n");
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

// src/services/table_section_service.ts
var TableSectionService = class {
  constructor(repository, type, title, columns, baseDir, defaultTags) {
    this.repository = repository;
    this.type = type;
    this.title = title;
    this.columns = columns;
    this.baseDir = baseDir;
    this.defaultTags = defaultTags;
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
    return prependTagFrontmatter(lines, this.defaultTags).join("\n");
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

// src/services/exercise_sections.ts
var BASE_EXERCISE_SECTIONS = [
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
    kind: "list",
    title: "\u4F59\u547D1\u5E74\u30EA\u30B9\u30C8",
    defaultBody: "",
    legacyQuestions: ["\u300C\u4F59\u547D1\u5E74\u300D\u3060\u3063\u305F\u3089\u4F55\u3092\u3057\u305F\u3044\uFF1F"]
  },
  {
    kind: "list",
    title: "\u3042\u3068100\u5E74\u4EBA\u751F\u30EA\u30B9\u30C8",
    defaultBody: "",
    legacyQuestions: ["\u5065\u5EB7\u4F53\u3067\u3042\u3068100\u5E74\u751F\u304D\u3089\u308C\u308B\u3068\u3057\u305F\u3089\u4F55\u3092\u3057\u305F\u3044\uFF1F"]
  },
  {
    kind: "list",
    title: "\u6B7B\u306C\u307E\u3067\u306B\u3084\u308A\u305F\u3044\u3053\u3068",
    defaultBody: "",
    legacyQuestions: ["\u4F55\u3092\u3057\u305F\u3044\uFF1F"]
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
        width: "minmax(120px, 140px)"
      },
      { label: "\u5185\u5BB9", type: "text", multiline: true }
    ]
  }
];
function buildExerciseSectionTitles(customSections = []) {
  const titles = BASE_EXERCISE_SECTIONS.map((section) => section.title);
  const known = new Set(titles.map((title) => title.trim().toLowerCase()));
  customSections.forEach((section) => {
    const title = section?.title?.trim() ?? "";
    if (!title) {
      return;
    }
    const key = title.toLowerCase();
    if (known.has(key)) {
      return;
    }
    known.add(key);
    titles.push(title);
  });
  return titles;
}

// src/ui/i18n.ts
var getPreferredLanguage = () => {
  if (typeof document !== "undefined") {
    const docLang = document.documentElement?.lang?.trim();
    if (docLang) {
      return docLang.toLowerCase();
    }
  }
  if (typeof navigator !== "undefined") {
    const navLang = navigator.language?.trim();
    if (navLang) {
      return navLang.toLowerCase();
    }
  }
  return "ja";
};
var resolveLocalizedText = (text) => {
  const lang = getPreferredLanguage();
  return lang.startsWith("en") ? text.en : text.ja;
};

// src/ui/exercises_view.ts
var ExercisesView = class extends import_obsidian4.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.listEl = null;
    this.statusEl = null;
    this.statusTimer = null;
    this.activeSectionTitle = BASE_EXERCISE_SECTIONS[0]?.title ?? "";
    this.disposeMenuClose = null;
    this.plugin = plugin;
    this.exercisesService = new ExercisesService(
      new MarkdownRepository(this.plugin.app),
      this.plugin.settings.storageDir,
      this.plugin.settings.defaultTags
    );
  }
  getViewType() {
    return EXERCISES_VIEW_TYPE;
  }
  getDisplayText() {
    return resolveLocalizedText({ ja: "\u6F14\u7FD2", en: "Exercises" });
  }
  async onOpen() {
    const container = this.contentEl;
    container.empty();
    const view = container.createEl("div", {
      cls: "lifeplanner-view lifeplanner-exercises-view"
    });
    enableTapToBlur(view);
    view.createEl("h2", { text: resolveLocalizedText({ ja: "\u6F14\u7FD2", en: "Exercises" }) });
    const exerciseSections = this.buildExerciseSections();
    const exerciseSectionTitles = exerciseSections.map((section) => section.title).filter(Boolean);
    if (exerciseSectionTitles.length > 0 && !exerciseSectionTitles.includes(this.activeSectionTitle)) {
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
        activeTemplateId: BUILTIN_TEMPLATE_BY_VIEW.get(EXERCISES_VIEW_TYPE)
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
  async onClose() {
    this.listEl = null;
    this.statusEl = null;
    if (this.statusTimer) {
      window.clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
    this.disposeMenuClose?.();
    this.disposeMenuClose = null;
  }
  buildExerciseSections() {
    const existing = new Set(
      BASE_EXERCISE_SECTIONS.map((section) => section.title.trim().toLowerCase())
    );
    const customSections = this.plugin.settings.customExerciseSections ?? [];
    const customDefs = [];
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
        defaultBody: ""
      });
    }
    const baseContent = BASE_EXERCISE_SECTIONS.filter((section) => section.kind !== "table");
    const baseTables = BASE_EXERCISE_SECTIONS.filter((section) => section.kind === "table");
    return [...baseContent, ...customDefs, ...baseTables];
  }
  buildContentSectionDefs(exerciseSections) {
    return exerciseSections.filter(
      (section) => section.kind !== "table"
    ).map((section) => ({
      title: section.title,
      defaultBody: section.defaultBody,
      questions: section.kind === "list" ? section.legacyQuestions : section.questions ?? void 0
    }));
  }
  async renderExercises() {
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
    const renderSection = async (sectionDef) => {
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
            void this.exercisesService.saveSections(contentSectionDefs, sections);
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
          void this.exercisesService.saveSections(contentSectionDefs, sections);
          this.setStatus("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
        });
      }
    };
    exerciseSections.forEach((sectionDef) => {
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
    const initial = exerciseSections.find((sectionDef) => sectionDef.title === this.activeSectionTitle) ?? exerciseSections[0];
    if (initial) {
      if (this.activeSectionTitle !== initial.title) {
        this.activeSectionTitle = initial.title;
      }
      await renderSection(initial);
    }
  }
  async renderTableSection(container, sectionDef) {
    const service = new TableSectionService(
      new MarkdownRepository(this.plugin.app),
      sectionDef.tableType,
      sectionDef.title,
      sectionDef.columns,
      this.plugin.settings.storageDir,
      this.plugin.settings.defaultTags
    );
    const actions = container.createEl("div", { cls: "lifeplanner-table-actions" });
    const addButton = actions.createEl("button", { text: "\u8FFD\u52A0" });
    const table = container.createEl("div", { cls: "lifeplanner-table-grid" });
    table.dataset.sectionType = sectionDef.tableType;
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
  renderListSection(container, sectionDef, sections, sectionDefs) {
    const rawBody = sections[sectionDef.title] ?? "";
    const parsed = this.parseListItems(rawBody, sectionDef.legacyQuestions ?? []);
    const items = parsed.items.length > 0 ? [...parsed.items] : [""];
    const header = container.createEl("div", { cls: "lifeplanner-exercises-list-header" });
    header.createEl("h3", { text: sectionDef.title });
    const actions = header.createEl("div", { cls: "lifeplanner-exercises-list-actions" });
    const addButton = actions.createEl("button", { text: "\u8FFD\u52A0" });
    const list = container.createEl("div", { cls: "lifeplanner-exercises-list-items" });
    const persist = (showStatus) => {
      sections[sectionDef.title] = this.buildListBody(items);
      void this.exercisesService.saveSections(sectionDefs, sections).then(() => {
        if (showStatus) {
          this.setStatus("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
        }
      });
    };
    const renderRows = () => {
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
  renderPairsSection(container, sectionDef, sections, sectionDefs) {
    const rawBody = sections[sectionDef.title] ?? "";
    const parsed = this.parsePairItems(rawBody);
    const items = parsed.length > 0 ? parsed.map((item) => ({ ...item })) : [{ key: "", value: "" }];
    const header = container.createEl("div", { cls: "lifeplanner-exercises-list-header" });
    header.createEl("h3", { text: sectionDef.title });
    const actions = header.createEl("div", { cls: "lifeplanner-exercises-list-actions" });
    const addButton = actions.createEl("button", { text: "\u8FFD\u52A0" });
    const list = container.createEl("div", { cls: "lifeplanner-exercises-pairs" });
    const persist = (showStatus) => {
      sections[sectionDef.title] = this.buildPairBody(items);
      void this.exercisesService.saveSections(sectionDefs, sections).then(() => {
        if (showStatus) {
          this.setStatus("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
        }
      });
    };
    const renderRows = () => {
      list.empty();
      items.forEach((item, index) => {
        const row = list.createEl("div", { cls: "lifeplanner-exercises-pair-row" });
        const keyInput = row.createEl("textarea", { cls: "lifeplanner-exercises-pair-key" });
        keyInput.rows = 1;
        keyInput.placeholder = "\u9805\u76EE";
        keyInput.value = item.key;
        this.autoResizeTextarea(keyInput);
        const valueInput = row.createEl("textarea", {
          cls: "lifeplanner-exercises-pair-value"
        });
        valueInput.rows = 1;
        valueInput.placeholder = "\u5185\u5BB9";
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
  renderQaSection(container, sectionDef, sections, sectionDefs) {
    const rawBody = sections[sectionDef.title] ?? "";
    const parsed = this.parseQaItems(rawBody);
    const items = parsed.length > 0 ? parsed.map((item) => ({ ...item })) : [{ question: "", answer: "" }];
    const header = container.createEl("div", { cls: "lifeplanner-exercises-list-header" });
    header.createEl("h3", { text: sectionDef.title });
    const actions = header.createEl("div", { cls: "lifeplanner-exercises-list-actions" });
    const addButton = actions.createEl("button", { text: "\u8FFD\u52A0" });
    const list = container.createEl("div", { cls: "lifeplanner-exercises-qa" });
    const persist = (showStatus) => {
      sections[sectionDef.title] = this.buildQaBody(items);
      void this.exercisesService.saveSections(sectionDefs, sections).then(() => {
        if (showStatus) {
          this.setStatus("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
        }
      });
    };
    const renderRows = () => {
      list.empty();
      items.forEach((item, index) => {
        const row = list.createEl("div", { cls: "lifeplanner-exercises-qa-row" });
        const questionInput = row.createEl("textarea", {
          cls: "lifeplanner-exercises-qa-question"
        });
        questionInput.rows = 1;
        questionInput.placeholder = "\u8CEA\u554F";
        questionInput.value = item.question;
        this.autoResizeTextarea(questionInput);
        const answerInput = row.createEl("textarea", {
          cls: "lifeplanner-exercises-qa-answer"
        });
        answerInput.rows = 3;
        answerInput.placeholder = "\u89E3\u7B54";
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
  parsePairItems(rawBody) {
    const items = [];
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
  buildPairBody(items) {
    const cleaned = items.map((item) => ({
      key: item.key.replace(/\s*\n\s*/g, " ").trim(),
      value: item.value.replace(/\s*\n\s*/g, " ").trim()
    })).filter((item) => item.key.length > 0 || item.value.length > 0);
    return cleaned.map((item) => {
      if (!item.key && item.value) {
        return `- ${item.value}`;
      }
      if (item.value) {
        return `- ${item.key}: ${item.value}`;
      }
      return `- ${item.key}:`;
    }).join("\n");
  }
  parseQaItems(rawBody) {
    const items = [];
    const lines = rawBody.split("\n");
    let current = null;
    const flush = () => {
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
          answerLines: inlineAnswer ? [inlineAnswer] : []
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
  buildQaBody(items) {
    const lines = [];
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
  parseListItems(rawBody, legacyQuestions) {
    const items = [];
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
  buildListBody(items) {
    const cleaned = items.map((item) => item.replace(/\s*\n\s*/g, " ").trim()).filter((item) => item.length > 0);
    return cleaned.map((item) => `- ${item}`).join("\n");
  }
  autoResizeTextarea(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }
  setActiveSection(title) {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }
    this.activeSectionTitle = trimmed;
    void this.renderExercises();
  }
  setStatus(message) {
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
};

// src/ui/goal_task_view.ts
var import_obsidian5 = require("obsidian");
var GoalTaskView = class extends import_obsidian5.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.listEl = null;
    this.statusEl = null;
    this.statusTimer = null;
    this.viewEl = null;
    this.disposeMenuClose = null;
    this.taskRows = [];
    this.goalOptions = [];
    this.saveTimer = null;
    this.plugin = plugin;
    const repository = new MarkdownRepository(this.plugin.app);
    this.goalsService = new GoalsService(
      repository,
      this.plugin.settings.storageDir,
      this.plugin.settings.defaultTags
    );
    this.tasksService = new TasksService(
      repository,
      this.plugin.settings.storageDir,
      this.plugin.settings.defaultTags
    );
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
    this.viewEl = view;
    enableTapToBlur(view);
    this.disposeMenuClose = registerRowMenuClose(view);
    view.createEl("h2", { text: "\u30A2\u30AF\u30B7\u30E7\u30F3\u30D7\u30E9\u30F3" });
    renderNavigation(
      view,
      GOAL_TASK_VIEW_TYPE,
      (target) => {
        void this.plugin.navigateToTarget(target, this.leaf);
      },
      this.plugin.settings.hiddenTabs,
      this.plugin.settings.navLayout,
      {
        templateLabels: this.plugin.getTemplateLabelMap(),
        enabledTemplates: this.plugin.settings.enabledTemplates
      }
    );
    this.statusEl = view.createEl("div", {
      cls: "lifeplanner-status lifeplanner-goal-task-status"
    });
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
    const hiddenWrap = section.createEl("div", { cls: "lifeplanner-action-plan-hidden" });
    const hiddenHeader = hiddenWrap.createEl("div", {
      cls: "lifeplanner-action-plan-hidden-header"
    });
    const hiddenToggle = hiddenHeader.createEl("button", { text: "\u975E\u8868\u793A\u30EA\u30B9\u30C8" });
    const hiddenList = hiddenWrap.createEl("div", {
      cls: "lifeplanner-weekly-list lifeplanner-action-plan-list is-hidden"
    });
    const listContext = await this.renderTasks(this.listEl, hiddenList, hiddenWrap, hiddenToggle);
    if (this.statusEl) {
      view.appendChild(this.statusEl);
    }
    addButton.addEventListener("click", (event) => {
      event.preventDefault();
      if (!listContext) {
        return;
      }
      this.addTaskRow(this.goalOptions, listContext);
    });
  }
  async onClose() {
    this.listEl = null;
    this.statusEl = null;
    if (this.statusTimer) {
      window.clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
    this.viewEl = null;
    this.disposeMenuClose?.();
    this.disposeMenuClose = null;
    this.taskRows = [];
    if (this.saveTimer) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }
  async renderTasks(activeList, hiddenList, hiddenWrap, hiddenToggle) {
    if (!this.listEl) {
      return null;
    }
    this.listEl.empty();
    hiddenList.empty();
    this.taskRows = [];
    const tasks = await this.tasksService.listTasks();
    const goals = await this.goalsService.listGoals();
    this.goalOptions = goals.map((goal) => ({ title: goal.title }));
    let hiddenOpen = false;
    const setHiddenOpen = (open) => {
      hiddenOpen = open;
      hiddenList.classList.toggle("is-hidden", !hiddenOpen);
    };
    const updateHiddenCount = () => {
      const count = hiddenList.querySelectorAll(".lifeplanner-action-plan-row").length;
      hiddenToggle.setText(`\u975E\u8868\u793A\u30EA\u30B9\u30C8 (${count})`);
      hiddenWrap.classList.toggle("is-empty", count === 0);
      if (count === 0) {
        setHiddenOpen(false);
      }
    };
    const moveRow = (row, done) => {
      const target = done ? hiddenList : activeList;
      if (row.parentElement !== target) {
        target.appendChild(row);
      }
      updateHiddenCount();
    };
    hiddenToggle.addEventListener("click", (event) => {
      event.preventDefault();
      setHiddenOpen(!hiddenOpen);
    });
    if (tasks.length === 0) {
      const context = { activeList, hiddenList, updateHiddenCount, moveRow };
      this.addTaskRow(this.goalOptions, context);
      updateHiddenCount();
      return context;
    }
    for (const task of tasks) {
      this.addTaskRow(this.goalOptions, { activeList, hiddenList, updateHiddenCount, moveRow }, task.goalId, task.title, task.status === "done");
    }
    updateHiddenCount();
    return { activeList, hiddenList, updateHiddenCount, moveRow };
  }
  addTaskRow(goals, context, goalId = "", title = "", done = false) {
    if (!this.listEl) {
      return;
    }
    const row = context.activeList.createEl("div", {
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
    const menuScope = this.viewEl ?? this.listEl ?? row;
    const onChange = () => this.scheduleSave();
    checkbox.addEventListener("change", () => {
      context.moveRow(row, checkbox.checked);
      onChange();
    });
    select.addEventListener("change", onChange);
    input.addEventListener("input", onChange);
    attachDeleteMenu(row, menuScope, () => {
      row.remove();
      this.taskRows = this.taskRows.filter((item) => item.titleInput !== input);
      context.updateHiddenCount();
      this.scheduleSave();
    });
    this.taskRows.push({ checkbox, goalSelect: select, titleInput: input });
    context.moveRow(row, done);
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
};

// src/ui/goals_view.ts
var import_obsidian6 = require("obsidian");
var LEVELS2 = [
  "\u4EBA\u751F",
  "\u9577\u671F",
  "\u4E2D\u671F",
  "\u5E74\u9593",
  "\u56DB\u534A\u671F",
  "\u6708\u9593",
  "\u9031\u9593"
];
var GoalsView = class extends import_obsidian6.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.listEl = null;
    this.statusEl = null;
    this.statusTimer = null;
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
      this.plugin.settings.storageDir,
      this.plugin.settings.defaultTags
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
    enableTapToBlur(view);
    view.createEl("h2", { text: "\u76EE\u6A19" });
    renderNavigation(
      view,
      GOALS_VIEW_TYPE,
      (target) => {
        void this.plugin.navigateToTarget(target, this.leaf);
      },
      this.plugin.settings.hiddenTabs,
      this.plugin.settings.navLayout,
      {
        templateLabels: this.plugin.getTemplateLabelMap(),
        enabledTemplates: this.plugin.settings.enabledTemplates
      }
    );
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
    for (const level of LEVELS2) {
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
    this.statusEl = view.createEl("div", { cls: "lifeplanner-status lifeplanner-goals-status" });
    this.listEl = view.createEl("div", { cls: "lifeplanner-goals-list" });
    let lastAutoDue = resolveDefaultDueDate(levelSelect.value);
    if (!dueInput.value) {
      dueInput.value = lastAutoDue;
    }
    levelSelect.addEventListener("change", () => {
      const nextAuto = resolveDefaultDueDate(levelSelect.value);
      if (!dueInput.value || dueInput.value === lastAutoDue) {
        dueInput.value = nextAuto;
      }
      lastAutoDue = nextAuto;
    });
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
      lastAutoDue = resolveDefaultDueDate(levelSelect.value);
      dueInput.value = lastAutoDue;
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
    if (this.statusEl) {
      view.appendChild(this.statusEl);
    }
  }
  async onClose() {
    this.listEl = null;
    this.statusEl = null;
    if (this.statusTimer) {
      window.clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
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
    const allowedLevels = parentLevel ? levelsBelow(parentLevel) : LEVELS2;
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
      dueDate: resolveDefaultDueDate(childLevel),
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
    const sourceLevelIndex = LEVELS2.indexOf(source.level);
    const targetLevelIndex = target.level ? LEVELS2.indexOf(target.level) : -1;
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
      const parentLevelIndex = LEVELS2.indexOf(parentGoal.level);
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
    card.style.setProperty("--goal-indent", `${depth * 8}px`);
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
  const index = LEVELS2.indexOf(current);
  if (index < 0 || index + 1 >= LEVELS2.length) {
    return [current];
  }
  return LEVELS2.slice(index + 1);
}
function resolveDefaultDueDate(level, baseDate = /* @__PURE__ */ new Date()) {
  const base = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate()
  );
  let target = base;
  switch (level) {
    case "\u4EBA\u751F": {
      return "";
    }
    case "\u9031\u9593": {
      const day2 = base.getDay();
      const offset = (7 - day2) % 7;
      target = new Date(base);
      target.setDate(base.getDate() + offset);
      break;
    }
    case "\u6708\u9593": {
      target = new Date(base.getFullYear(), base.getMonth() + 1, 0);
      break;
    }
    case "\u56DB\u534A\u671F": {
      const quarter = Math.floor(base.getMonth() / 3);
      let endMonth = quarter * 3 + 2;
      target = new Date(base.getFullYear(), endMonth + 1, 0);
      if (target < base) {
        endMonth += 3;
        target = new Date(base.getFullYear(), endMonth + 1, 0);
      }
      break;
    }
    case "\u5E74\u9593": {
      target = new Date(base.getFullYear(), 11, 31);
      break;
    }
    case "\u4E2D\u671F": {
      target = new Date(base.getFullYear() + 3, 11, 31);
      break;
    }
    case "\u9577\u671F": {
      target = new Date(base.getFullYear() + 5, 11, 31);
      break;
    }
    default: {
      return "";
    }
  }
  const year = target.getFullYear();
  const month = `${target.getMonth() + 1}`.padStart(2, "0");
  const day = `${target.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
var GoalEditModal = class extends import_obsidian6.Modal {
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
    let lastAutoDue = resolveDefaultDueDate(levelSelect.value);
    if (!dueInput.value) {
      dueInput.value = lastAutoDue;
    }
    levelSelect.addEventListener("change", () => {
      const nextAuto = resolveDefaultDueDate(levelSelect.value);
      if (!dueInput.value || dueInput.value === lastAutoDue) {
        dueInput.value = nextAuto;
      }
      lastAutoDue = nextAuto;
    });
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
var import_obsidian7 = require("obsidian");
var InboxView = class extends import_obsidian7.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.listEl = null;
    this.statusEl = null;
    this.statusTimer = null;
    this.disposeMenuClose = null;
    this.viewEl = null;
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
    this.viewEl = view;
    enableTapToBlur(view);
    view.createEl("h2", { text: "Inbox" });
    renderNavigation(
      view,
      INBOX_VIEW_TYPE,
      (target) => {
        void this.plugin.navigateToTarget(target, this.leaf);
      },
      this.plugin.settings.hiddenTabs,
      this.plugin.settings.navLayout,
      {
        templateLabels: this.plugin.getTemplateLabelMap(),
        enabledTemplates: this.plugin.settings.enabledTemplates
      }
    );
    const form = view.createEl("div", { cls: "lifeplanner-inbox-form lifeplanner-form" });
    const input = form.createEl("input", { type: "text" });
    input.placeholder = "\u30E1\u30E2\u3092\u5165\u529B";
    const addButton = form.createEl("button", { text: "\u8FFD\u52A0" });
    this.statusEl = view.createEl("div", { cls: "lifeplanner-status lifeplanner-inbox-status" });
    this.listEl = view.createEl("div", { cls: "lifeplanner-inbox-list" });
    this.disposeMenuClose = registerRowMenuClose(view);
    addButton.addEventListener("click", () => {
      void this.handleAdd(input.value.trim());
      input.value = "";
    });
    await this.renderItems();
    if (this.statusEl) {
      view.appendChild(this.statusEl);
    }
  }
  async onClose() {
    this.listEl = null;
    this.statusEl = null;
    if (this.statusTimer) {
      window.clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
    this.viewEl = null;
    this.disposeMenuClose?.();
    this.disposeMenuClose = null;
  }
  async handleAdd(content) {
    if (!content) {
      this.setStatus("\u30E1\u30E2\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
      return;
    }
    await this.inboxService.addItem(content);
    this.setStatus("\u30E1\u30E2\u3092\u8FFD\u52A0\u3057\u307E\u3057\u305F");
    await this.renderItems();
  }
  async handleGoalTriage(item, level) {
    await this.inboxTriage.toGoal(item, level);
    await this.inboxService.deleteItem(item.id);
    this.setStatus("\u76EE\u6A19\u3078\u8FFD\u52A0\u3057\u307E\u3057\u305F");
    await this.renderItems();
  }
  async handleTaskTriage(item, goalTitle) {
    await this.inboxTriage.toTask(item, goalTitle);
    await this.inboxService.deleteItem(item.id);
    this.setStatus("\u30BF\u30B9\u30AF\u3078\u8FFD\u52A0\u3057\u307E\u3057\u305F");
    await this.renderItems();
  }
  async handleWeeklyTriage(item) {
    await this.inboxTriage.toWeekly(item);
    await this.inboxService.deleteItem(item.id);
    this.setStatus("\u9031\u9593\u8A08\u753B\u3078\u8FFD\u52A0\u3057\u307E\u3057\u305F");
    await this.renderItems();
  }
  async handleIssueTriage(item) {
    await this.inboxTriage.toIssue(item);
    await this.inboxService.deleteItem(item.id);
    this.setStatus("\u30A4\u30B7\u30E5\u30FC\u3078\u8FFD\u52A0\u3057\u307E\u3057\u305F");
    await this.renderItems();
  }
  async handleDelete(itemId) {
    await this.inboxService.deleteItem(itemId);
    this.setStatus("\u524A\u9664\u3057\u307E\u3057\u305F");
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
    const sortedItems = [...items].sort(
      (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
    );
    const goals = await this.goalsService.listGoals();
    const goalTitles = goals.map((goal) => goal.title);
    const goalLevels = ["\u4EBA\u751F", "\u9577\u671F", "\u4E2D\u671F", "\u5E74\u9593", "\u56DB\u534A\u671F", "\u6708\u9593", "\u9031\u9593"];
    for (const item of sortedItems) {
      const row = this.listEl.createEl("div", { cls: "lifeplanner-inbox-row" });
      const meta = row.createEl("div", { cls: "lifeplanner-inbox-meta" });
      meta.createEl("span", {
        cls: "lifeplanner-inbox-timestamp",
        text: this.formatTimestamp(item.createdAt)
      });
      const destLabel = this.formatDestination(item.destination);
      if (destLabel) {
        meta.createEl("span", { cls: "lifeplanner-inbox-destination", text: destLabel });
      }
      const inputRow = row.createEl("div", { cls: "lifeplanner-inbox-input-row" });
      const input = inputRow.createEl("input", { type: "text", cls: "lifeplanner-inbox-input" });
      input.placeholder = "\u30E1\u30E2";
      input.value = item.content;
      let lastSaved = item.content;
      input.addEventListener("input", () => {
        const nextValue = input.value.trim();
        if (!nextValue || nextValue === lastSaved) {
          return;
        }
        lastSaved = nextValue;
        void this.inboxService.updateItem(item.id, nextValue).then(() => {
          this.setStatus("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
        });
      });
      input.addEventListener("blur", () => {
        if (input.value.trim().length === 0) {
          input.value = lastSaved;
          this.setStatus("\u30E1\u30E2\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
        }
      });
      const menuHost = inputRow.createEl("div", { cls: "lifeplanner-inbox-menu" });
      const menuScope = this.viewEl ?? this.listEl ?? row;
      const resolveContent = () => {
        const content = input.value.trim();
        if (!content) {
          input.value = lastSaved;
          this.setStatus("\u30E1\u30E2\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
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
        cls: "lifeplanner-inbox-panel lifeplanner-hidden"
      });
      goalPanel.createEl("span", { cls: "lifeplanner-inbox-panel-label", text: "\u30B9\u30D1\u30F3" });
      const goalSelect = goalPanel.createEl("select");
      goalLevels.forEach((level) => {
        goalSelect.createEl("option", { text: level, value: level });
      });
      goalSelect.value = "\u9031\u9593";
      const goalConfirm = goalPanel.createEl("button", { text: "\u8FFD\u52A0" });
      const taskPanel = panels.createEl("div", {
        cls: "lifeplanner-inbox-panel lifeplanner-hidden"
      });
      taskPanel.createEl("span", { cls: "lifeplanner-inbox-panel-label", text: "\u76EE\u6A19" });
      const taskSelect = taskPanel.createEl("select");
      if (goalTitles.length > 0) {
        const placeholder = taskSelect.createEl("option", { text: "\u76EE\u6A19\u3092\u9078\u629E", value: "" });
        placeholder.disabled = true;
        placeholder.selected = true;
        goalTitles.forEach((title) => {
          taskSelect.createEl("option", { text: title, value: title });
        });
      } else {
        taskSelect.createEl("option", { text: "\u9031\u9593", value: "\u9031\u9593" });
        taskSelect.value = "\u9031\u9593";
      }
      const taskConfirm = taskPanel.createEl("button", { text: "\u8FFD\u52A0" });
      const togglePanel = (panel) => {
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
        void this.handleGoalTriage(current, goalSelect.value);
        goalPanel.classList.add("lifeplanner-hidden");
      });
      taskConfirm.addEventListener("click", () => {
        const current = resolveContent();
        if (!current) {
          return;
        }
        if (!taskSelect.value) {
          this.setStatus("\u76EE\u6A19\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044");
          return;
        }
        void this.handleTaskTriage(current, taskSelect.value);
        taskPanel.classList.add("lifeplanner-hidden");
      });
      attachRowMenu(menuHost, menuScope, [
        {
          label: "\u76EE\u6A19\u3078",
          onSelect: () => togglePanel(goalPanel)
        },
        {
          label: "\u30BF\u30B9\u30AF\u3078",
          onSelect: () => togglePanel(taskPanel)
        },
        {
          label: "\u9031\u9593\u3078",
          onSelect: () => {
            const current = resolveContent();
            if (!current) {
              return;
            }
            void this.handleWeeklyTriage(current);
            goalPanel.classList.add("lifeplanner-hidden");
            taskPanel.classList.add("lifeplanner-hidden");
          }
        },
        {
          label: "\u30A4\u30B7\u30E5\u30FC\u3078",
          onSelect: () => {
            const current = resolveContent();
            if (!current) {
              return;
            }
            void this.handleIssueTriage(current);
            goalPanel.classList.add("lifeplanner-hidden");
            taskPanel.classList.add("lifeplanner-hidden");
          }
        },
        {
          label: "\u524A\u9664",
          onSelect: () => {
            void this.handleDelete(item.id);
          }
        }
      ]);
    }
  }
  formatTimestamp(value) {
    if (!value) {
      return "\u65E5\u6642\u672A\u8A2D\u5B9A";
    }
    const date = new Date(value);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    const hours = `${date.getHours()}`.padStart(2, "0");
    const minutes = `${date.getMinutes()}`.padStart(2, "0");
    return `${year}/${month}/${day} ${hours}:${minutes}`;
  }
  formatDestination(destination) {
    switch (destination) {
      case "goal":
        return "\u632F\u308A\u5206\u3051: \u76EE\u6A19";
      case "task":
        return "\u632F\u308A\u5206\u3051: \u30BF\u30B9\u30AF";
      case "weekly":
        return "\u632F\u308A\u5206\u3051: \u9031\u9593";
      case "issue":
        return "\u632F\u308A\u5206\u3051: \u30A4\u30B7\u30E5\u30FC";
      default:
        return "";
    }
  }
  setStatus(message) {
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
};

// src/ui/issues_view.ts
var import_obsidian8 = require("obsidian");
var PRIORITIES = ["Low", "Medium", "High"];
var IssuesView = class extends import_obsidian8.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.listEl = null;
    this.statusEl = null;
    this.statusTimer = null;
    this.issues = [];
    this.handleMenuClose = null;
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
    enableTapToBlur(view);
    view.createEl("h2", { text: "\u30A4\u30B7\u30E5\u30FC" });
    renderNavigation(
      view,
      ISSUES_VIEW_TYPE,
      (target) => {
        void this.plugin.navigateToTarget(target, this.leaf);
      },
      this.plugin.settings.hiddenTabs,
      this.plugin.settings.navLayout,
      {
        templateLabels: this.plugin.getTemplateLabelMap(),
        enabledTemplates: this.plugin.settings.enabledTemplates
      }
    );
    this.statusEl = view.createEl("div", { cls: "lifeplanner-status lifeplanner-issues-status" });
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
    if (this.statusEl) {
      view.appendChild(this.statusEl);
    }
  }
  async onClose() {
    this.listEl = null;
    this.statusEl = null;
    this.issues = [];
    if (this.statusTimer) {
      window.clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
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
          const body = card.createEl("div", {
            cls: "lifeplanner-kanban-body lifeplanner-markdown"
          });
          void import_obsidian8.MarkdownRenderer.renderMarkdown(issue.body, body, "", this);
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
};
var IssueEditModal = class extends import_obsidian8.Modal {
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
var import_obsidian9 = require("obsidian");

// src/services/simple_section_service.ts
var SimpleSectionService = class {
  constructor(repository, type, title, baseDir, defaultTags) {
    this.repository = repository;
    this.type = type;
    this.title = title;
    this.baseDir = baseDir;
    this.defaultTags = defaultTags;
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
    return prependTagFrontmatter(lines, this.defaultTags).join("\n");
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
var SimpleSectionView = class extends import_obsidian9.ItemView {
  constructor(leaf, plugin, viewType, type, titleText) {
    super(leaf);
    this.statusEl = null;
    this.inputEl = null;
    this.displayEl = null;
    this.viewEl = null;
    this.disposeMenuClose = null;
    this.statusTimer = null;
    this.plugin = plugin;
    this.viewType = viewType;
    this.titleText = titleText;
    this.service = new SimpleSectionService(
      new MarkdownRepository(this.plugin.app),
      type,
      titleText,
      this.plugin.settings.storageDir,
      this.plugin.settings.defaultTags
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
    this.viewEl = view;
    enableTapToBlur(view);
    this.disposeMenuClose = registerRowMenuClose(view);
    const header = view.createEl("div", { cls: "lifeplanner-simple-section-header" });
    header.createEl("h2", { text: this.titleText });
    renderNavigation(
      view,
      this.viewType,
      (target) => {
        void this.plugin.navigateToTarget(target, this.leaf);
      },
      this.plugin.settings.hiddenTabs,
      this.plugin.settings.navLayout,
      {
        templateLabels: this.plugin.getTemplateLabelMap(),
        enabledTemplates: this.plugin.settings.enabledTemplates,
        activeTemplateId: BUILTIN_TEMPLATE_BY_VIEW.get(this.viewType)
      }
    );
    const body = view.createEl("div", { cls: "lifeplanner-simple-section-body" });
    const hero = body.createEl("div", { cls: "lifeplanner-simple-section-hero" });
    const actions = hero.createEl("div", { cls: "lifeplanner-simple-section-actions" });
    this.displayEl = hero.createEl("div", {
      cls: "lifeplanner-simple-section-display lifeplanner-markdown"
    });
    this.inputEl = hero.createEl("textarea", { cls: "lifeplanner-simple-section-input" });
    this.statusEl = view.createEl("div", {
      cls: "lifeplanner-status lifeplanner-simple-section-status"
    });
    this.inputEl.rows = 12;
    this.inputEl.value = await this.service.load();
    const updateDisplay = () => {
      if (!this.displayEl || !this.inputEl) {
        return;
      }
      this.displayEl.empty();
      const value = this.inputEl.value.trim();
      if (!value) {
        this.displayEl.setText("(\u672A\u8A18\u5165)");
        this.displayEl.classList.add("is-empty");
        return;
      }
      this.displayEl.classList.remove("is-empty");
      void import_obsidian9.MarkdownRenderer.renderMarkdown(value, this.displayEl, "", this);
    };
    const setEditMode = (editing) => {
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
        label: "\u7DE8\u96C6",
        onSelect: () => setEditMode(true)
      },
      {
        label: "\u524A\u9664",
        onSelect: () => {
          if (!this.inputEl) {
            return;
          }
          this.inputEl.value = "";
          void this.service.save("");
          updateDisplay();
          setEditMode(false);
          this.setStatus("\u524A\u9664\u3057\u307E\u3057\u305F");
        }
      }
    ]);
    this.inputEl.addEventListener("input", () => {
      void this.service.save(this.inputEl?.value ?? "");
      updateDisplay();
      this.setStatus("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
    });
    this.inputEl.addEventListener("blur", () => {
      updateDisplay();
      setEditMode(false);
    });
    updateDisplay();
    setEditMode(false);
    if (this.statusEl) {
      view.appendChild(this.statusEl);
    }
  }
  async onClose() {
    this.statusEl = null;
    this.inputEl = null;
    this.displayEl = null;
    this.viewEl = null;
    this.disposeMenuClose?.();
    this.disposeMenuClose = null;
    if (this.statusTimer) {
      window.clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
  }
  setStatus(message) {
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
};

// src/ui/table_section_view.ts
var import_obsidian10 = require("obsidian");
var TableSectionView = class extends import_obsidian10.ItemView {
  constructor(leaf, plugin, viewType, type, titleText, columns) {
    super(leaf);
    this.statusEl = null;
    this.statusTimer = null;
    this.rows = [];
    this.tableEl = null;
    this.enableRowActions = true;
    this.viewEl = null;
    this.disposeMenuClose = null;
    this.plugin = plugin;
    this.viewType = viewType;
    this.titleText = titleText;
    this.columns = columns;
    this.sectionType = type;
    this.service = new TableSectionService(
      new MarkdownRepository(this.plugin.app),
      type,
      titleText,
      columns,
      this.plugin.settings.storageDir,
      this.plugin.settings.defaultTags
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
    this.viewEl = view;
    enableTapToBlur(view);
    this.disposeMenuClose = registerRowMenuClose(view);
    view.createEl("h2", { text: this.titleText });
    renderNavigation(
      view,
      this.viewType,
      (target) => {
        void this.plugin.navigateToTarget(target, this.leaf);
      },
      this.plugin.settings.hiddenTabs,
      this.plugin.settings.navLayout,
      {
        templateLabels: this.plugin.getTemplateLabelMap(),
        enabledTemplates: this.plugin.settings.enabledTemplates,
        activeTemplateId: BUILTIN_TEMPLATE_BY_VIEW.get(this.viewType)
      }
    );
    this.statusEl = view.createEl("div", { cls: "lifeplanner-status lifeplanner-table-status" });
    const header = view.createEl("div", { cls: "lifeplanner-table-actions" });
    const addButton = header.createEl("button", { text: "\u8FFD\u52A0" });
    this.tableEl = view.createEl("div", { cls: "lifeplanner-table-grid" });
    this.tableEl.dataset.sectionType = this.sectionType;
    await this.renderTable();
    if (this.statusEl) {
      view.appendChild(this.statusEl);
    }
    addButton.addEventListener("click", () => {
      this.rows.push([]);
      void this.save();
      void this.renderTable();
    });
  }
  async onClose() {
    this.statusEl = null;
    if (this.statusTimer) {
      window.clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
    this.tableEl = null;
    this.rows = [];
    this.viewEl = null;
    this.disposeMenuClose?.();
    this.disposeMenuClose = null;
  }
  async renderTable() {
    if (!this.tableEl) {
      return;
    }
    this.tableEl.empty();
    const columnTemplate = this.columns.map((column) => {
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
    const actionColumn = this.enableRowActions ? "36px" : "";
    this.tableEl.style.gridTemplateColumns = [columnTemplate, actionColumn].filter(Boolean).join(" ");
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
    if (this.enableRowActions) {
      this.tableEl?.createEl("div", {
        cls: "lifeplanner-table-cell lifeplanner-table-header",
        text: ""
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
  removeRow(rowIndex) {
    this.rows.splice(rowIndex, 1);
    if (this.rows.length === 0) {
      this.rows.push([]);
    }
    void this.save().then(() => this.renderTable());
  }
  autoResizeTextarea(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }
  setStatus(message) {
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
};

// src/ui/template_section_view.ts
var import_obsidian11 = require("obsidian");

// src/services/template_section_service.ts
var TemplateSectionService = class {
  constructor(repository, templateId, title, baseDir, defaultTags, options = {}) {
    this.repository = repository;
    this.templateId = templateId;
    this.title = title;
    this.baseDir = baseDir;
    this.defaultTags = defaultTags;
    this.selectOptions = (options.selectOptions ?? []).map((option) => option.trim()).filter((option) => option.length > 0);
  }
  async load() {
    const path = resolveTemplateSectionPath(this.templateId, this.baseDir);
    const content = await this.repository.read(path);
    if (!content) {
      await this.repository.write(path, this.serialize(""));
      return "";
    }
    return this.parse(content);
  }
  async save(body) {
    await this.repository.write(
      resolveTemplateSectionPath(this.templateId, this.baseDir),
      this.serialize(body)
    );
  }
  serialize(body) {
    const lines = [];
    lines.push(...this.buildFrontmatter());
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
  buildFrontmatter() {
    const tags = normalizeTags(this.defaultTags);
    const hasTags = tags.length > 0;
    const hasOptions = this.selectOptions.length > 0;
    if (!hasTags && !hasOptions) {
      return [];
    }
    const frontmatter = ["---"];
    if (hasTags) {
      frontmatter.push("tags:");
      tags.forEach((tag) => {
        frontmatter.push(`  - ${tag}`);
      });
    }
    if (hasOptions) {
      frontmatter.push("selectOptions:");
      this.selectOptions.forEach((option) => {
        frontmatter.push(`  - ${JSON.stringify(option)}`);
      });
    }
    frontmatter.push("---", "");
    return frontmatter;
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

// src/ui/template_section_view.ts
var TemplateSectionView = class extends import_obsidian11.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.templateId = "";
    this.template = null;
    this.service = null;
    this.statusEl = null;
    this.statusTimer = null;
    this.disposeMenuClose = null;
    this.inputEl = null;
    this.displayEl = null;
    this.plugin = plugin;
  }
  getViewType() {
    return TEMPLATE_SECTION_VIEW_TYPE;
  }
  getDisplayText() {
    return this.template?.label ?? resolveLocalizedText({ ja: "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8", en: "Template" });
  }
  getState() {
    return { templateId: this.templateId };
  }
  async setState(state) {
    const nextId = state?.templateId ?? "";
    if (nextId !== this.templateId) {
      this.templateId = nextId;
    }
    await this.renderView();
  }
  async onOpen() {
    const state = this.leaf.getViewState().state;
    if (state?.templateId) {
      this.templateId = state.templateId;
    }
    await this.renderView();
  }
  async onClose() {
    this.cleanup();
  }
  cleanup() {
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
  async renderView() {
    this.cleanup();
    const container = this.contentEl;
    container.empty();
    const view = container.createEl("div", { cls: "lifeplanner-view" });
    enableTapToBlur(view);
    this.disposeMenuClose = registerRowMenuClose(view);
    const template = this.findTemplate();
    this.template = template;
    const title = template?.label ?? resolveLocalizedText({ ja: "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8", en: "Template" });
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
        activeTemplateId: this.templateId
      }
    );
    const body = view.createEl("div", { cls: "lifeplanner-simple-section-body" });
    this.statusEl = view.createEl("div", {
      cls: "lifeplanner-status lifeplanner-template-status"
    });
    if (!template) {
      body.createEl("div", {
        cls: "lifeplanner-settings-muted",
        text: "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002"
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
        selectOptions: template.format === "select" ? template.selectOptions : void 0
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
  findTemplate() {
    if (!this.templateId) {
      return null;
    }
    return this.plugin.settings.customTemplates.find(
      (template) => template.id === this.templateId
    ) ?? null;
  }
  async renderFreeSection(container) {
    if (!this.service) {
      return;
    }
    const hero = container.createEl("div", { cls: "lifeplanner-simple-section-hero" });
    const actions = hero.createEl("div", { cls: "lifeplanner-simple-section-actions" });
    this.displayEl = hero.createEl("div", {
      cls: "lifeplanner-simple-section-display lifeplanner-markdown"
    });
    this.inputEl = hero.createEl("textarea", { cls: "lifeplanner-simple-section-input" });
    this.inputEl.rows = 12;
    this.inputEl.value = await this.service.load();
    const updateDisplay = () => {
      if (!this.displayEl || !this.inputEl) {
        return;
      }
      this.displayEl.empty();
      const value = this.inputEl.value.trim();
      if (!value) {
        this.displayEl.setText("(\u672A\u8A18\u5165)");
        this.displayEl.classList.add("is-empty");
        return;
      }
      this.displayEl.classList.remove("is-empty");
      void import_obsidian11.MarkdownRenderer.renderMarkdown(value, this.displayEl, "", this);
    };
    const setEditMode = (editing) => {
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
        label: "\u7DE8\u96C6",
        onSelect: () => setEditMode(true)
      },
      {
        label: "\u524A\u9664",
        onSelect: () => {
          if (!this.inputEl || !this.service) {
            return;
          }
          this.inputEl.value = "";
          void this.service.save("");
          updateDisplay();
          setEditMode(false);
          this.setStatus("\u524A\u9664\u3057\u307E\u3057\u305F");
        }
      }
    ]);
    this.inputEl.addEventListener("input", () => {
      if (!this.service) {
        return;
      }
      void this.service.save(this.inputEl?.value ?? "");
      updateDisplay();
      this.setStatus("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
    });
    this.inputEl.addEventListener("blur", () => {
      updateDisplay();
      setEditMode(false);
    });
    updateDisplay();
    setEditMode(false);
  }
  async renderListSection(container) {
    if (!this.service) {
      return;
    }
    const rawBody = await this.service.load();
    const parsed = this.parseListItems(rawBody);
    const items = parsed.length > 0 ? [...parsed] : [""];
    const header = container.createEl("div", { cls: "lifeplanner-exercises-list-header" });
    header.createEl("h3", { text: this.template?.label ?? "" });
    const actions = header.createEl("div", { cls: "lifeplanner-exercises-list-actions" });
    const addButton = actions.createEl("button", { text: "\u8FFD\u52A0" });
    const list = container.createEl("div", { cls: "lifeplanner-exercises-list-items" });
    const persist = (showStatus) => {
      if (!this.service) {
        return;
      }
      void this.service.save(this.buildListBody(items)).then(() => {
        if (showStatus) {
          this.setStatus("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
        }
      });
    };
    const renderRows = () => {
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
  async renderPairsSection(container) {
    if (!this.service) {
      return;
    }
    const rawBody = await this.service.load();
    const parsed = this.parsePairItems(rawBody);
    const items = parsed.length > 0 ? parsed.map((item) => ({ ...item })) : [{ key: "", value: "" }];
    const header = container.createEl("div", { cls: "lifeplanner-exercises-list-header" });
    header.createEl("h3", { text: this.template?.label ?? "" });
    const actions = header.createEl("div", { cls: "lifeplanner-exercises-list-actions" });
    const addButton = actions.createEl("button", { text: "\u8FFD\u52A0" });
    const list = container.createEl("div", { cls: "lifeplanner-exercises-pairs" });
    const persist = (showStatus) => {
      if (!this.service) {
        return;
      }
      void this.service.save(this.buildPairBody(items)).then(() => {
        if (showStatus) {
          this.setStatus("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
        }
      });
    };
    const renderRows = () => {
      list.empty();
      items.forEach((item, index) => {
        const row = list.createEl("div", { cls: "lifeplanner-exercises-pair-row" });
        const keyInput = row.createEl("textarea", { cls: "lifeplanner-exercises-pair-key" });
        keyInput.rows = 1;
        keyInput.placeholder = "\u9805\u76EE";
        keyInput.value = item.key;
        this.autoResizeTextarea(keyInput);
        const valueInput = row.createEl("textarea", {
          cls: "lifeplanner-exercises-pair-value"
        });
        valueInput.rows = 1;
        valueInput.placeholder = "\u5185\u5BB9";
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
  async renderSelectSection(container, template) {
    if (!this.service) {
      return;
    }
    const rawBody = await this.service.load();
    const parsed = this.parsePairItems(rawBody);
    const options = template.selectOptions ?? [];
    const fallbackKey = options[0] ?? "";
    const items = parsed.length > 0 ? parsed.map((item) => ({ ...item })) : [{ key: fallbackKey, value: "" }];
    const header = container.createEl("div", { cls: "lifeplanner-exercises-list-header" });
    header.createEl("h3", { text: template.label });
    const actions = header.createEl("div", { cls: "lifeplanner-exercises-list-actions" });
    const addButton = actions.createEl("button", { text: "\u8FFD\u52A0" });
    const list = container.createEl("div", { cls: "lifeplanner-exercises-pairs" });
    const persist = (showStatus) => {
      if (!this.service) {
        return;
      }
      void this.service.save(this.buildPairBody(items)).then(() => {
        if (showStatus) {
          this.setStatus("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
        }
      });
    };
    const renderRows = () => {
      list.empty();
      items.forEach((item, index) => {
        const row = list.createEl("div", { cls: "lifeplanner-exercises-pair-row" });
        const keySelect = row.createEl("select", { cls: "lifeplanner-exercises-pair-key" });
        const availableOptions = options.includes(item.key) ? options : [...options, item.key].filter((option) => option.length > 0);
        availableOptions.forEach((option) => {
          keySelect.createEl("option", { text: option, value: option });
        });
        const selectedKey = item.key || fallbackKey;
        keySelect.value = selectedKey;
        if (!item.key && selectedKey) {
          items[index].key = selectedKey;
        }
        keySelect.addEventListener("change", () => {
          items[index].key = keySelect.value;
          persist(true);
        });
        const valueInput = row.createEl("textarea", {
          cls: "lifeplanner-exercises-pair-value"
        });
        valueInput.rows = 1;
        valueInput.placeholder = "\u5185\u5BB9";
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
  async renderQaSection(container) {
    if (!this.service) {
      return;
    }
    const rawBody = await this.service.load();
    const parsed = this.parseQaItems(rawBody);
    const items = parsed.length > 0 ? parsed.map((item) => ({ ...item })) : [{ question: "", answer: "" }];
    const header = container.createEl("div", { cls: "lifeplanner-exercises-list-header" });
    header.createEl("h3", { text: this.template?.label ?? "" });
    const actions = header.createEl("div", { cls: "lifeplanner-exercises-list-actions" });
    const addButton = actions.createEl("button", { text: "\u8FFD\u52A0" });
    const list = container.createEl("div", { cls: "lifeplanner-exercises-qa" });
    const persist = (showStatus) => {
      if (!this.service) {
        return;
      }
      void this.service.save(this.buildQaBody(items)).then(() => {
        if (showStatus) {
          this.setStatus("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
        }
      });
    };
    const renderRows = () => {
      list.empty();
      items.forEach((item, index) => {
        const row = list.createEl("div", { cls: "lifeplanner-exercises-qa-row" });
        const questionInput = row.createEl("textarea", {
          cls: "lifeplanner-exercises-qa-question"
        });
        questionInput.rows = 1;
        questionInput.placeholder = "\u8CEA\u554F";
        questionInput.value = item.question;
        this.autoResizeTextarea(questionInput);
        const answerInput = row.createEl("textarea", {
          cls: "lifeplanner-exercises-qa-answer"
        });
        answerInput.rows = 3;
        answerInput.placeholder = "\u89E3\u7B54";
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
  parsePairItems(rawBody) {
    const items = [];
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
  buildPairBody(items) {
    const cleaned = items.map((item) => ({
      key: item.key.replace(/\s*\n\s*/g, " ").trim(),
      value: item.value.replace(/\s*\n\s*/g, " ").trim()
    })).filter((item) => item.key.length > 0 || item.value.length > 0);
    return cleaned.map((item) => {
      if (!item.key && item.value) {
        return `- ${item.value}`;
      }
      if (item.value) {
        return `- ${item.key}: ${item.value}`;
      }
      return `- ${item.key}:`;
    }).join("\n");
  }
  parseQaItems(rawBody) {
    const items = [];
    const lines = rawBody.split("\n");
    let current = null;
    const flush = () => {
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
          answerLines: inlineAnswer ? [inlineAnswer] : []
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
  buildQaBody(items) {
    const lines = [];
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
  parseListItems(rawBody) {
    const items = [];
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
  buildListBody(items) {
    const cleaned = items.map((item) => item.replace(/\s*\n\s*/g, " ").trim()).filter((item) => item.length > 0);
    return cleaned.map((item) => `- ${item}`).join("\n");
  }
  autoResizeTextarea(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }
  setStatus(message) {
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
};

// src/settings.ts
var import_obsidian12 = require("obsidian");
var DASHBOARD_SECTION_TYPES = NAV_GROUPS.flatMap(
  (group) => group.items.map((item) => item.viewType)
).filter((viewType) => viewType !== DASHBOARD_VIEW_TYPE);
var DEFAULT_DASHBOARD_SECTIONS = [
  INBOX_VIEW_TYPE,
  WEEKLY_PLAN_VIEW_TYPE
];
var DEFAULT_SETTINGS = {
  weekStart: "monday",
  storageDir: "LifePlanner",
  kanbanColumns: ["Backlog", "Todo", "Doing", "Done"],
  actionPlanMinLevel: "\u6708\u9593",
  defaultTags: ["lifeplanner"],
  customExerciseSections: [],
  enabledTemplates: [...DEFAULT_TEMPLATE_IDS],
  templateOrder: [...DEFAULT_TEMPLATE_IDS],
  customTemplates: [],
  hiddenTabs: [],
  navLayout: buildDefaultNavLayout(),
  dashboardSections: DEFAULT_DASHBOARD_SECTIONS,
  showDashboardCalendar: true
};
var LifePlannerSettingTab = class extends import_obsidian12.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h3", { text: "\u57FA\u672C\u8A2D\u5B9A" });
    new import_obsidian12.Setting(containerEl).setName("\u9031\u306E\u958B\u59CB\u66DC\u65E5").setDesc("\u9031\u9593\u30D5\u30A1\u30A4\u30EB\u306E\u65E5\u4ED8\u8A08\u7B97\u306B\u4F7F\u7528\u3059\u308B\u958B\u59CB\u66DC\u65E5\u3067\u3059\u3002").addDropdown((dropdown) => {
      dropdown.addOption("monday", "\u6708\u66DC\u59CB\u307E\u308A").addOption("sunday", "\u65E5\u66DC\u59CB\u307E\u308A").setValue(this.plugin.settings.weekStart).onChange(async (value) => {
        this.plugin.settings.weekStart = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian12.Setting(containerEl).setName("\u4FDD\u5B58\u30D5\u30A9\u30EB\u30C0").setDesc("LifePlanner\u306E\u30D5\u30A1\u30A4\u30EB\u3092\u4FDD\u5B58\u3059\u308B\u30D5\u30A9\u30EB\u30C0\u30D1\u30B9\u3067\u3059\u3002").addText((input) => {
      input.setPlaceholder("LifePlanner");
      input.setValue(this.plugin.settings.storageDir);
      input.onChange(async (value) => {
        this.plugin.settings.storageDir = value.trim() || "LifePlanner";
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian12.Setting(containerEl).setName("\u30A4\u30B7\u30E5\u30FC\u306E\u30AB\u30E9\u30E0").setDesc("\u30AB\u30F3\u30DE\u533A\u5207\u308A\u3067\u30AB\u30E9\u30E0\u540D\u3092\u8A2D\u5B9A\u3057\u307E\u3059\u3002").addTextArea((input) => {
      input.setValue(this.plugin.settings.kanbanColumns.join(", "));
      input.onChange(async (value) => {
        const columns = value.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
        this.plugin.settings.kanbanColumns = columns.length > 0 ? columns : ["Backlog"];
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian12.Setting(containerEl).setName("\u30C7\u30D5\u30A9\u30EB\u30C8\u30BF\u30B0").setDesc("LifePlanner\u3067\u4F5C\u6210/\u66F4\u65B0\u3059\u308BMarkdown\u306B\u4ED8\u4E0E\u3057\u307E\u3059\uFF08\u30AB\u30F3\u30DE\u533A\u5207\u308A\uFF09\u3002").addText((input) => {
      input.setPlaceholder("lifeplanner");
      input.setValue(this.plugin.settings.defaultTags.join(", "));
      input.onChange(async (value) => {
        const tags = value.split(",").map((tag) => tag.trim()).filter((tag) => tag.length > 0);
        this.plugin.settings.defaultTags = tags;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian12.Setting(containerEl).setName("\u30A2\u30AF\u30B7\u30E7\u30F3\u30D7\u30E9\u30F3\u306E\u6700\u5C0F\u968E\u5C64").setDesc("\u3053\u306E\u968E\u5C64\u4EE5\u4E0B\u306E\u76EE\u6A19\u3092\u5019\u88DC\u306B\u8868\u793A\u3057\u307E\u3059\u3002").addDropdown((dropdown) => {
      ["\u4EBA\u751F", "\u9577\u671F", "\u4E2D\u671F", "\u5E74\u9593", "\u56DB\u534A\u671F", "\u6708\u9593", "\u9031\u9593"].forEach((level) => {
        dropdown.addOption(level, level);
      });
      dropdown.setValue(this.plugin.settings.actionPlanMinLevel);
      dropdown.onChange(async (value) => {
        this.plugin.settings.actionPlanMinLevel = value;
        await this.plugin.saveSettings();
      });
    });
    containerEl.createEl("h3", { text: "\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9" });
    new import_obsidian12.Setting(containerEl).setName("\u30DF\u30CB\u30AB\u30EC\u30F3\u30C0\u30FC\u8868\u793A").setDesc("\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u306B\u6708\u9593\u30AB\u30EC\u30F3\u30C0\u30FC\u3092\u8868\u793A\u3057\u307E\u3059\u3002").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.showDashboardCalendar);
      toggle.onChange(async (value) => {
        this.plugin.settings.showDashboardCalendar = value;
        await this.plugin.saveSettings();
      });
    });
    containerEl.createEl("h3", { text: "\u30BF\u30D6/\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u8A2D\u5B9A" });
    containerEl.createEl("p", {
      cls: "lifeplanner-settings-hint",
      text: "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u306E\u8FFD\u52A0\u30FB\u7DE8\u96C6\u306F\u3053\u3053\u3067\u3001\u30BF\u30D6\u306E\u8868\u793A/\u4E26\u3073\u66FF\u3048\u306F\u4E0B\u306E\u30BF\u30D6\u69CB\u6210\u3067\u8A2D\u5B9A\u3057\u307E\u3059\u3002\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u306F\u30BF\u30D6\u306B\u5272\u308A\u5F53\u3066\u308B\u3068\u5165\u529B\u753B\u9762\u304C\u958B\u304D\u307E\u3059\u3002"
    });
    this.renderNavigationSettings(containerEl);
  }
  renderTemplateSettings(containerEl, options = {}) {
    const headingTag = options.headingTag ?? "h3";
    containerEl.createEl(headingTag, { text: "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8" });
    if (options.includeHint !== false) {
      containerEl.createEl("p", {
        cls: "lifeplanner-settings-hint",
        text: "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u306F5\u3064\u306E\u5F62\u5F0F\u304B\u3089\u4F5C\u6210\u3067\u304D\u307E\u3059\u3002\u65B0\u898F\u8FFD\u52A0\u30FB\u7DE8\u96C6\u30FB\u524A\u9664\u304C\u3067\u304D\u307E\u3059\u3002"
      });
    }
    const section = containerEl.createEl("div");
    const actions = section.createEl("div");
    const addButton = actions.createEl("button", { text: "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u3092\u8FFD\u52A0" });
    addButton.setAttr("type", "button");
    const list = section.createEl("div", { cls: "lifeplanner-settings-block" });
    const notifyTemplatesUpdated = () => {
      options.onTemplatesUpdated?.();
    };
    const ensureTemplateFile = async (entry) => {
      const service = new TemplateSectionService(
        new MarkdownRepository(this.app),
        entry.id,
        entry.label,
        this.plugin.settings.storageDir,
        this.plugin.settings.defaultTags,
        {
          selectOptions: entry.format === "select" ? entry.selectOptions : void 0
        }
      );
      await service.load();
    };
    const deleteTemplateFile = async (templateId) => {
      const path = resolveTemplateSectionPath(templateId, this.plugin.settings.storageDir);
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file && file instanceof import_obsidian12.TFile) {
        const vault = this.app.vault;
        if (typeof vault.trash === "function") {
          await vault.trash(file, true);
        } else {
          await vault.delete(file);
        }
      }
    };
    const removeTemplateFromLayout = (layout, templateId) => layout.map((group) => {
      const children = group.children.flatMap((child) => {
        if (navChildHasItems(child)) {
          const items = child.items.filter(
            (item) => !(item.type === "template" && item.templateId === templateId)
          );
          return [{ ...child, items }];
        }
        if (child.target.type === "template" && child.target.templateId === templateId) {
          return [];
        }
        return [child];
      });
      return { ...group, children };
    });
    const orderEntries = (entries) => {
      const order = Array.isArray(this.plugin.settings.templateOrder) ? this.plugin.settings.templateOrder : [];
      const map = new Map(entries.map((entry) => [entry.id, entry]));
      const ordered = [];
      order.forEach((id) => {
        const entry = map.get(id);
        if (entry) {
          ordered.push(entry);
          map.delete(id);
        }
      });
      map.forEach((entry) => ordered.push(entry));
      return ordered;
    };
    const getEntries = () => getAllTemplates(this.plugin.settings.customTemplates ?? []);
    const renderList = () => {
      list.empty();
      const entries = orderEntries(getEntries());
      if (entries.length === 0) {
        list.createEl("div", { text: "(\u306A\u3057)", cls: "lifeplanner-settings-muted" });
        return;
      }
      entries.forEach((entry) => {
        const isBuiltin = isBuiltinTemplateId(entry.id);
        const sourceLabel = isBuiltin ? "\u6A19\u6E96" : "\u8FFD\u52A0";
        const formatLabel = "viewType" in entry ? entry.formatLabel : TEMPLATE_FORMAT_LABELS[entry.format];
        const setting = new import_obsidian12.Setting(list).setName(entry.label).setDesc(`${sourceLabel} / ${formatLabel}`);
        if (!isBuiltin) {
          setting.addButton((button) => {
            button.setButtonText("\u7DE8\u96C6");
            button.onClick(() => {
              const modal = new TemplateEditModal(this.app, entry, async (updated) => {
                const updatedTemplates = (this.plugin.settings.customTemplates ?? []).map(
                  (custom) => custom.id === entry.id ? updated : custom
                );
                this.plugin.settings.customTemplates = updatedTemplates;
                await this.plugin.saveSettings();
                renderList();
                notifyTemplatesUpdated();
              });
              modal.open();
            });
          });
          setting.addButton((button) => {
            button.setButtonText("\u524A\u9664");
            button.onClick(async () => {
              const modal = new TemplateDeleteModal(this.app, entry, async (deleteFile) => {
                const nextCustom = (this.plugin.settings.customTemplates ?? []).filter(
                  (custom) => custom.id !== entry.id
                );
                const nextEnabled = (this.plugin.settings.enabledTemplates ?? []).filter(
                  (id) => id !== entry.id
                );
                const nextOrder = (this.plugin.settings.templateOrder ?? []).filter(
                  (id) => id !== entry.id
                );
                this.plugin.settings.customTemplates = nextCustom;
                this.plugin.settings.enabledTemplates = nextEnabled;
                this.plugin.settings.templateOrder = nextOrder;
                this.plugin.settings.navLayout = normalizeNavLayout(
                  removeTemplateFromLayout(this.plugin.settings.navLayout, entry.id),
                  { keepEmpty: true }
                );
                await this.plugin.saveSettings();
                if (deleteFile) {
                  await deleteTemplateFile(entry.id);
                }
                renderList();
                notifyTemplatesUpdated();
              });
              modal.open();
            });
          });
        }
      });
    };
    addButton.addEventListener("click", () => {
      const entries = getEntries();
      const existingLabels = new Set(
        entries.map((entry) => entry.label.trim().toLowerCase()).filter((label) => label.length > 0)
      );
      const existingIds = new Set(entries.map((entry) => entry.id));
      const modal = new TemplateAddModal(
        this.app,
        existingLabels,
        existingIds,
        async (entry) => {
          const custom = [...this.plugin.settings.customTemplates ?? [], entry];
          const currentEnabled = this.plugin.settings.enabledTemplates ?? [];
          const enabled = new Set(currentEnabled);
          if (currentEnabled.length > 0) {
            enabled.add(entry.id);
          }
          const order = [...this.plugin.settings.templateOrder ?? []].filter(
            (id) => id !== entry.id
          );
          order.push(entry.id);
          this.plugin.settings.customTemplates = custom;
          this.plugin.settings.enabledTemplates = currentEnabled.length === 0 ? [] : Array.from(enabled);
          this.plugin.settings.templateOrder = order;
          await this.plugin.saveSettings();
          await ensureTemplateFile(entry);
          renderList();
          notifyTemplatesUpdated();
        }
      );
      modal.open();
    });
    renderList();
  }
  renderNavigationSettings(containerEl) {
    const templateSection = containerEl.createEl("div");
    const navSection = containerEl.createEl("div");
    const allViewTypes = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.viewType));
    const templateViewTypes = new Set(
      BUILTIN_TEMPLATES.map((template) => template.viewType)
    );
    const systemViewTypes = allViewTypes.filter((viewType) => !templateViewTypes.has(viewType));
    const orderTemplates = (entries) => {
      const order = Array.isArray(this.plugin.settings.templateOrder) ? this.plugin.settings.templateOrder : [];
      const map = new Map(entries.map((entry) => [entry.id, entry]));
      const ordered = [];
      order.forEach((id) => {
        const entry = map.get(id);
        if (entry) {
          ordered.push(entry);
          map.delete(id);
        }
      });
      map.forEach((entry) => ordered.push(entry));
      return ordered;
    };
    const getTemplateEntries = () => getAllTemplates(this.plugin.settings.customTemplates ?? []);
    const getOrderedTemplates = () => orderTemplates(getTemplateEntries());
    const getTemplateLabels = () => new Map(getTemplateEntries().map((entry) => [entry.id, entry.label]));
    const getExerciseTargets = () => buildExerciseSectionTitles(this.plugin.settings.customExerciseSections ?? []).map(
      (title) => ({ type: "exercise", section: title })
    );
    const exercisesTemplateId = BUILTIN_TEMPLATE_BY_VIEW.get(EXERCISES_VIEW_TYPE) ?? "";
    const exercisesLabel = getNavItemLabel(EXERCISES_VIEW_TYPE) || (exercisesTemplateId ? getTemplateLabels().get(exercisesTemplateId) ?? "\u6F14\u7FD2" : "\u6F14\u7FD2");
    const isExercisesTarget = (target) => target.type === "view" && target.viewType === EXERCISES_VIEW_TYPE || target.type === "template" && target.templateId === exercisesTemplateId;
    const matchesExercisesLabel = (label) => {
      const trimmed = label.trim();
      if (!trimmed) {
        return false;
      }
      if (trimmed === exercisesLabel) {
        return true;
      }
      if (exercisesLabel && trimmed.includes(exercisesLabel)) {
        return true;
      }
      return trimmed.includes("\u6F14\u7FD2");
    };
    const getExercisesFallbackTarget = () => exercisesTemplateId ? { type: "template", templateId: exercisesTemplateId } : { type: "view", viewType: EXERCISES_VIEW_TYPE };
    const moveItem = (items, from, to) => {
      if (from === to) {
        return items;
      }
      const next = [...items];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    };
    const ensureUniqueLabel = (base, existing) => {
      let label = base;
      let index = 2;
      while (existing.has(label)) {
        label = `${base}${index}`;
        index += 1;
      }
      return label;
    };
    const collectTargets = (layout) => layout.flatMap(
      (group) => group.children.flatMap(
        (child) => navChildHasItems(child) ? child.items : [child.target]
      )
    );
    const buildTargetOptions = (existingKeys, includeKey) => {
      const options = {};
      systemViewTypes.forEach((viewType) => {
        const target = { type: "view", viewType };
        const key = navTargetKey(target);
        if (existingKeys.has(key) && key !== includeKey) {
          return;
        }
        options[key] = `\u30D3\u30E5\u30FC: ${getNavItemLabel(viewType)}`;
      });
      getOrderedTemplates().forEach((entry) => {
        const target = { type: "template", templateId: entry.id };
        const key = navTargetKey(target);
        if (existingKeys.has(key) && key !== includeKey) {
          return;
        }
        options[key] = `\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8: ${entry.label}`;
      });
      getExerciseTargets().forEach((target) => {
        const key = navTargetKey(target);
        if (existingKeys.has(key) && key !== includeKey) {
          return;
        }
        options[key] = `\u6F14\u7FD2: ${target.section}`;
      });
      return options;
    };
    const getTargetTypeLabel = (target) => {
      switch (target.type) {
        case "view":
          return "\u30D3\u30E5\u30FC";
        case "template":
          return "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8";
        case "exercise":
          return "\u6F14\u7FD2";
        default:
          return "";
      }
    };
    let renderNav = () => {
    };
    const persistLayout = (layout, options = {}) => {
      this.plugin.settings.navLayout = normalizeNavLayout(layout, { keepEmpty: true });
      void this.plugin.saveSettings();
      if (options.rerender !== false) {
        renderNav();
      }
    };
    renderNav = () => {
      navSection.empty();
      navSection.createEl("h4", { text: "\u30BF\u30D6\u69CB\u6210" });
      navSection.createEl("p", {
        cls: "lifeplanner-settings-hint",
        text: "1\u968E\u5C64\u76EE=\u4E0A\u6BB5\u30012\u968E\u5C64\u76EE=\u4E2D\u6BB5\u30013\u968E\u5C64\u76EE=\u4E0B\u6BB5\u306E\u30BF\u30D6\u3067\u3059\u30023\u968E\u5C64\u76EE\u306F\u30BB\u30AF\u30B7\u30E7\u30F3\u3068\u3057\u3066\u4E26\u3073\u30012\u968E\u5C64\u76EE\u3067\u8FFD\u52A0\u3059\u308B\u3068\u8868\u793A\u3055\u308C\u307E\u3059\u3002"
      });
      const section = navSection.createEl("div");
      const navWrap = section.createEl("div");
      const exerciseTargets = getExerciseTargets();
      const resolveChildGroupLabel = (label, fallback) => {
        const trimmed = label.trim();
        if (trimmed && trimmed !== "\u30E1\u30A4\u30F3") {
          return trimmed;
        }
        return fallback || "2\u968E\u5C64\u76EE";
      };
      const ensureExercisesHaveItems = (layout2) => {
        let changed = false;
        const next = layout2.map((group) => {
          const children = group.children.map((child) => {
            if (navChildHasItems(child)) {
              return child;
            }
            const target = child.target;
            if (!target) {
              return child;
            }
            if (isExercisesTarget(target) || matchesExercisesLabel(child.label)) {
              const label = resolveChildGroupLabel(child.label, exercisesLabel);
              changed = true;
              return { label, items: exerciseTargets };
            }
            return child;
          });
          return { ...group, children };
        });
        return { layout: changed ? next : layout2, changed };
      };
      const normalizedLayout = normalizeNavLayout(this.plugin.settings.navLayout, {
        keepEmpty: true
      });
      const ensured = ensureExercisesHaveItems(normalizedLayout);
      if (ensured.changed) {
        persistLayout(ensured.layout);
        return;
      }
      const layout = normalizedLayout;
      const hidden = new Set(this.plugin.settings.hiddenTabs ?? []);
      const templateLabels = getTemplateLabels();
      const existingKeys = new Set(collectTargets(layout).map((target) => navTargetKey(target)));
      const buildIndexedLabel = (prefix, existing, startIndex = 1) => {
        let index = startIndex;
        while (existing.has(`${prefix}${index}`)) {
          index += 1;
        }
        return `${prefix}${index}`;
      };
      layout.forEach((group, groupIndex) => {
        const groupBlock = navWrap.createEl("div", { cls: "lifeplanner-nav-settings-group" });
        groupBlock.createEl("div", {
          text: "1\u968E\u5C64\u76EE",
          cls: "lifeplanner-nav-settings-label"
        });
        const groupSetting = new import_obsidian12.Setting(groupBlock).setName("1\u968E\u5C64\u76EE");
        groupSetting.addText((input) => {
          input.setValue(group.label);
          input.onChange((value) => {
            const label = value.trim() || group.label;
            layout[groupIndex] = { ...group, label };
            persistLayout(layout, { rerender: false });
          });
          input.inputEl.addEventListener("blur", () => {
            renderNav();
          });
        });
        groupSetting.addButton((button) => {
          button.setButtonText("\u4E0A\u3078");
          button.onClick(() => {
            if (groupIndex === 0) {
              return;
            }
            const next = moveItem(layout, groupIndex, groupIndex - 1);
            persistLayout(next);
          });
        });
        groupSetting.addButton((button) => {
          button.setButtonText("\u4E0B\u3078");
          button.onClick(() => {
            if (groupIndex >= layout.length - 1) {
              return;
            }
            const next = moveItem(layout, groupIndex, groupIndex + 1);
            persistLayout(next);
          });
        });
        groupSetting.addButton((button) => {
          button.setButtonText("\u524A\u9664");
          button.onClick(() => {
            if (layout.length <= 1) {
              return;
            }
            const next = layout.filter((_, index) => index !== groupIndex);
            persistLayout(next);
          });
        });
        const childList = groupBlock.createEl("div", {
          cls: "lifeplanner-nav-settings-children"
        });
        group.children.forEach((child, childIndex) => {
          const childBlock = childList.createEl("div", {
            cls: "lifeplanner-nav-settings-child"
          });
          childBlock.createEl("div", {
            text: "2\u968E\u5C64\u76EE",
            cls: "lifeplanner-nav-settings-label"
          });
          const childSetting = new import_obsidian12.Setting(childBlock).setName("2\u968E\u5C64\u76EE").setDesc(navChildHasItems(child) ? "3\u968E\u5C64\u76EE\u3042\u308A" : "\u5358\u72EC\u30BF\u30D6");
          childSetting.addText((input) => {
            input.setValue(child.label);
            input.onChange((value) => {
              const label = value.trim() || child.label;
              const children = [...group.children];
              children[childIndex] = { ...child, label };
              layout[groupIndex] = { ...group, children };
              persistLayout(layout, { rerender: false });
            });
            input.inputEl.addEventListener("blur", () => {
              renderNav();
            });
          });
          const collapseToTarget = (fallback) => {
            const target = fallback ?? getExercisesFallbackTarget();
            const next = [...layout];
            const children = [...group.children];
            children[childIndex] = { label: child.label, target };
            next[groupIndex] = { ...group, children };
            persistLayout(next);
          };
          if (!navChildHasItems(child)) {
            const isExercisesChild = isExercisesTarget(child.target) || matchesExercisesLabel(child.label);
            childSetting.addButton((button) => {
              button.setButtonText(isExercisesChild ? "3\u968E\u5C64\u76EE\u3092\u30AB\u30B9\u30BF\u30E0\u7DE8\u96C6" : "3\u968E\u5C64\u76EE\u3092\u8FFD\u52A0");
              button.onClick(() => {
                const next = [...layout];
                const children = [...group.children];
                const nextLabel = resolveChildGroupLabel(
                  child.label,
                  getNavTargetLabel(child.target, templateLabels)
                );
                const items = isExercisesTarget(child.target) ? exerciseTargets : [child.target];
                children[childIndex] = { label: nextLabel, items };
                next[groupIndex] = { ...group, children };
                persistLayout(next);
              });
            });
          } else {
            const hasExerciseItems = child.items.some((item) => item.type === "exercise");
            const isExercisesGroup = hasExerciseItems || matchesExercisesLabel(child.label);
            childSetting.addButton((button) => {
              button.setButtonText("3\u968E\u5C64\u76EE\u3092\u89E3\u9664");
              button.onClick(() => {
                const fallback = child.items.find((item) => item.type !== "exercise") ?? child.items[0];
                collapseToTarget(fallback);
              });
            });
          }
          childSetting.addButton((button) => {
            button.setButtonText("\u4E0A\u3078");
            button.onClick(() => {
              if (childIndex === 0) {
                return;
              }
              const next = [...layout];
              const children = moveItem(group.children, childIndex, childIndex - 1);
              next[groupIndex] = { ...group, children };
              persistLayout(next);
            });
          });
          childSetting.addButton((button) => {
            button.setButtonText("\u4E0B\u3078");
            button.onClick(() => {
              if (childIndex >= group.children.length - 1) {
                return;
              }
              const next = [...layout];
              const children = moveItem(group.children, childIndex, childIndex + 1);
              next[groupIndex] = { ...group, children };
              persistLayout(next);
            });
          });
          childSetting.addButton((button) => {
            button.setButtonText("\u524A\u9664");
            button.onClick(() => {
              const next = [...layout];
              const children = group.children.filter((_, idx) => idx !== childIndex);
              next[groupIndex] = { ...group, children };
              persistLayout(next);
            });
          });
          if (navChildHasItems(child)) {
            const itemList = childBlock.createEl("div", {
              cls: "lifeplanner-nav-settings-items"
            });
            child.items.forEach((target, itemIndex) => {
              const itemRow = itemList.createEl("div", {
                cls: "lifeplanner-nav-settings-item"
              });
              itemRow.createEl("div", {
                text: "3\u968E\u5C64\u76EE",
                cls: "lifeplanner-nav-settings-label"
              });
              const itemSetting = new import_obsidian12.Setting(itemRow).setName(getNavTargetLabel(target, templateLabels)).setDesc(getTargetTypeLabel(target));
              if (target.type === "view") {
                const viewType = target.viewType;
                itemSetting.addToggle((toggle) => {
                  toggle.setValue(!hidden.has(viewType));
                  toggle.onChange(async (value) => {
                    const nextHidden = new Set(this.plugin.settings.hiddenTabs ?? []);
                    if (value) {
                      nextHidden.delete(viewType);
                    } else {
                      nextHidden.add(viewType);
                    }
                    this.plugin.settings.hiddenTabs = Array.from(nextHidden);
                    await this.plugin.saveSettings();
                  });
                });
              }
              itemSetting.addButton((button) => {
                button.setButtonText("\u4E0A\u3078");
                button.onClick(() => {
                  if (itemIndex === 0) {
                    return;
                  }
                  const next = [...layout];
                  const children = [...group.children];
                  const items = moveItem(child.items, itemIndex, itemIndex - 1);
                  children[childIndex] = { ...child, items };
                  next[groupIndex] = { ...group, children };
                  persistLayout(next);
                });
              });
              itemSetting.addButton((button) => {
                button.setButtonText("\u4E0B\u3078");
                button.onClick(() => {
                  if (itemIndex >= child.items.length - 1) {
                    return;
                  }
                  const next = [...layout];
                  const children = [...group.children];
                  const items = moveItem(child.items, itemIndex, itemIndex + 1);
                  children[childIndex] = { ...child, items };
                  next[groupIndex] = { ...group, children };
                  persistLayout(next);
                });
              });
              itemSetting.addButton((button) => {
                button.setButtonText("\u524A\u9664");
                button.onClick(() => {
                  const next = [...layout];
                  const children = [...group.children];
                  const items = child.items.filter((_, idx) => idx !== itemIndex);
                  if (items.length === 0) {
                    const fallback = target.type === "exercise" ? getExercisesFallbackTarget() : target;
                    children[childIndex] = { label: child.label, target: fallback };
                  } else {
                    children[childIndex] = { ...child, items };
                  }
                  next[groupIndex] = { ...group, children };
                  persistLayout(next);
                });
              });
            });
            const addItemSetting = new import_obsidian12.Setting(itemList).setName("3\u968E\u5C64\u76EE\u8FFD\u52A0");
            const options = buildTargetOptions(existingKeys);
            if (Object.keys(options).length === 0) {
              addItemSetting.setDesc("\u8FFD\u52A0\u3067\u304D\u308B\u30BF\u30D6\u304C\u3042\u308A\u307E\u305B\u3093");
            } else {
              addItemSetting.addDropdown((dropdown) => {
                dropdown.addOption("", "\u8FFD\u52A0\u3059\u308B\u30BF\u30D6\u3092\u9078\u629E");
                Object.entries(options).forEach(([key, label]) => {
                  dropdown.addOption(key, label);
                });
                dropdown.onChange((value) => {
                  if (!value) {
                    return;
                  }
                  const target = navTargetFromKey(value);
                  if (!target) {
                    return;
                  }
                  const next = [...layout];
                  const children = [...group.children];
                  const items = [...child.items, target];
                  children[childIndex] = { ...child, items };
                  next[groupIndex] = { ...group, children };
                  persistLayout(next);
                });
              });
            }
          } else {
            const targetSetting = new import_obsidian12.Setting(childBlock).setName("2\u968E\u5C64\u76EE\u306E\u5185\u5BB9").setDesc("\u3053\u3053\u306B\u8868\u793A\u3059\u308B\u30BF\u30D6\u3092\u9078\u3073\u307E\u3059\u3002");
            const currentKey = navTargetKey(child.target);
            const options = buildTargetOptions(existingKeys, currentKey);
            targetSetting.addDropdown((dropdown) => {
              dropdown.addOptions(options);
              dropdown.setValue(currentKey);
              dropdown.onChange((value) => {
                const target = navTargetFromKey(value);
                if (!target) {
                  return;
                }
                const prevLabel = child.label;
                const prevTargetLabel = getNavTargetLabel(child.target, templateLabels);
                const nextTargetLabel = getNavTargetLabel(target, templateLabels);
                const nextLabel = prevLabel === prevTargetLabel ? nextTargetLabel : prevLabel;
                const next = [...layout];
                const children = [...group.children];
                children[childIndex] = { ...child, label: nextLabel, target };
                next[groupIndex] = { ...group, children };
                persistLayout(next);
              });
            });
            if (child.target.type === "view") {
              const viewType = child.target.viewType;
              targetSetting.addToggle((toggle) => {
                toggle.setValue(!hidden.has(viewType));
                toggle.onChange(async (value) => {
                  const nextHidden = new Set(this.plugin.settings.hiddenTabs ?? []);
                  if (value) {
                    nextHidden.delete(viewType);
                  } else {
                    nextHidden.add(viewType);
                  }
                  this.plugin.settings.hiddenTabs = Array.from(nextHidden);
                  await this.plugin.saveSettings();
                });
              });
            }
          }
        });
        const addChildSetting = new import_obsidian12.Setting(groupBlock).setName("2\u968E\u5C64\u76EE\uFF08\u5358\u72EC\uFF09\u8FFD\u52A0");
        const childOptions = buildTargetOptions(existingKeys);
        if (Object.keys(childOptions).length === 0) {
          addChildSetting.setDesc("\u8FFD\u52A0\u3067\u304D\u308B\u30BF\u30D6\u304C\u3042\u308A\u307E\u305B\u3093");
        } else {
          addChildSetting.addDropdown((dropdown) => {
            dropdown.addOption("", "\u8FFD\u52A0\u3059\u308B\u30BF\u30D6\u3092\u9078\u629E");
            Object.entries(childOptions).forEach(([key, label]) => {
              dropdown.addOption(key, label);
            });
            dropdown.onChange((value) => {
              if (!value) {
                return;
              }
              const target = navTargetFromKey(value);
              if (!target) {
                return;
              }
              const next = [...layout];
              const children = [...group.children];
              children.push({ label: getNavTargetLabel(target, templateLabels), target });
              next[groupIndex] = { ...group, children };
              persistLayout(next);
            });
          });
        }
        const addChildGroupSetting = new import_obsidian12.Setting(groupBlock).setName(
          "2\u968E\u5C64\u76EE\uFF083\u968E\u5C64\u76EE\u3042\u308A\uFF09\u8FFD\u52A0"
        );
        addChildGroupSetting.addButton((button) => {
          button.setButtonText("\u8FFD\u52A0");
          button.onClick(() => {
            const existing = new Set(group.children.map((child) => child.label));
            const label = buildIndexedLabel("2\u968E\u5C64\u76EE", existing, 1);
            const next = [...layout];
            const children = [...group.children, { label, items: [] }];
            next[groupIndex] = { ...group, children };
            persistLayout(next);
          });
        });
      });
      const addGroupSetting = new import_obsidian12.Setting(navWrap).setName("1\u968E\u5C64\u76EE\u8FFD\u52A0");
      addGroupSetting.addButton((button) => {
        button.setButtonText("\u8FFD\u52A0");
        button.onClick(() => {
          const existing = new Set(layout.map((group) => group.label));
          const label = ensureUniqueLabel("\u65B0\u898F1\u968E\u5C64\u76EE", existing);
          const next = [...layout, { label, children: [] }];
          persistLayout(next);
        });
      });
    };
    this.renderTemplateSettings(templateSection, {
      headingTag: "h4",
      onTemplatesUpdated: renderNav
    });
    renderNav();
  }
};
var TEMPLATE_FORMAT_OPTIONS = [
  {
    value: "free",
    label: TEMPLATE_FORMAT_LABELS.free,
    hint: "\u30DF\u30C3\u30B7\u30E7\u30F3\u306E\u3088\u3046\u306B\u81EA\u7531\u306B\u8A18\u5165\u3059\u308B\u5F62\u5F0F"
  },
  {
    value: "pairs",
    label: TEMPLATE_FORMAT_LABELS.pairs,
    hint: "\u9805\u76EE\u3068\u5185\u5BB9\u3092\u30DA\u30A2\u3067\u8FFD\u52A0\u3059\u308B\u5F62\u5F0F"
  },
  {
    value: "select",
    label: TEMPLATE_FORMAT_LABELS.select,
    hint: "\u9078\u629E\u80A2\u3068\u5185\u5BB9\u3092\u30DA\u30A2\u3067\u8FFD\u52A0\u3059\u308B\u5F62\u5F0F"
  },
  {
    value: "list",
    label: TEMPLATE_FORMAT_LABELS.list,
    hint: "\u7B87\u6761\u66F8\u304D\u3067\u5185\u5BB9\u3092\u8FFD\u52A0\u3059\u308B\u5F62\u5F0F"
  },
  {
    value: "qa",
    label: TEMPLATE_FORMAT_LABELS.qa,
    hint: "\u8CEA\u554F\u3068\u89E3\u7B54\u3092\u30BB\u30C3\u30C8\u3067\u66F8\u304F\u5F62\u5F0F"
  }
];
var TEMPLATE_ID_PREFIX = "tpl";
var parseSelectOptions = (raw) => raw.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
var buildTemplateId = (existingIds) => {
  let id = "";
  while (!id || existingIds.has(id)) {
    const stamp = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    id = `${TEMPLATE_ID_PREFIX}-${stamp}-${rand}`;
  }
  return id;
};
var TemplateAddModal = class extends import_obsidian12.Modal {
  constructor(app, existingLabels, existingIds, onSubmit) {
    super(app);
    this.existingLabels = new Set(existingLabels);
    this.existingIds = new Set(existingIds);
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const content = this.contentEl;
    content.empty();
    content.createEl("h3", { text: "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u3092\u8FFD\u52A0" });
    const form = content.createEl("div", { cls: "lifeplanner-form" });
    const titleField = form.createEl("div", { cls: "lifeplanner-form-field" });
    titleField.createEl("label", { text: "\u30BF\u30A4\u30C8\u30EB" });
    const titleInput = titleField.createEl("input", { type: "text" });
    const formatField = form.createEl("div", { cls: "lifeplanner-form-field" });
    formatField.createEl("label", { text: "\u5F62\u5F0F" });
    const formatSelect = formatField.createEl("select");
    TEMPLATE_FORMAT_OPTIONS.forEach((option) => {
      formatSelect.createEl("option", { text: option.label, value: option.value });
    });
    formatSelect.value = TEMPLATE_FORMAT_OPTIONS[0]?.value ?? "free";
    const hint = formatField.createEl("div", { cls: "lifeplanner-form-hint" });
    const optionsField = form.createEl("div", { cls: "lifeplanner-form-field" });
    optionsField.createEl("label", { text: "\u9078\u629E\u80A2" });
    const optionsInput = optionsField.createEl("textarea");
    optionsInput.rows = 2;
    optionsInput.placeholder = "\u4F8B: A, B, C";
    const updateFormat = () => {
      const selected = TEMPLATE_FORMAT_OPTIONS.find(
        (option) => option.value === formatSelect.value
      );
      hint.setText(selected?.hint ?? "");
      optionsField.classList.toggle("lifeplanner-hidden", formatSelect.value !== "select");
    };
    updateFormat();
    formatSelect.addEventListener("change", updateFormat);
    const error = content.createEl("div", { cls: "lifeplanner-form-error" });
    const actions = content.createEl("div", { cls: "lifeplanner-modal-actions" });
    const cancelButton = actions.createEl("button", { text: "\u30AD\u30E3\u30F3\u30BB\u30EB" });
    cancelButton.setAttr("type", "button");
    const submitButton = actions.createEl("button", { text: "\u8FFD\u52A0" });
    submitButton.setAttr("type", "button");
    const submit = async () => {
      error.setText("");
      const label = titleInput.value.trim();
      if (!label) {
        error.setText("\u30BF\u30A4\u30C8\u30EB\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
        return;
      }
      if (this.existingLabels.has(label.toLowerCase())) {
        error.setText("\u540C\u3058\u30BF\u30A4\u30C8\u30EB\u304C\u65E2\u306B\u3042\u308A\u307E\u3059");
        return;
      }
      const format = formatSelect.value;
      let selectOptions;
      if (format === "select") {
        selectOptions = parseSelectOptions(optionsInput.value);
        if (selectOptions.length === 0) {
          error.setText("\u9078\u629E\u80A2\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
          return;
        }
      }
      const id = buildTemplateId(this.existingIds);
      submitButton.disabled = true;
      cancelButton.disabled = true;
      await this.onSubmit({ id, label, format, selectOptions });
      this.close();
    };
    submitButton.addEventListener("click", () => {
      void submit();
    });
    cancelButton.addEventListener("click", () => {
      this.close();
    });
    titleInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void submit();
      }
    });
    titleInput.focus();
  }
};
var TemplateEditModal = class extends import_obsidian12.Modal {
  constructor(app, entry, onSubmit) {
    super(app);
    this.entry = { ...entry };
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const content = this.contentEl;
    content.empty();
    content.createEl("h3", { text: `\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u7DE8\u96C6: ${this.entry.label}` });
    const form = content.createEl("div", { cls: "lifeplanner-form" });
    const titleField = form.createEl("div", { cls: "lifeplanner-form-field" });
    titleField.createEl("label", { text: "\u30BF\u30A4\u30C8\u30EB" });
    const titleInput = titleField.createEl("input", { type: "text" });
    titleInput.value = this.entry.label;
    const formatField = form.createEl("div", { cls: "lifeplanner-form-field" });
    formatField.createEl("label", { text: "\u5F62\u5F0F" });
    formatField.createEl("div", {
      cls: "lifeplanner-form-hint",
      text: TEMPLATE_FORMAT_LABELS[this.entry.format]
    });
    const optionsField = form.createEl("div", { cls: "lifeplanner-form-field" });
    optionsField.createEl("label", { text: "\u9078\u629E\u80A2" });
    const optionsInput = optionsField.createEl("textarea");
    optionsInput.rows = 2;
    optionsInput.placeholder = "\u4F8B: A, B, C";
    optionsInput.value = (this.entry.selectOptions ?? []).join(", ");
    optionsField.classList.toggle("lifeplanner-hidden", this.entry.format !== "select");
    const error = content.createEl("div", { cls: "lifeplanner-form-error" });
    const actions = content.createEl("div", { cls: "lifeplanner-modal-actions" });
    const cancelButton = actions.createEl("button", { text: "\u30AD\u30E3\u30F3\u30BB\u30EB" });
    cancelButton.setAttr("type", "button");
    const saveButton = actions.createEl("button", { text: "\u4FDD\u5B58" });
    saveButton.setAttr("type", "button");
    const save = async () => {
      error.setText("");
      const label = titleInput.value.trim();
      if (!label) {
        error.setText("\u30BF\u30A4\u30C8\u30EB\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
        return;
      }
      let selectOptions = this.entry.selectOptions;
      if (this.entry.format === "select") {
        selectOptions = parseSelectOptions(optionsInput.value);
        if (selectOptions.length === 0) {
          error.setText("\u9078\u629E\u80A2\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
          return;
        }
      }
      saveButton.disabled = true;
      cancelButton.disabled = true;
      await this.onSubmit({ ...this.entry, label, selectOptions });
      this.close();
    };
    saveButton.addEventListener("click", () => {
      void save();
    });
    cancelButton.addEventListener("click", () => {
      this.close();
    });
    titleInput.focus();
  }
};
var TemplateDeleteModal = class extends import_obsidian12.Modal {
  constructor(app, entry, onSubmit) {
    super(app);
    this.entry = entry;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const content = this.contentEl;
    content.empty();
    content.createEl("h3", { text: `\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u3092\u524A\u9664: ${this.entry.label}` });
    content.createEl("p", {
      cls: "lifeplanner-settings-hint",
      text: "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u306E\u8A2D\u5B9A\u3092\u524A\u9664\u3057\u307E\u3059\u3002\u30D5\u30A1\u30A4\u30EB\u3082\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F"
    });
    const actions = content.createEl("div", { cls: "lifeplanner-modal-actions" });
    const cancelButton = actions.createEl("button", { text: "\u30AD\u30E3\u30F3\u30BB\u30EB" });
    cancelButton.setAttr("type", "button");
    const keepButton = actions.createEl("button", { text: "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u306E\u307F\u524A\u9664" });
    keepButton.setAttr("type", "button");
    const deleteButton = actions.createEl("button", { text: "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u3068\u30D5\u30A1\u30A4\u30EB\u3092\u524A\u9664" });
    deleteButton.setAttr("type", "button");
    cancelButton.addEventListener("click", () => {
      this.close();
    });
    keepButton.addEventListener("click", () => {
      void this.onSubmit(false);
      this.close();
    });
    deleteButton.addEventListener("click", () => {
      void this.onSubmit(true);
      this.close();
    });
  }
};

// src/main.ts
var LifePlannerPlugin = class extends import_obsidian13.Plugin {
  constructor() {
    super(...arguments);
    this.primaryLeaf = null;
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    this.registerView(DASHBOARD_VIEW_TYPE, (leaf) => new DashboardView(leaf, this));
    this.registerView(WEEKLY_PLAN_VIEW_TYPE, (leaf) => new WeeklyPlanView(leaf, this));
    this.registerView(INBOX_VIEW_TYPE, (leaf) => new InboxView(leaf, this));
    this.registerView(GOALS_VIEW_TYPE, (leaf) => new GoalsView(leaf, this));
    this.registerView(GOAL_TASK_VIEW_TYPE, (leaf) => new GoalTaskView(leaf, this));
    this.registerView(EXERCISES_VIEW_TYPE, (leaf) => new ExercisesView(leaf, this));
    this.registerView(TEMPLATE_SECTION_VIEW_TYPE, (leaf) => new TemplateSectionView(leaf, this));
    this.registerView(ISSUES_VIEW_TYPE, (leaf) => new IssuesView(leaf, this));
    this.registerView(
      MISSION_VIEW_TYPE,
      (leaf) => new SimpleSectionView(leaf, this, MISSION_VIEW_TYPE, "Mission", "\u30DF\u30C3\u30B7\u30E7\u30F3")
    );
    this.registerView(
      VALUES_VIEW_TYPE,
      (leaf) => new TableSectionView(leaf, this, VALUES_VIEW_TYPE, "Values", "\u4FA1\u5024\u89B3", [
        { label: "\u4FA1\u5024\u89B3", type: "text", width: "minmax(160px, 1.2fr)" },
        { label: "\u8AAC\u660E\u6587", type: "text", width: "minmax(220px, 2.8fr)", multiline: true }
      ])
    );
    this.registerView(
      HAVE_DO_BE_VIEW_TYPE,
      (leaf) => new TableSectionView(leaf, this, HAVE_DO_BE_VIEW_TYPE, "Have Do Be", "Have / Do / Be", [
        {
          label: "\u7A2E\u5225",
          type: "select",
          options: ["Have", "Do", "Be"],
          width: "minmax(80px, 140px)"
        },
        { label: "\u5185\u5BB9", type: "text", width: "minmax(0, 1fr)", multiline: true }
      ])
    );
    this.registerView(
      PROMISE_VIEW_TYPE,
      (leaf) => new TableSectionView(leaf, this, PROMISE_VIEW_TYPE, "Promise", "\u7D04\u675F", [
        { label: "\u51E6\u7406", type: "checkbox", width: "56px" },
        { label: "\u8AB0\u3068", type: "text", width: "minmax(0, 1fr)" },
        { label: "\u4F55\u3092\uFF1F", type: "text", width: "minmax(0, 2fr)", multiline: true }
      ])
    );
    this.addSettingTab(new LifePlannerSettingTab(this.app, this));
    this.addRibbonIcon("calendar", "LifePlanner", () => {
      void this.openView(DASHBOARD_VIEW_TYPE);
    });
  }
  onunload() {
    this.app.workspace.detachLeavesOfType(DASHBOARD_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(WEEKLY_PLAN_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(INBOX_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(GOALS_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(GOAL_TASK_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(EXERCISES_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(TEMPLATE_SECTION_VIEW_TYPE);
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
  getTemplateLabelMap() {
    const entries = getAllTemplates(this.settings.customTemplates ?? []);
    return new Map(entries.map((entry) => [entry.id, entry.label]));
  }
  async navigateToTarget(target, leaf) {
    const targetLeaf = leaf ?? this.primaryLeaf ?? this.app.workspace.getLeaf(false);
    this.primaryLeaf = targetLeaf;
    if (target.type === "view") {
      await this.openViewInLeaf(target.viewType, targetLeaf);
      return;
    }
    if (target.type === "exercise") {
      await this.openExerciseSection(target.section, targetLeaf);
      return;
    }
    if (target.type === "template") {
      await this.openTemplateTarget(target.templateId, targetLeaf);
    }
  }
  async openExerciseSection(section, leaf) {
    await this.openViewInLeaf(EXERCISES_VIEW_TYPE, leaf);
    const view = leaf.view;
    if (view instanceof ExercisesView) {
      view.setActiveSection(section);
      return;
    }
    window.setTimeout(() => {
      const nextView = leaf.view;
      if (nextView instanceof ExercisesView) {
        nextView.setActiveSection(section);
      }
    }, 0);
  }
  async openTemplateTarget(templateId, leaf) {
    const entry = getAllTemplates(this.settings.customTemplates ?? []).find(
      (template) => template.id === templateId
    );
    if (!entry) {
      new import_obsidian13.Notice("\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
      return;
    }
    if ("viewType" in entry) {
      await this.openViewInLeaf(entry.viewType, leaf);
      return;
    }
    this.primaryLeaf = leaf;
    await leaf.setViewState({
      type: TEMPLATE_SECTION_VIEW_TYPE,
      active: true,
      state: { templateId }
    });
  }
  async loadSettings() {
    const data = await this.loadData();
    const merged = Object.assign({}, DEFAULT_SETTINGS, data);
    if (typeof data?.showMonthlyCalendar === "boolean" && typeof data?.showDashboardCalendar !== "boolean") {
      merged.showDashboardCalendar = data.showMonthlyCalendar;
    }
    if (!Array.isArray(data?.dashboardSections)) {
      merged.dashboardSections = [...DEFAULT_SETTINGS.dashboardSections];
    } else {
      const allowed = new Set(DASHBOARD_SECTION_TYPES);
      const filtered = data.dashboardSections.filter((viewType) => allowed.has(viewType));
      const hasCustom = filtered.length > 0 || data.dashboardSections.length === 0;
      merged.dashboardSections = hasCustom ? filtered : [...DEFAULT_SETTINGS.dashboardSections];
    }
    if (!Array.isArray(data?.customTemplates)) {
      merged.customTemplates = [];
    } else {
      const allowedFormats = /* @__PURE__ */ new Set(["free", "pairs", "select", "list", "qa"]);
      const builtinIds = new Set(DEFAULT_TEMPLATE_IDS);
      const seenIds = /* @__PURE__ */ new Set();
      const normalized = [];
      data.customTemplates.forEach((entry) => {
        if (!entry || typeof entry !== "object") {
          return;
        }
        const raw = entry;
        const id = typeof raw.id === "string" ? raw.id.trim() : "";
        const label = typeof raw.label === "string" ? raw.label.trim() : "";
        const format = typeof raw.format === "string" ? raw.format : "";
        if (!id || !label) {
          return;
        }
        if (builtinIds.has(id) || seenIds.has(id)) {
          return;
        }
        if (!allowedFormats.has(format)) {
          return;
        }
        let selectOptions;
        if (format === "select") {
          selectOptions = Array.isArray(raw.selectOptions) ? raw.selectOptions.map((option) => typeof option === "string" ? option.trim() : "").filter((option) => option.length > 0) : [];
          if (selectOptions.length === 0) {
            return;
          }
        }
        seenIds.add(id);
        normalized.push({ id, label, format, selectOptions });
      });
      merged.customTemplates = normalized;
    }
    const templateIds = /* @__PURE__ */ new Set([
      ...DEFAULT_TEMPLATE_IDS,
      ...(merged.customTemplates ?? []).map((entry) => entry.id)
    ]);
    if (!Array.isArray(data?.enabledTemplates)) {
      merged.enabledTemplates = Array.from(templateIds);
    } else {
      merged.enabledTemplates = data.enabledTemplates.filter(
        (id) => typeof id === "string" && templateIds.has(id)
      );
    }
    const defaultTemplateOrder = [
      ...DEFAULT_TEMPLATE_IDS,
      ...(merged.customTemplates ?? []).map((entry) => entry.id)
    ];
    if (!Array.isArray(data?.templateOrder)) {
      merged.templateOrder = defaultTemplateOrder;
    } else {
      const filtered = data.templateOrder.filter(
        (id) => typeof id === "string" && templateIds.has(id)
      );
      const missing = defaultTemplateOrder.filter((id) => !filtered.includes(id));
      merged.templateOrder = [...filtered, ...missing];
    }
    merged.navLayout = normalizeNavLayout(data?.navLayout, { keepEmpty: true });
    this.settings = merged;
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
//# sourceMappingURL=main.js.map
