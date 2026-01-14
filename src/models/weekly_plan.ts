export interface WeeklyPlanSlot {
  day: string;
  entries: string[];
  dateLabel?: string;
}

export interface RoutineAction {
  title: string;
  checks: Record<string, boolean>;
}

export interface RoleGoals {
  role: string;
  goals: string[];
}

export interface ActionPlanItem {
  title: string;
  done: boolean;
}

export interface WeeklyPlan {
  id: string;
  weekStart: string;
  weekEnd: string;
  weeklyGoals: string[];
  weekLabel: string;
  monthTheme: string;
  routineActions: RoutineAction[];
  roles: RoleGoals[];
  actionPlans: ActionPlanItem[];
  reflectionGood: string[];
  reflectionIssues: string[];
  dailyMemos: Record<string, string[]>;
  slots: WeeklyPlanSlot[];
  reviewNotes?: string;
}
