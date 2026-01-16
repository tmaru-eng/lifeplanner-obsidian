export const TEMPLATE_PREFIX = "LifePlanner";

export type LifePlannerType =
  | "Weekly"
  | "Weekly Shared"
  | "Issues"
  | "Mission"
  | "Values"
  | "Have Do Be"
  | "Promise"
  | "Quotes"
  | "Goals"
  | "Tasks"
  | "Inbox"
  | "Exercises";

export function resolveLifePlannerPath(type: LifePlannerType, baseDir = "LifePlanner"): string {
  const dir = normalizeBaseDir(baseDir);
  const filename = `${TEMPLATE_PREFIX} - ${type}.md`;
  return dir ? `${dir}/${filename}` : filename;
}

type WeeklyPlanPathOptions = {
  forceMonday?: boolean;
};

export function resolveWeeklyPlanPath(
  weekStart: Date,
  baseDir = "LifePlanner",
  options: WeeklyPlanPathOptions = {}
): string {
  const dir = normalizeBaseDir(baseDir);
  const forceMonday = options.forceMonday !== false;
  const normalized = forceMonday ? normalizeWeeklyPlanDate(weekStart) : new Date(weekStart);
  const formatted = formatDate(normalized);
  const filename = `${TEMPLATE_PREFIX} - Weekly - ${formatted}.md`;
  return dir ? `${dir}/${filename}` : filename;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeWeeklyPlanDate(date: Date): Date {
  const normalized = new Date(date);
  const day = normalized.getDay();
  if (day === 0) {
    normalized.setDate(normalized.getDate() + 1);
  } else if (day !== 1) {
    normalized.setDate(normalized.getDate() - (day - 1));
  }
  return normalized;
}

function normalizeBaseDir(value: string): string {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
  return trimmed;
}
