import { Task } from "../models/task";
import { RoleGoals, RoutineAction, WeeklyPlan, WeeklyPlanSlot } from "../models/weekly_plan";
import { prependTagFrontmatter } from "./markdown_tags";

const DAYS = ["月", "火", "水", "木", "金", "土", "日"];
const ROUTINE_DAYS = ["月", "火", "水", "木", "金", "土"];

export function serializeWeeklyPlan(plan: WeeklyPlan, defaultTags: string[] = []): string {
  const lines: string[] = [];
  lines.push("# 週間計画");
  lines.push("");
  lines.push(`週表示: ${plan.weekLabel ?? ""}`);
  lines.push("");
  lines.push("## 今月のテーマ");
  lines.push("");
  lines.push(plan.monthTheme ? `- ${plan.monthTheme}` : "- ");
  lines.push("");
  lines.push("## ルーティン行動");
  lines.push("");
  lines.push(`| 行動 | ${ROUTINE_DAYS.join(" | ")} |`);
  lines.push(`| --- | ${ROUTINE_DAYS.map(() => "---").join(" | ")} |`);
  if (plan.routineActions.length === 0) {
    lines.push(`|  | ${ROUTINE_DAYS.map(() => "[ ]").join(" | ")} |`);
  } else {
    for (const action of plan.routineActions) {
      const checks = ROUTINE_DAYS.map((day) => (action.checks[day] ? "[x]" : "[ ]"));
      lines.push(`| ${action.title} | ${checks.join(" | ")} |`);
    }
  }
  lines.push("");
  lines.push("## 役割と重点タスク");
  lines.push("");
  if (plan.roles.length === 0) {
    lines.push("### 役割1");
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
  lines.push("## アクションプラン");
  lines.push("");
  if (plan.actionPlans.length === 0) {
    lines.push("- [ ] ");
  } else {
    for (const item of plan.actionPlans) {
      const checked = item.done ? "[x]" : "[ ]";
      lines.push(`- ${checked} ${item.title}`);
    }
  }
  lines.push("## 今週の振り返り");
  lines.push("");
  lines.push("### 良かったこと");
  if (plan.reflectionGood.length === 0) {
    lines.push("- ");
  } else {
    for (const item of plan.reflectionGood) {
      lines.push(`- ${item}`);
    }
  }
  lines.push("");
  lines.push("### 課題");
  if (plan.reflectionIssues.length === 0) {
    lines.push("- ");
  } else {
    for (const item of plan.reflectionIssues) {
      lines.push(`- ${item}`);
    }
  }
  lines.push("");
  lines.push("## 日付ごとの一言メモ欄");
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

export function parseWeeklyPlan(content: string): WeeklyPlan {
  const slots: WeeklyPlanSlot[] = DAYS.map((day) => ({ day, entries: [] }));
  const dailyMemos: Record<string, string[]> = {
    月: [],
    火: [],
    水: [],
    木: [],
    金: [],
    土: [],
    日: [],
  };
  const routineActions: RoutineAction[] = [];
  const roles: RoleGoals[] = [];
  const reflectionGood: string[] = [];
  const reflectionIssues: string[] = [];
  const actionPlans: { title: string; done: boolean }[] = [];
  let monthTheme = "";
  let weekLabel = "";

  let section = "";
  let currentDay: string | null = null;
  let currentRole: RoleGoals | null = null;

  const lines = content.split("\n");
  for (const line of lines) {
    if (line.startsWith("## ")) {
      section = line.replace(/^##\s+/, "");
      currentDay = null;
      currentRole = null;
      continue;
    }
    if (line.startsWith("週表示:")) {
      weekLabel = line.replace("週表示:", "").trim();
      continue;
    }
    if (section === "今月のテーマ") {
      const match = line.match(/^\-\s*(.+)$/);
      if (match && match[1].trim()) {
        monthTheme = match[1].trim();
      }
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
    if (section === "アクションプラン") {
      const itemMatch = line.match(/^\-\s*\[( |x)\]\s*(.+)$/);
      if (itemMatch && itemMatch[2].trim()) {
        actionPlans.push({ title: itemMatch[2].trim(), done: itemMatch[1] === "x" });
      }
      continue;
    }
    if (section === "今週の振り返り") {
      if (line.startsWith("### 良かったこと")) {
        currentDay = "good";
        continue;
      }
      if (line.startsWith("### 課題")) {
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
    if (section === "日付ごとの一言メモ欄") {
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
    slots,
  };
}

export function tasksToWeeklyEntries(tasks: Task[]): string[] {
  return tasks.map((task) => task.title);
}
