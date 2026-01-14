import { Plugin } from "obsidian";
import { ExercisesView, EXERCISES_VIEW_TYPE } from "./ui/exercises_view";
import { GoalTaskView, GOAL_TASK_VIEW_TYPE } from "./ui/goal_task_view";
import { GoalsView, GOALS_VIEW_TYPE } from "./ui/goals_view";
import { InboxView, INBOX_VIEW_TYPE } from "./ui/inbox_view";
import { IssuesView, ISSUES_VIEW_TYPE } from "./ui/issues_view";
import { SimpleSectionView } from "./ui/simple_section_view";
import { TableSectionView } from "./ui/table_section_view";
import { WeeklyPlanView, WEEKLY_PLAN_VIEW_TYPE } from "./ui/weekly_plan_view";
import { DEFAULT_SETTINGS, LifePlannerSettingTab, LifePlannerSettings } from "./settings";
import {
  HAVE_DO_BE_VIEW_TYPE,
  MISSION_VIEW_TYPE,
  PROMISE_VIEW_TYPE,
  VALUES_VIEW_TYPE,
} from "./ui/view_types";

export default class LifePlannerPlugin extends Plugin {
  private primaryLeaf = null as import("obsidian").WorkspaceLeaf | null;
  settings: LifePlannerSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(WEEKLY_PLAN_VIEW_TYPE, (leaf) => new WeeklyPlanView(leaf, this));
    this.registerView(INBOX_VIEW_TYPE, (leaf) => new InboxView(leaf, this));
    this.registerView(GOALS_VIEW_TYPE, (leaf) => new GoalsView(leaf, this));
    this.registerView(GOAL_TASK_VIEW_TYPE, (leaf) => new GoalTaskView(leaf, this));
    this.registerView(EXERCISES_VIEW_TYPE, (leaf) => new ExercisesView(leaf, this));
    this.registerView(ISSUES_VIEW_TYPE, (leaf) => new IssuesView(leaf, this));
    this.registerView(
      MISSION_VIEW_TYPE,
      (leaf) => new SimpleSectionView(leaf, this, MISSION_VIEW_TYPE, "Mission", "ミッション")
    );
    this.registerView(
      VALUES_VIEW_TYPE,
      (leaf) =>
        new TableSectionView(leaf, this, VALUES_VIEW_TYPE, "Values", "価値観", [
          { label: "価値観", type: "text", width: "140px" },
          { label: "説明文", type: "text", width: "minmax(260px, 1fr)" },
        ])
    );
    this.registerView(
      HAVE_DO_BE_VIEW_TYPE,
      (leaf) =>
        new TableSectionView(leaf, this, HAVE_DO_BE_VIEW_TYPE, "Have Do Be", "Have / Do / Be", [
          { label: "種別", type: "select", options: ["Have", "Do", "Be"], width: "120px" },
          { label: "何？", type: "text", width: "minmax(260px, 1fr)" },
        ])
    );
    this.registerView(
      PROMISE_VIEW_TYPE,
      (leaf) =>
        new TableSectionView(leaf, this, PROMISE_VIEW_TYPE, "Promise", "約束", [
          { label: "処理", type: "checkbox", width: "56px" },
          { label: "誰と", type: "text", width: "140px" },
          { label: "何を？", type: "text", width: "minmax(260px, 1fr)" },
        ])
    );

    this.addSettingTab(new LifePlannerSettingTab(this.app, this));
    this.addRibbonIcon("calendar", "LifePlanner", () => {
      void this.openView(WEEKLY_PLAN_VIEW_TYPE);
    });
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(WEEKLY_PLAN_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(INBOX_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(GOALS_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(GOAL_TASK_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(EXERCISES_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(ISSUES_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(MISSION_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(VALUES_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(HAVE_DO_BE_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(PROMISE_VIEW_TYPE);
  }

  async openView(viewType: string): Promise<void> {
    if (this.primaryLeaf && !this.primaryLeaf.containerEl.isConnected) {
      this.primaryLeaf = null;
    }
    const leaf = this.primaryLeaf ?? this.app.workspace.getLeaf(false);
    this.primaryLeaf = leaf;
    await leaf.setViewState({ type: viewType, active: true });
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
  }

  async openViewInLeaf(viewType: string, leaf: import("obsidian").WorkspaceLeaf): Promise<void> {
    this.primaryLeaf = leaf;
    await leaf.setViewState({ type: viewType, active: true });
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
