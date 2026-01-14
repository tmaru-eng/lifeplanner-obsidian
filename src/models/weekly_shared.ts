import { RoutineAction } from "./weekly_plan";

export interface WeeklyShared {
  routineActions: RoutineAction[];
  roles: string[];
  monthThemes: Record<string, string>;
}
