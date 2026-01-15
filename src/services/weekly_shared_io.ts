import { RoutineAction } from "../models/weekly_plan";
import { WeeklyShared } from "../models/weekly_shared";
import { prependTagFrontmatter } from "./markdown_tags";

const ROUTINE_DAYS = ["月", "火", "水", "木", "金", "土"];

export function serializeWeeklyShared(shared: WeeklyShared, defaultTags: string[] = []): string {
  const lines: string[] = [];
  lines.push("# 週間共有");
  lines.push("");
  lines.push("## ルーティン行動");
  lines.push("");
  lines.push(`| 行動 | ${ROUTINE_DAYS.join(" | ")} |`);
  lines.push(`| --- | ${ROUTINE_DAYS.map(() => "---").join(" | ")} |`);
  if (shared.routineActions.length === 0) {
    lines.push(`|  | ${ROUTINE_DAYS.map(() => "[ ]").join(" | ")} |`);
  } else {
    for (const action of shared.routineActions) {
      const checks = ROUTINE_DAYS.map((day) => (action.checks[day] ? "[x]" : "[ ]"));
      lines.push(`| ${action.title} | ${checks.join(" | ")} |`);
    }
  }
  lines.push("");
  lines.push("## 役割と重点タスク");
  lines.push("");
  if (shared.roles.length === 0) {
    lines.push("### 役割1");
    lines.push("");
  } else {
    for (const role of shared.roles) {
      lines.push(`### ${role}`);
      lines.push("");
    }
  }
  lines.push("## 月間テーマ");
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

export function parseWeeklyShared(content: string): WeeklyShared {
  const routineActions: RoutineAction[] = [];
  const roles: string[] = [];
  const monthThemes: Record<string, string> = {};
  let section = "";
  let currentRole: string | null = null;

  const lines = content.split("\n");
  for (const line of lines) {
    if (line.startsWith("## ")) {
      section = line.replace(/^##\s+/, "");
      currentRole = null;
      continue;
    }
    if (section === "ルーティン行動") {
      if (line.startsWith("|")) {
        const cells = line.split("|").map((cell) => cell.trim());
        if (cells.length >= 3 && cells[1] !== "行動" && cells[1] !== "---") {
          const title = cells[1] || "";
          if (title) {
            const checks: Record<string, boolean> = {};
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
    if (section === "役割と重点タスク") {
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
    if (section === "月間テーマ") {
      const themeMatch = line.match(/^\-\s*([0-9]{4}\-[0-9]{2})\s*:\s*(.+)$/);
      if (themeMatch) {
        monthThemes[themeMatch[1]] = themeMatch[2].trim();
      }
    }
  }

  return { routineActions, roles, monthThemes };
}
