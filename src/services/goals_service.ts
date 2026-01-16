import { Goal, GoalLevel } from "../models/goal";
import { MarkdownRepository } from "./markdown_repository";
import { prependTagFrontmatter } from "./markdown_tags";
import { resolveLifePlannerPath } from "../storage/path_resolver";

const LEVEL_ORDER: GoalLevel[] = [
  "人生",
  "長期",
  "中期",
  "年間",
  "四半期",
  "月間",
  "週間",
];

export class GoalsService {
  private repository: MarkdownRepository;
  private baseDir: string;
  private defaultTags: string[];

  constructor(repository: MarkdownRepository, baseDir: string, defaultTags: string[]) {
    this.repository = repository;
    this.baseDir = baseDir;
    this.defaultTags = defaultTags;
  }

  async listGoals(): Promise<Goal[]> {
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

  async addGoal(
    level: GoalLevel,
    title: string,
    description?: string,
    parentGoalId?: string,
    dueDate?: string
  ): Promise<Goal> {
    const goals = await this.listGoals();
    const siblingOrders = goals
      .filter((goal) => goal.level === level && goal.parentGoalId === parentGoalId)
      .map((goal) => goal.order ?? 0);
    const nextOrder = siblingOrders.length > 0 ? Math.max(...siblingOrders) + 1 : 1;
    const existingIds = new Set(goals.map((goal) => goal.id));
    let id = `goal-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    while (existingIds.has(id)) {
      id = `goal-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
    const goal: Goal = {
      id,
      title,
      level,
      status: "active",
      description,
      parentGoalId,
      order: nextOrder,
      dueDate,
    };
    goals.push(goal);
    await this.saveGoals(goals);
    return goal;
  }

  async updateGoal(id: string, update: Partial<Goal>): Promise<void> {
    const goals = await this.listGoals();
    const updated = goals.map((goal) => {
      if (goal.id !== id) {
        return goal;
      }
      return { ...goal, ...update, id: goal.id };
    });
    await this.saveGoals(updated);
  }

  async deleteGoal(id: string): Promise<void> {
    const goals = await this.listGoals();
    const remaining = goals.filter((goal) => goal.id !== id);
    const cleaned = remaining.map((goal) => {
      if (goal.parentGoalId === id) {
        return { ...goal, parentGoalId: undefined };
      }
      return goal;
    });
    await this.saveGoals(cleaned);
  }

  async saveGoals(goals: Goal[]): Promise<void> {
    const content = serializeGoals(goals, this.defaultTags);
    await this.repository.write(resolveLifePlannerPath("Goals", this.baseDir), content);
  }
}

function parseGoals(content: string): Goal[] {
  const goals: Goal[] = [];
  const parentRefs = new Map<string, string>();
  let currentLevel: GoalLevel | null = null;
  let currentGoal: Goal | null = null;
  const lines = content.split("\n");
  for (const line of lines) {
    const levelMatch = line.match(/^##\s+(.+)$/);
    if (levelMatch) {
      const raw = levelMatch[1].trim();
      const normalized = raw.endsWith("目標") ? raw.replace(/目標$/, "") : raw;
      if (LEVEL_ORDER.includes(normalized as GoalLevel)) {
        currentLevel = normalized as GoalLevel;
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
      const id = `goal-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      currentGoal = {
        id,
        title,
        level: currentLevel,
        status: "active",
        description: "",
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
        status: "active",
      });
      continue;
    }
    if (currentGoal && line.startsWith("親:")) {
      const rawParent = line.replace("親:", "").trim();
      if (rawParent) {
        parentRefs.set(currentGoal.id, rawParent);
      }
      continue;
    }
    if (currentGoal && line.startsWith("期限:")) {
      currentGoal.dueDate = line.replace("期限:", "").trim() || undefined;
      continue;
    }
    if (currentGoal && line.startsWith("展開:")) {
      const raw = line.replace("展開:", "").trim().toLowerCase();
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
    if (currentGoal && line.startsWith("順序:")) {
      const raw = line.replace("順序:", "").trim();
      const parsed = Number.parseInt(raw, 10);
      currentGoal.order = Number.isFinite(parsed) ? parsed : undefined;
      continue;
    }
    if (currentGoal && line.trim().length > 0) {
      currentGoal.description = currentGoal.description
        ? `${currentGoal.description}\n${line.trim()}`
        : line.trim();
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

function serializeGoals(goals: Goal[], defaultTags: string[] = []): string {
  const lines: string[] = [];
  lines.push("# 目標ゴール");
  lines.push("");
  for (const level of LEVEL_ORDER) {
    lines.push(`## ${level}目標`);
    const levelGoals = goals.filter((goal) => goal.level === level);
    if (levelGoals.length === 0) {
      lines.push("");
    } else {
      const sorted = [...levelGoals].sort((a, b) => {
        const aParent = a.parentGoalId ?? "";
        const bParent = b.parentGoalId ?? "";
        const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
        return (
          aParent.localeCompare(bParent) ||
          aOrder - bOrder ||
          a.title.localeCompare(b.title)
        );
      });
      for (const goal of sorted) {
        lines.push(`### ${goal.title}`);
        lines.push(`ID: ${goal.id}`);
        if (goal.parentGoalId) {
          lines.push(`親: ${goal.parentGoalId}`);
        }
        if (goal.dueDate) {
          lines.push(`期限: ${goal.dueDate}`);
        }
        if (goal.expanded !== undefined) {
          lines.push(`展開: ${goal.expanded ? "true" : "false"}`);
        }
        if (goal.order !== undefined) {
          lines.push(`順序: ${goal.order}`);
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
