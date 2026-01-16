import { Issue } from "../models/issue";
import { MarkdownRepository } from "./markdown_repository";
import { prependTagFrontmatter } from "./markdown_tags";
import { resolveLifePlannerPath } from "../storage/path_resolver";

export class IssuesService {
  private repository: MarkdownRepository;
  private baseDir: string;
  private defaultTags: string[];

  constructor(repository: MarkdownRepository, baseDir: string, defaultTags: string[]) {
    this.repository = repository;
    this.baseDir = baseDir;
    this.defaultTags = defaultTags;
  }

  async listIssues(): Promise<Issue[]> {
    const path = resolveLifePlannerPath("Issues", this.baseDir);
    const content = await this.repository.read(path);
    if (!content) {
      await this.repository.write(path, serializeIssues([], this.defaultTags));
      return [];
    }
    return parseIssues(content);
  }

  async saveIssues(issues: Issue[]): Promise<void> {
    const content = serializeIssues(issues, this.defaultTags);
    await this.repository.write(resolveLifePlannerPath("Issues", this.baseDir), content);
  }
}

function serializeIssues(issues: Issue[], defaultTags: string[] = []): string {
  const lines: string[] = [];
  lines.push("# Issues");
  lines.push("");
  const grouped = new Map<string, Issue[]>();
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

function parseIssues(content: string): Issue[] {
  const issues: Issue[] = [];
  const lines = content.split("\n");
  let currentStatus = "";
  let current: Issue | null = null;
  let bodyLines: string[] = [];

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
        body: "",
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
      current.linkedGoalId = goal || undefined;
      continue;
    }
    if (line.startsWith("Tags:")) {
      const raw = line.replace("Tags:", "").trim();
      current.tags = raw ? raw.split(",").map((tag) => tag.trim()).filter(Boolean) : undefined;
      continue;
    }
    if (line.startsWith("Due:")) {
      const due = line.replace("Due:", "").trim();
      current.dueDate = due || undefined;
      continue;
    }
    if (line.startsWith("Priority:")) {
      const priority = line.replace("Priority:", "").trim();
      current.priority = (priority as Issue["priority"]) || undefined;
      continue;
    }
    bodyLines.push(line);
  }
  flush();
  return issues;
}
