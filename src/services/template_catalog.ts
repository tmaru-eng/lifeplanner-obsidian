export type TemplateCategory = "Plans" | "Goals" | "Exercises" | "Logs";

export type TemplateEntry = {
  category: TemplateCategory;
  label: string;
  filename: string;
  folder: string;
  filenameKind:
    | "weekly"
    | "daily"
    | "monthly"
    | "annual"
    | "quarterly"
    | "five-year"
    | "dated";
};

export const TEMPLATE_CATALOG: TemplateEntry[] = [
  {
    category: "Plans",
    label: "Weekly Plan (Vertical)",
    filename: "LifePlanner - Weekly Plan (Vertical).md",
    folder: "Plans",
    filenameKind: "weekly",
  },
  {
    category: "Plans",
    label: "Daily Plan",
    filename: "LifePlanner - Daily Plan.md",
    folder: "Plans",
    filenameKind: "daily",
  },
  {
    category: "Plans",
    label: "Monthly Plan",
    filename: "LifePlanner - Monthly Plan.md",
    folder: "Plans",
    filenameKind: "monthly",
  },
  {
    category: "Logs",
    label: "Inbox",
    filename: "LifePlanner - Inbox.md",
    folder: "Logs",
    filenameKind: "dated",
  },
  {
    category: "Goals",
    label: "Goal Setup",
    filename: "LifePlanner - Goal Setup.md",
    folder: "Goals",
    filenameKind: "dated",
  },
  {
    category: "Goals",
    label: "Quarterly Goals",
    filename: "LifePlanner - Quarterly Goals.md",
    folder: "Goals",
    filenameKind: "quarterly",
  },
  {
    category: "Goals",
    label: "Annual Goals",
    filename: "LifePlanner - Annual Goals.md",
    folder: "Goals",
    filenameKind: "annual",
  },
  {
    category: "Goals",
    label: "Five-Year Plan",
    filename: "LifePlanner - Five-Year Plan.md",
    folder: "Goals",
    filenameKind: "five-year",
  },
  {
    category: "Exercises",
    label: "Self Analysis",
    filename: "LifePlanner - Self Analysis.md",
    folder: "Exercises",
    filenameKind: "dated",
  },
  {
    category: "Exercises",
    label: "Bucket List",
    filename: "LifePlanner - Bucket List.md",
    folder: "Exercises",
    filenameKind: "dated",
  },
  {
    category: "Exercises",
    label: "Reading Log",
    filename: "LifePlanner - Reading Log.md",
    folder: "Exercises",
    filenameKind: "dated",
  },
  {
    category: "Exercises",
    label: "Motto",
    filename: "LifePlanner - Motto.md",
    folder: "Exercises",
    filenameKind: "dated",
  },
  {
    category: "Exercises",
    label: "Promise List",
    filename: "LifePlanner - Promise List.md",
    folder: "Exercises",
    filenameKind: "dated",
  },
];
