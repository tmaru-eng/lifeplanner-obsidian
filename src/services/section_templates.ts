import type { LifePlannerViewType } from "../ui/view_types";
import {
  EXERCISES_VIEW_TYPE,
  HAVE_DO_BE_VIEW_TYPE,
  MISSION_VIEW_TYPE,
  PROMISE_VIEW_TYPE,
  VALUES_VIEW_TYPE,
} from "../ui/view_types";

export type TemplateFormat = "free" | "pairs" | "select" | "list" | "qa";

export type CustomTemplateDefinition = {
  id: string;
  label: string;
  format: TemplateFormat;
  selectOptions?: string[];
};

export type BuiltinTemplateDefinition = {
  id: string;
  label: string;
  viewType: LifePlannerViewType;
  formatLabel: string;
};

export const BUILTIN_TEMPLATES: BuiltinTemplateDefinition[] = [
  {
    id: "promise",
    label: "約束",
    viewType: PROMISE_VIEW_TYPE,
    formatLabel: "表(チェック)",
  },
  {
    id: "mission",
    label: "ミッション",
    viewType: MISSION_VIEW_TYPE,
    formatLabel: "フリー記入",
  },
  {
    id: "values",
    label: "価値観",
    viewType: VALUES_VIEW_TYPE,
    formatLabel: "項目/内容",
  },
  {
    id: "have-do-be",
    label: "Have/Do/Be",
    viewType: HAVE_DO_BE_VIEW_TYPE,
    formatLabel: "選択/内容",
  },
  {
    id: "exercises",
    label: "演習",
    viewType: EXERCISES_VIEW_TYPE,
    formatLabel: "演習集",
  },
];

export const DEFAULT_TEMPLATE_IDS = BUILTIN_TEMPLATES.map((template) => template.id);

export const BUILTIN_TEMPLATE_BY_ID = new Map(
  BUILTIN_TEMPLATES.map((template) => [template.id, template] as const)
);

export const BUILTIN_TEMPLATE_BY_VIEW = new Map(
  BUILTIN_TEMPLATES.map((template) => [template.viewType, template.id] as const)
);

export const TEMPLATE_FORMAT_LABELS: Record<TemplateFormat, string> = {
  free: "フリー記入",
  pairs: "項目/内容",
  select: "選択/内容",
  list: "リスト",
  qa: "質問/解答",
};

export function getAllTemplates(
  customTemplates: CustomTemplateDefinition[] = []
): Array<BuiltinTemplateDefinition | CustomTemplateDefinition> {
  return [...BUILTIN_TEMPLATES, ...customTemplates];
}

export function isBuiltinTemplateId(id: string): boolean {
  return BUILTIN_TEMPLATE_BY_ID.has(id);
}

export function getTemplateLabel(id: string, customTemplates: CustomTemplateDefinition[]): string {
  const builtin = BUILTIN_TEMPLATE_BY_ID.get(id);
  if (builtin) {
    return builtin.label;
  }
  return customTemplates.find((template) => template.id === id)?.label ?? id;
}
