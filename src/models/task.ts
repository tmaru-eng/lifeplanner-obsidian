export type TaskStatus = "todo" | "doing" | "done";

export interface Task {
  id: string;
  title: string;
  goalId: string;
  status: TaskStatus;
  weeklySlot?: string;
  notes?: string;
}
