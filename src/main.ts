import { Notice, Plugin } from "obsidian";
import { DashboardView } from "./ui/dashboard_view";
import { ExercisesView, EXERCISES_VIEW_TYPE } from "./ui/exercises_view";
import { GoalTaskView, GOAL_TASK_VIEW_TYPE } from "./ui/goal_task_view";
import { GoalsView, GOALS_VIEW_TYPE } from "./ui/goals_view";
import { InboxView, INBOX_VIEW_TYPE } from "./ui/inbox_view";
import { IssuesView, ISSUES_VIEW_TYPE } from "./ui/issues_view";
import { SimpleSectionView } from "./ui/simple_section_view";
import { TableSectionView } from "./ui/table_section_view";
import { TemplateSectionView, TEMPLATE_SECTION_VIEW_TYPE } from "./ui/template_section_view";
import { WeeklyPlanView, WEEKLY_PLAN_VIEW_TYPE } from "./ui/weekly_plan_view";
import {
  DASHBOARD_SECTION_TYPES,
  DEFAULT_SETTINGS,
  LifePlannerSettingTab,
  LifePlannerSettings,
} from "./settings";
import {
  HAVE_DO_BE_VIEW_TYPE,
  DASHBOARD_VIEW_TYPE,
  MISSION_VIEW_TYPE,
  PROMISE_VIEW_TYPE,
  VALUES_VIEW_TYPE,
} from "./ui/view_types";
import { NavTarget, normalizeNavLayout } from "./ui/navigation";
import {
  DEFAULT_TEMPLATE_IDS,
  CustomTemplateDefinition,
  TemplateFormat,
  getAllTemplates,
} from "./services/section_templates";

export default class LifePlannerPlugin extends Plugin {
  private primaryLeaf = null as import("obsidian").WorkspaceLeaf | null;
  settings: LifePlannerSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(DASHBOARD_VIEW_TYPE, (leaf) => new DashboardView(leaf, this));
    this.registerView(WEEKLY_PLAN_VIEW_TYPE, (leaf) => new WeeklyPlanView(leaf, this));
    this.registerView(INBOX_VIEW_TYPE, (leaf) => new InboxView(leaf, this));
    this.registerView(GOALS_VIEW_TYPE, (leaf) => new GoalsView(leaf, this));
    this.registerView(GOAL_TASK_VIEW_TYPE, (leaf) => new GoalTaskView(leaf, this));
    this.registerView(EXERCISES_VIEW_TYPE, (leaf) => new ExercisesView(leaf, this));
    this.registerView(TEMPLATE_SECTION_VIEW_TYPE, (leaf) => new TemplateSectionView(leaf, this));
    this.registerView(ISSUES_VIEW_TYPE, (leaf) => new IssuesView(leaf, this));
    this.registerView(
      MISSION_VIEW_TYPE,
      (leaf) => new SimpleSectionView(leaf, this, MISSION_VIEW_TYPE, "Mission", "ミッション")
    );
    this.registerView(
      VALUES_VIEW_TYPE,
      (leaf) =>
        new TableSectionView(leaf, this, VALUES_VIEW_TYPE, "Values", "価値観", [
          { label: "価値観", type: "text", width: "minmax(160px, 1.2fr)" },
          { label: "説明文", type: "text", width: "minmax(220px, 2.8fr)", multiline: true },
        ])
    );
    this.registerView(
      HAVE_DO_BE_VIEW_TYPE,
      (leaf) =>
        new TableSectionView(leaf, this, HAVE_DO_BE_VIEW_TYPE, "Have Do Be", "Have / Do / Be", [
          {
            label: "種別",
            type: "select",
            options: ["Have", "Do", "Be"],
            width: "minmax(80px, 140px)",
          },
          { label: "内容", type: "text", width: "minmax(0, 1fr)", multiline: true },
        ])
    );
    this.registerView(
      PROMISE_VIEW_TYPE,
      (leaf) =>
        new TableSectionView(leaf, this, PROMISE_VIEW_TYPE, "Promise", "約束", [
          { label: "処理", type: "checkbox", width: "56px" },
          { label: "誰と", type: "text", width: "minmax(0, 1fr)" },
          { label: "何を？", type: "text", width: "minmax(0, 2fr)", multiline: true },
        ])
    );

    this.addSettingTab(new LifePlannerSettingTab(this.app, this));
    this.addRibbonIcon("calendar", "LifePlanner", () => {
      void this.openView(DASHBOARD_VIEW_TYPE);
    });
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(DASHBOARD_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(WEEKLY_PLAN_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(INBOX_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(GOALS_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(GOAL_TASK_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(EXERCISES_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(TEMPLATE_SECTION_VIEW_TYPE);
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

  getTemplateLabelMap(): Map<string, string> {
    const entries = getAllTemplates(this.settings.customTemplates ?? []);
    return new Map(entries.map((entry) => [entry.id, entry.label]));
  }

  async navigateToTarget(
    target: NavTarget,
    leaf?: import("obsidian").WorkspaceLeaf
  ): Promise<void> {
    const targetLeaf = leaf ?? this.primaryLeaf ?? this.app.workspace.getLeaf(false);
    this.primaryLeaf = targetLeaf;
    if (target.type === "view") {
      await this.openViewInLeaf(target.viewType, targetLeaf);
      return;
    }
    if (target.type === "exercise") {
      await this.openExerciseSection(target.section, targetLeaf);
      return;
    }
    if (target.type === "template") {
      await this.openTemplateTarget(target.templateId, targetLeaf);
    }
  }

  private async openExerciseSection(
    section: string,
    leaf: import("obsidian").WorkspaceLeaf
  ): Promise<void> {
    await this.openViewInLeaf(EXERCISES_VIEW_TYPE, leaf);
    const view = leaf.view;
    if (view instanceof ExercisesView) {
      view.setActiveSection(section);
      return;
    }
    window.setTimeout(() => {
      const nextView = leaf.view;
      if (nextView instanceof ExercisesView) {
        nextView.setActiveSection(section);
      }
    }, 0);
  }

  private async openTemplateTarget(
    templateId: string,
    leaf: import("obsidian").WorkspaceLeaf
  ): Promise<void> {
    const entry = getAllTemplates(this.settings.customTemplates ?? []).find(
      (template) => template.id === templateId
    );
    if (!entry) {
      new Notice("テンプレートが見つかりません");
      return;
    }
    if ("viewType" in entry) {
      await this.openViewInLeaf(entry.viewType, leaf);
      return;
    }
    this.primaryLeaf = leaf;
    await leaf.setViewState({
      type: TEMPLATE_SECTION_VIEW_TYPE,
      active: true,
      state: { templateId },
    });
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as Partial<LifePlannerSettings> & {
      showMonthlyCalendar?: boolean;
    };
    const merged = Object.assign({}, DEFAULT_SETTINGS, data);
    if (
      typeof data?.showMonthlyCalendar === "boolean" &&
      typeof data?.showDashboardCalendar !== "boolean"
    ) {
      merged.showDashboardCalendar = data.showMonthlyCalendar;
    }
    if (!Array.isArray(data?.dashboardSections)) {
      merged.dashboardSections = [...DEFAULT_SETTINGS.dashboardSections];
    } else {
      const allowed = new Set(DASHBOARD_SECTION_TYPES);
      const filtered = data.dashboardSections.filter((viewType) => allowed.has(viewType));
      const hasCustom = filtered.length > 0 || data.dashboardSections.length === 0;
      merged.dashboardSections = hasCustom
        ? filtered
        : [...DEFAULT_SETTINGS.dashboardSections];
    }
    if (!Array.isArray(data?.customTemplates)) {
      merged.customTemplates = [];
    } else {
      const allowedFormats = new Set<TemplateFormat>(["free", "pairs", "select", "list", "qa"]);
      const builtinIds = new Set(DEFAULT_TEMPLATE_IDS);
      const seenIds = new Set<string>();
      const normalized: CustomTemplateDefinition[] = [];
      data.customTemplates.forEach((entry) => {
        if (!entry || typeof entry !== "object") {
          return;
        }
        const raw = entry as Partial<CustomTemplateDefinition>;
        const id = typeof raw.id === "string" ? raw.id.trim() : "";
        const label = typeof raw.label === "string" ? raw.label.trim() : "";
        const format = typeof raw.format === "string" ? raw.format : "";
        if (!id || !label) {
          return;
        }
        if (builtinIds.has(id) || seenIds.has(id)) {
          return;
        }
        if (!allowedFormats.has(format as TemplateFormat)) {
          return;
        }
        let selectOptions: string[] | undefined;
        if (format === "select") {
          selectOptions = Array.isArray(raw.selectOptions)
            ? raw.selectOptions
                .map((option) => (typeof option === "string" ? option.trim() : ""))
                .filter((option) => option.length > 0)
            : [];
          if (selectOptions.length === 0) {
            return;
          }
        }
        seenIds.add(id);
        normalized.push({ id, label, format: format as TemplateFormat, selectOptions });
      });
      merged.customTemplates = normalized;
    }
    const templateIds = new Set([
      ...DEFAULT_TEMPLATE_IDS,
      ...(merged.customTemplates ?? []).map((entry) => entry.id),
    ]);
    if (!Array.isArray(data?.enabledTemplates)) {
      merged.enabledTemplates = Array.from(templateIds);
    } else {
      merged.enabledTemplates = data.enabledTemplates.filter(
        (id): id is string => typeof id === "string" && templateIds.has(id)
      );
    }
    const defaultTemplateOrder = [
      ...DEFAULT_TEMPLATE_IDS,
      ...(merged.customTemplates ?? []).map((entry) => entry.id),
    ];
    if (!Array.isArray(data?.templateOrder)) {
      merged.templateOrder = defaultTemplateOrder;
    } else {
      const filtered = data.templateOrder.filter(
        (id): id is string => typeof id === "string" && templateIds.has(id)
      );
      const missing = defaultTemplateOrder.filter((id) => !filtered.includes(id));
      merged.templateOrder = [...filtered, ...missing];
    }
    merged.navLayout = normalizeNavLayout(data?.navLayout, { keepEmpty: true });
    this.settings = merged;
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
