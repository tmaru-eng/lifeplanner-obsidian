export type GoalLevel =
  | "人生"
  | "長期"
  | "中期"
  | "年間"
  | "四半期"
  | "月間"
  | "週間";

export type GoalStatus = "active" | "paused" | "completed";

export interface Goal {
  id: string;
  title: string;
  level: GoalLevel;
  description?: string;
  order?: number;
  dueDate?: string;
  expanded?: boolean;
  timeframe?: {
    start?: string;
    end?: string;
  };
  parentGoalId?: string;
  status: GoalStatus;
}
