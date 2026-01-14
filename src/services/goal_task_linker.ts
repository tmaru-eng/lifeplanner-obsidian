import { Goal } from "../models/goal";
import { Task } from "../models/task";

export function linkTaskToGoal(goal: Goal, task: Task): Task {
  return {
    ...task,
    goalId: goal.id,
  };
}

export function tasksForGoal(tasks: Task[], goalId: string): Task[] {
  return tasks.filter((task) => task.goalId === goalId);
}
