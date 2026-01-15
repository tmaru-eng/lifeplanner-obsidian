import { Task } from "../models/task";
import { MarkdownRepository } from "./markdown_repository";
import { prependTagFrontmatter } from "./markdown_tags";
import { resolveLifePlannerPath } from "../storage/path_resolver";

export class TasksService {
  private repository: MarkdownRepository;
  private baseDir: string;
  private defaultTags: string[];

  constructor(repository: MarkdownRepository, baseDir: string, defaultTags: string[]) {
    this.repository = repository;
    this.baseDir = baseDir;
    this.defaultTags = defaultTags;
  }

  async listTasks(): Promise<Task[]> {
    const content = await this.repository.read(resolveLifePlannerPath("Tasks", this.baseDir));
    if (!content) {
      return [];
    }
    return parseTasks(content);
  }

  async addTask(goalTitle: string, title: string): Promise<Task> {
    const tasks = await this.listTasks();
    const task: Task = {
      id: `${goalTitle}-${Date.now()}`,
      title,
      goalId: goalTitle,
      status: "todo",
    };
    tasks.push(task);
    await this.saveTasks(tasks);
    return task;
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    const content = serializeTasks(tasks, this.defaultTags);
    await this.repository.write(resolveLifePlannerPath("Tasks", this.baseDir), content);
  }
}

function parseTasks(content: string): Task[] {
  const tasks: Task[] = [];
  const lines = content.split("\n");
  let inTaskSection = false;
  for (const line of lines) {
    if (line.startsWith("## タスク")) {
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
        status,
      });
    }
  }
  return tasks;
}

function serializeTasks(tasks: Task[], defaultTags: string[] = []): string {
  const lines: string[] = [];
  lines.push("# 目標からタスク切り出し");
  lines.push("");
  lines.push("## 目標");
  lines.push("- ");
  lines.push("");
  lines.push("## タスク");
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
