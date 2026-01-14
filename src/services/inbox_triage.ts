import { InboxItem } from "../models/inbox_item";
import { WeeklyPlan } from "../models/weekly_plan";
import { GoalsService } from "./goals_service";
import { MarkdownRepository } from "./markdown_repository";
import { TasksService } from "./tasks_service";
import { parseWeeklyPlan, serializeWeeklyPlan } from "./weekly_plan_io";
import { resolveWeeklyPlanPath } from "../storage/path_resolver";

export class InboxTriage {
  private goalsService: GoalsService;
  private tasksService: TasksService;
  private repository: MarkdownRepository;
  private baseDir: string;
  private weekStart: "monday" | "sunday";

  constructor(repository: MarkdownRepository, baseDir: string, weekStart: "monday" | "sunday") {
    this.repository = repository;
    this.baseDir = baseDir;
    this.weekStart = weekStart;
    this.goalsService = new GoalsService(repository, baseDir);
    this.tasksService = new TasksService(repository, baseDir);
  }

  async toGoal(item: InboxItem): Promise<void> {
    await this.goalsService.addGoal("週間", item.content);
  }

  async toTask(item: InboxItem): Promise<void> {
    await this.tasksService.addTask("週間", item.content);
  }

  async toWeekly(item: InboxItem): Promise<void> {
    const weekStart = computeWeekStart(new Date(), 0, this.weekStart);
    const path = resolveWeeklyPlanPath(weekStart, this.baseDir);
    const content = await this.repository.read(path);
    const plan = content ? parseWeeklyPlan(content) : emptyPlan();
    plan.actionPlans.push({ title: item.content, done: false });
    await this.repository.write(path, serializeWeeklyPlan(plan));
  }
}

function emptyPlan(): WeeklyPlan {
  return {
    id: "weekly",
    weekStart: "",
    weekEnd: "",
    slots: [
      { day: "月", entries: [] },
      { day: "火", entries: [] },
      { day: "水", entries: [] },
      { day: "木", entries: [] },
      { day: "金", entries: [] },
      { day: "土", entries: [] },
      { day: "日", entries: [] },
    ],
    weeklyGoals: [],
    weekLabel: "",
    monthTheme: "",
    routineActions: [],
    roles: [],
    actionPlans: [],
    reflectionGood: [],
    reflectionIssues: [],
    dailyMemos: { 月: [], 火: [], 水: [], 木: [], 金: [], 土: [], 日: [] },
    reviewNotes: "",
  };
}

function computeWeekStart(today: Date, offset: number, weekStart: "monday" | "sunday"): Date {
  const base = new Date(today);
  base.setDate(base.getDate() + offset * 7);
  const day = base.getDay();
  const startIndex = weekStart === "sunday" ? 0 : 1;
  const diff = (day - startIndex + 7) % 7;
  const start = new Date(base);
  start.setDate(base.getDate() - diff);
  return start;
}
