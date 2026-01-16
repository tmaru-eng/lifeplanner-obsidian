export type IssuePriority = "Low" | "Medium" | "High";

export interface Issue {
  id: string;
  title: string;
  status: string;
  body: string;
  linkedGoalId?: string;
  tags?: string[];
  dueDate?: string;
  priority?: IssuePriority;
}
