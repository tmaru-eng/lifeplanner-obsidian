import { App, Modal, PluginSettingTab, Setting, TFile } from "obsidian";
import type LifePlannerPlugin from "./main";
import {
  NAV_GROUPS,
  NavLayout,
  NavTarget,
  buildDefaultNavLayout,
  getNavItemLabel,
  getNavTargetLabel,
  navChildHasItems,
  navTargetFromKey,
  navTargetKey,
  normalizeNavLayout,
} from "./ui/navigation";
import type { LifePlannerViewType } from "./ui/view_types";
import {
  DASHBOARD_VIEW_TYPE,
  EXERCISES_VIEW_TYPE,
  INBOX_VIEW_TYPE,
  WEEKLY_PLAN_VIEW_TYPE,
} from "./ui/view_types";
import {
  BUILTIN_TEMPLATES,
  BUILTIN_TEMPLATE_BY_VIEW,
  BuiltinTemplateDefinition,
  CustomTemplateDefinition,
  DEFAULT_TEMPLATE_IDS,
  TemplateFormat,
  TEMPLATE_FORMAT_LABELS,
  getAllTemplates,
  isBuiltinTemplateId,
} from "./services/section_templates";
import { MarkdownRepository } from "./services/markdown_repository";
import { TemplateSectionService } from "./services/template_section_service";
import { buildExerciseSectionTitles } from "./services/exercise_sections";
import { resolveTemplateSectionPath } from "./storage/path_resolver";

export type WeekStart = "monday" | "sunday";

export interface LifePlannerSettings {
  weekStart: WeekStart;
  storageDir: string;
  kanbanColumns: string[];
  actionPlanMinLevel: string;
  defaultTags: string[];
  customExerciseSections: CustomExerciseSection[];
  enabledTemplates: string[];
  templateOrder: string[];
  customTemplates: CustomTemplateDefinition[];
  hiddenTabs: LifePlannerViewType[];
  navLayout: NavLayout;
  dashboardSections: LifePlannerViewType[];
  showDashboardCalendar: boolean;
}

export type CustomExerciseKind = "pairs" | "qa" | "list";

export type CustomExerciseSection = {
  title: string;
  kind: CustomExerciseKind;
};

type SettingsHeadingTag = "h3" | "h4";

export const DASHBOARD_SECTION_TYPES: LifePlannerViewType[] = NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => item.viewType)
).filter((viewType) => viewType !== DASHBOARD_VIEW_TYPE);

const DEFAULT_DASHBOARD_SECTIONS: LifePlannerViewType[] = [
  INBOX_VIEW_TYPE,
  WEEKLY_PLAN_VIEW_TYPE,
];

export const DEFAULT_SETTINGS: LifePlannerSettings = {
  weekStart: "monday",
  storageDir: "LifePlanner",
  kanbanColumns: ["Backlog", "Todo", "Doing", "Done"],
  actionPlanMinLevel: "月間",
  defaultTags: ["lifeplanner"],
  customExerciseSections: [],
  enabledTemplates: [...DEFAULT_TEMPLATE_IDS],
  templateOrder: [...DEFAULT_TEMPLATE_IDS],
  customTemplates: [],
  hiddenTabs: [],
  navLayout: buildDefaultNavLayout(),
  dashboardSections: DEFAULT_DASHBOARD_SECTIONS,
  showDashboardCalendar: true,
};

export class LifePlannerSettingTab extends PluginSettingTab {
  private plugin: LifePlannerPlugin;

  constructor(app: App, plugin: LifePlannerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h3", { text: "基本設定" });

    new Setting(containerEl)
      .setName("週の開始曜日")
      .setDesc("週間ファイルの日付計算に使用する開始曜日です。")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("monday", "月曜始まり")
          .addOption("sunday", "日曜始まり")
          .setValue(this.plugin.settings.weekStart)
          .onChange(async (value) => {
            this.plugin.settings.weekStart = value as WeekStart;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("保存フォルダ")
      .setDesc("LifePlannerのファイルを保存するフォルダパスです。")
      .addText((input) => {
        input.setPlaceholder("LifePlanner");
        input.setValue(this.plugin.settings.storageDir);
        input.onChange(async (value) => {
          this.plugin.settings.storageDir = value.trim() || "LifePlanner";
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("イシューのカラム")
      .setDesc("カンマ区切りでカラム名を設定します。")
      .addTextArea((input) => {
        input.setValue(this.plugin.settings.kanbanColumns.join(", "));
        input.onChange(async (value) => {
          const columns = value
            .split(",")
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
          this.plugin.settings.kanbanColumns = columns.length > 0 ? columns : ["Backlog"];
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("デフォルトタグ")
      .setDesc("LifePlannerで作成/更新するMarkdownに付与します（カンマ区切り）。")
      .addText((input) => {
        input.setPlaceholder("lifeplanner");
        input.setValue(this.plugin.settings.defaultTags.join(", "));
        input.onChange(async (value) => {
          const tags = value
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0);
          this.plugin.settings.defaultTags = tags;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("アクションプランの最小階層")
      .setDesc("この階層以下の目標を候補に表示します。")
      .addDropdown((dropdown) => {
        ["人生", "長期", "中期", "年間", "四半期", "月間", "週間"].forEach((level) => {
          dropdown.addOption(level, level);
        });
        dropdown.setValue(this.plugin.settings.actionPlanMinLevel);
        dropdown.onChange(async (value) => {
          this.plugin.settings.actionPlanMinLevel = value;
          await this.plugin.saveSettings();
        });
      });

    containerEl.createEl("h3", { text: "ダッシュボード" });
    new Setting(containerEl)
      .setName("ミニカレンダー表示")
      .setDesc("ダッシュボードに月間カレンダーを表示します。")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.showDashboardCalendar);
        toggle.onChange(async (value) => {
          this.plugin.settings.showDashboardCalendar = value;
          await this.plugin.saveSettings();
        });
      });

    containerEl.createEl("h3", { text: "タブ/テンプレート設定" });
    containerEl.createEl("p", {
      cls: "lifeplanner-settings-hint",
      text: "テンプレートの追加・編集はここで、タブの表示/並び替えは下のタブ構成で設定します。テンプレートはタブに割り当てると入力画面が開きます。",
    });
    this.renderNavigationSettings(containerEl);
  }

  private renderTemplateSettings(
    containerEl: HTMLElement,
    options: {
      headingTag?: SettingsHeadingTag;
      includeHint?: boolean;
      onTemplatesUpdated?: () => void;
    } = {}
  ): void {
    const headingTag = options.headingTag ?? "h3";
    containerEl.createEl(headingTag, { text: "テンプレート" });
    if (options.includeHint !== false) {
      containerEl.createEl("p", {
        cls: "lifeplanner-settings-hint",
        text: "テンプレートは5つの形式から作成できます。新規追加・編集・削除ができます。",
      });
    }
    const section = containerEl.createEl("div");
    const actions = section.createEl("div");
    const addButton = actions.createEl("button", { text: "テンプレートを追加" });
    addButton.setAttr("type", "button");
    const list = section.createEl("div", { cls: "lifeplanner-settings-block" });
    const notifyTemplatesUpdated = (): void => {
      options.onTemplatesUpdated?.();
    };
    const ensureTemplateFile = async (entry: CustomTemplateDefinition): Promise<void> => {
      const service = new TemplateSectionService(
        new MarkdownRepository(this.app),
        entry.id,
        entry.label,
        this.plugin.settings.storageDir,
        this.plugin.settings.defaultTags,
        {
          selectOptions: entry.format === "select" ? entry.selectOptions : undefined,
        }
      );
      await service.load();
    };
    const deleteTemplateFile = async (templateId: string): Promise<void> => {
      const path = resolveTemplateSectionPath(templateId, this.plugin.settings.storageDir);
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file && file instanceof TFile) {
        const vault = this.app.vault as {
          trash?: (target: TFile, useSystem?: boolean) => Promise<void>;
          delete: (target: TFile) => Promise<void>;
        };
        if (typeof vault.trash === "function") {
          await vault.trash(file, true);
        } else {
          await vault.delete(file);
        }
      }
    };
    const removeTemplateFromLayout = (layout: NavLayout, templateId: string): NavLayout =>
      layout.map((group) => {
        const children = group.children.flatMap((child) => {
          if (navChildHasItems(child)) {
            const items = child.items.filter(
              (item) => !(item.type === "template" && item.templateId === templateId)
            );
            return [{ ...child, items }];
          }
          if (child.target.type === "template" && child.target.templateId === templateId) {
            return [];
          }
          return [child];
        });
        return { ...group, children };
      });

    const orderEntries = (
      entries: Array<BuiltinTemplateDefinition | CustomTemplateDefinition>
    ): Array<BuiltinTemplateDefinition | CustomTemplateDefinition> => {
      const order = Array.isArray(this.plugin.settings.templateOrder)
        ? this.plugin.settings.templateOrder
        : [];
      const map = new Map(entries.map((entry) => [entry.id, entry]));
      const ordered: Array<BuiltinTemplateDefinition | CustomTemplateDefinition> = [];
      order.forEach((id) => {
        const entry = map.get(id);
        if (entry) {
          ordered.push(entry);
          map.delete(id);
        }
      });
      map.forEach((entry) => ordered.push(entry));
      return ordered;
    };

    const getEntries = (): Array<BuiltinTemplateDefinition | CustomTemplateDefinition> =>
      getAllTemplates(this.plugin.settings.customTemplates ?? []);

    const renderList = (): void => {
      list.empty();
      const entries = orderEntries(getEntries());
      if (entries.length === 0) {
        list.createEl("div", { text: "(なし)", cls: "lifeplanner-settings-muted" });
        return;
      }

      entries.forEach((entry) => {
        const isBuiltin = isBuiltinTemplateId(entry.id);
        const sourceLabel = isBuiltin ? "標準" : "追加";
        const formatLabel =
          "viewType" in entry ? entry.formatLabel : TEMPLATE_FORMAT_LABELS[entry.format];
        const setting = new Setting(list)
          .setName(entry.label)
          .setDesc(`${sourceLabel} / ${formatLabel}`);
        if (!isBuiltin) {
          setting.addButton((button) => {
            button.setButtonText("編集");
            button.onClick(() => {
              const modal = new TemplateEditModal(this.app, entry, async (updated) => {
                const updatedTemplates = (this.plugin.settings.customTemplates ?? []).map(
                  (custom) => (custom.id === entry.id ? updated : custom)
                );
                this.plugin.settings.customTemplates = updatedTemplates;
                await this.plugin.saveSettings();
                renderList();
                notifyTemplatesUpdated();
              });
              modal.open();
            });
          });
          setting.addButton((button) => {
            button.setButtonText("削除");
            button.onClick(async () => {
              const modal = new TemplateDeleteModal(this.app, entry, async (deleteFile) => {
                const nextCustom = (this.plugin.settings.customTemplates ?? []).filter(
                  (custom) => custom.id !== entry.id
                );
                const nextEnabled = (this.plugin.settings.enabledTemplates ?? []).filter(
                  (id) => id !== entry.id
                );
                const nextOrder = (this.plugin.settings.templateOrder ?? []).filter(
                  (id) => id !== entry.id
                );
                this.plugin.settings.customTemplates = nextCustom;
                this.plugin.settings.enabledTemplates = nextEnabled;
                this.plugin.settings.templateOrder = nextOrder;
                this.plugin.settings.navLayout = normalizeNavLayout(
                  removeTemplateFromLayout(this.plugin.settings.navLayout, entry.id),
                  { keepEmpty: true }
                );
                await this.plugin.saveSettings();
                if (deleteFile) {
                  await deleteTemplateFile(entry.id);
                }
                renderList();
                notifyTemplatesUpdated();
              });
              modal.open();
            });
          });
        }
      });
    };

    addButton.addEventListener("click", () => {
      const entries = getEntries();
      const existingLabels = new Set(
        entries
          .map((entry) => entry.label.trim().toLowerCase())
          .filter((label) => label.length > 0)
      );
      const existingIds = new Set(entries.map((entry) => entry.id));
      const modal = new TemplateAddModal(
        this.app,
        existingLabels,
        existingIds,
        async (entry: CustomTemplateDefinition) => {
          const custom = [...(this.plugin.settings.customTemplates ?? []), entry];
          const currentEnabled = this.plugin.settings.enabledTemplates ?? [];
          const enabled = new Set(currentEnabled);
          if (currentEnabled.length > 0) {
            enabled.add(entry.id);
          }
          const order = [...(this.plugin.settings.templateOrder ?? [])].filter(
            (id) => id !== entry.id
          );
          order.push(entry.id);
          this.plugin.settings.customTemplates = custom;
          this.plugin.settings.enabledTemplates =
            currentEnabled.length === 0 ? [] : Array.from(enabled);
          this.plugin.settings.templateOrder = order;
          await this.plugin.saveSettings();
          await ensureTemplateFile(entry);
          renderList();
          notifyTemplatesUpdated();
        }
      );
      modal.open();
    });

    renderList();
  }

  private renderNavigationSettings(containerEl: HTMLElement): void {
    const templateSection = containerEl.createEl("div");
    const navSection = containerEl.createEl("div");
    const allViewTypes = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.viewType));
    const templateViewTypes = new Set(
      BUILTIN_TEMPLATES.map((template) => template.viewType)
    );
    const systemViewTypes = allViewTypes.filter((viewType) => !templateViewTypes.has(viewType));

    const orderTemplates = (
      entries: Array<BuiltinTemplateDefinition | CustomTemplateDefinition>
    ): Array<BuiltinTemplateDefinition | CustomTemplateDefinition> => {
      const order = Array.isArray(this.plugin.settings.templateOrder)
        ? this.plugin.settings.templateOrder
        : [];
      const map = new Map(entries.map((entry) => [entry.id, entry]));
      const ordered: Array<BuiltinTemplateDefinition | CustomTemplateDefinition> = [];
      order.forEach((id) => {
        const entry = map.get(id);
        if (entry) {
          ordered.push(entry);
          map.delete(id);
        }
      });
      map.forEach((entry) => ordered.push(entry));
      return ordered;
    };

    const getTemplateEntries = (): Array<BuiltinTemplateDefinition | CustomTemplateDefinition> =>
      getAllTemplates(this.plugin.settings.customTemplates ?? []);

    const getOrderedTemplates = (): Array<BuiltinTemplateDefinition | CustomTemplateDefinition> =>
      orderTemplates(getTemplateEntries());

    const getTemplateLabels = (): Map<string, string> =>
      new Map(getTemplateEntries().map((entry) => [entry.id, entry.label] as const));

    const getExerciseTargets = (): NavTarget[] =>
      buildExerciseSectionTitles(this.plugin.settings.customExerciseSections ?? []).map(
        (title) => ({ type: "exercise", section: title })
      );
    const exercisesTemplateId = BUILTIN_TEMPLATE_BY_VIEW.get(EXERCISES_VIEW_TYPE) ?? "";
    const exercisesLabel =
      getNavItemLabel(EXERCISES_VIEW_TYPE) ||
      (exercisesTemplateId ? getTemplateLabels().get(exercisesTemplateId) ?? "演習" : "演習");
    const isExercisesTarget = (target: NavTarget): boolean =>
      (target.type === "view" && target.viewType === EXERCISES_VIEW_TYPE) ||
      (target.type === "template" && target.templateId === exercisesTemplateId);
    const matchesExercisesLabel = (label: string): boolean => {
      const trimmed = label.trim();
      if (!trimmed) {
        return false;
      }
      if (trimmed === exercisesLabel) {
        return true;
      }
      if (exercisesLabel && trimmed.includes(exercisesLabel)) {
        return true;
      }
      return trimmed.includes("演習");
    };
    const getExercisesFallbackTarget = (): NavTarget =>
      exercisesTemplateId
        ? { type: "template", templateId: exercisesTemplateId }
        : { type: "view", viewType: EXERCISES_VIEW_TYPE };

    const moveItem = <T,>(items: T[], from: number, to: number): T[] => {
      if (from === to) {
        return items;
      }
      const next = [...items];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    };

    const ensureUniqueLabel = (base: string, existing: Set<string>): string => {
      let label = base;
      let index = 2;
      while (existing.has(label)) {
        label = `${base}${index}`;
        index += 1;
      }
      return label;
    };

    const collectTargets = (layout: NavLayout): NavTarget[] =>
      layout.flatMap((group) =>
        group.children.flatMap((child) =>
          navChildHasItems(child) ? child.items : [child.target]
        )
      );


    const buildTargetOptions = (
      existingKeys: Set<string>,
      includeKey?: string
    ): Record<string, string> => {
      const options: Record<string, string> = {};
      systemViewTypes.forEach((viewType) => {
        const target: NavTarget = { type: "view", viewType };
        const key = navTargetKey(target);
        if (existingKeys.has(key) && key !== includeKey) {
          return;
        }
        options[key] = `ビュー: ${getNavItemLabel(viewType)}`;
      });

      getOrderedTemplates().forEach((entry) => {
        const target: NavTarget = { type: "template", templateId: entry.id };
        const key = navTargetKey(target);
        if (existingKeys.has(key) && key !== includeKey) {
          return;
        }
        options[key] = `テンプレート: ${entry.label}`;
      });
      getExerciseTargets().forEach((target) => {
        const key = navTargetKey(target);
        if (existingKeys.has(key) && key !== includeKey) {
          return;
        }
        options[key] = `演習: ${target.section}`;
      });
      return options;
    };

    const getTargetTypeLabel = (target: NavTarget): string => {
      switch (target.type) {
        case "view":
          return "ビュー";
        case "template":
          return "テンプレート";
        case "exercise":
          return "演習";
        default:
          return "";
      }
    };

    let renderNav = (): void => {};

    const persistLayout = (
      layout: NavLayout,
      options: { rerender?: boolean } = {}
    ): void => {
      this.plugin.settings.navLayout = normalizeNavLayout(layout, { keepEmpty: true });
      void this.plugin.saveSettings();
      if (options.rerender !== false) {
        renderNav();
      }
    };

    renderNav = (): void => {
      navSection.empty();
      navSection.createEl("h4", { text: "タブ構成" });
      navSection.createEl("p", {
        cls: "lifeplanner-settings-hint",
        text:
          "1階層目=上段、2階層目=中段、3階層目=下段のタブです。3階層目はセクションとして並び、2階層目で追加すると表示されます。",
      });
      const section = navSection.createEl("div");
      const navWrap = section.createEl("div");
      const exerciseTargets = getExerciseTargets();
      const resolveChildGroupLabel = (label: string, fallback: string): string => {
        const trimmed = label.trim();
        if (trimmed && trimmed !== "メイン") {
          return trimmed;
        }
        return fallback || "2階層目";
      };
      const ensureExercisesHaveItems = (
        layout: NavLayout
      ): { layout: NavLayout; changed: boolean } => {
        let changed = false;
        const next = layout.map((group) => {
          const children = group.children.map((child) => {
            if (navChildHasItems(child)) {
              return child;
            }
            const target = (child as { target?: NavTarget }).target;
            if (!target) {
              return child;
            }
            if (isExercisesTarget(target) || matchesExercisesLabel(child.label)) {
              const label = resolveChildGroupLabel(child.label, exercisesLabel);
              changed = true;
              return { label, items: exerciseTargets };
            }
            return child;
          });
          return { ...group, children };
        });
        return { layout: changed ? next : layout, changed };
      };
      const normalizedLayout = normalizeNavLayout(this.plugin.settings.navLayout, {
        keepEmpty: true,
      });
      const ensured = ensureExercisesHaveItems(normalizedLayout);
      if (ensured.changed) {
        persistLayout(ensured.layout);
        return;
      }
      const layout = normalizedLayout;
      const hidden = new Set(this.plugin.settings.hiddenTabs ?? []);
      const templateLabels = getTemplateLabels();
      const existingKeys = new Set(collectTargets(layout).map((target) => navTargetKey(target)));
      const buildIndexedLabel = (prefix: string, existing: Set<string>, startIndex = 1): string => {
        let index = startIndex;
        while (existing.has(`${prefix}${index}`)) {
          index += 1;
        }
        return `${prefix}${index}`;
      };

      layout.forEach((group, groupIndex) => {
        const groupBlock = navWrap.createEl("div", { cls: "lifeplanner-nav-settings-group" });
        groupBlock.createEl("div", {
          text: "1階層目",
          cls: "lifeplanner-nav-settings-label",
        });
        const groupSetting = new Setting(groupBlock).setName("1階層目");
        groupSetting.addText((input) => {
          input.setValue(group.label);
          input.onChange((value) => {
            const label = value.trim() || group.label;
            layout[groupIndex] = { ...group, label };
            persistLayout(layout, { rerender: false });
          });
          input.inputEl.addEventListener("blur", () => {
            renderNav();
          });
        });
        groupSetting.addButton((button) => {
          button.setButtonText("上へ");
          button.onClick(() => {
            if (groupIndex === 0) {
              return;
            }
            const next = moveItem(layout, groupIndex, groupIndex - 1);
            persistLayout(next);
          });
        });
        groupSetting.addButton((button) => {
          button.setButtonText("下へ");
          button.onClick(() => {
            if (groupIndex >= layout.length - 1) {
              return;
            }
            const next = moveItem(layout, groupIndex, groupIndex + 1);
            persistLayout(next);
          });
        });
        groupSetting.addButton((button) => {
          button.setButtonText("削除");
          button.onClick(() => {
            if (layout.length <= 1) {
              return;
            }
            const next = layout.filter((_, index) => index !== groupIndex);
            persistLayout(next);
          });
        });

        const childList = groupBlock.createEl("div", {
          cls: "lifeplanner-nav-settings-children",
        });
        group.children.forEach((child, childIndex) => {
          const childBlock = childList.createEl("div", {
            cls: "lifeplanner-nav-settings-child",
          });
          childBlock.createEl("div", {
            text: "2階層目",
            cls: "lifeplanner-nav-settings-label",
          });
          const childSetting = new Setting(childBlock)
            .setName("2階層目")
            .setDesc(navChildHasItems(child) ? "3階層目あり" : "単独タブ");
          childSetting.addText((input) => {
            input.setValue(child.label);
            input.onChange((value) => {
              const label = value.trim() || child.label;
              const children = [...group.children];
              children[childIndex] = { ...child, label };
              layout[groupIndex] = { ...group, children };
              persistLayout(layout, { rerender: false });
            });
            input.inputEl.addEventListener("blur", () => {
              renderNav();
            });
          });
          const collapseToTarget = (fallback?: NavTarget): void => {
            const target = fallback ?? getExercisesFallbackTarget();
            const next = [...layout];
            const children = [...group.children];
            children[childIndex] = { label: child.label, target };
            next[groupIndex] = { ...group, children };
            persistLayout(next);
          };

          if (!navChildHasItems(child)) {
            const isExercisesChild = isExercisesTarget(child.target) || matchesExercisesLabel(child.label);
            childSetting.addButton((button) => {
              button.setButtonText(isExercisesChild ? "3階層目をカスタム編集" : "3階層目を追加");
              button.onClick(() => {
                const next = [...layout];
                const children = [...group.children];
                const nextLabel = resolveChildGroupLabel(
                  child.label,
                  getNavTargetLabel(child.target, templateLabels)
                );
                const items = isExercisesTarget(child.target)
                  ? exerciseTargets
                  : [child.target];
                children[childIndex] = { label: nextLabel, items };
                next[groupIndex] = { ...group, children };
                persistLayout(next);
              });
            });
          } else {
            const hasExerciseItems = child.items.some((item) => item.type === "exercise");
            const isExercisesGroup = hasExerciseItems || matchesExercisesLabel(child.label);
            childSetting.addButton((button) => {
              button.setButtonText("3階層目を解除");
              button.onClick(() => {
                const fallback =
                  child.items.find((item) => item.type !== "exercise") ?? child.items[0];
                collapseToTarget(fallback);
              });
            });
          }
          childSetting.addButton((button) => {
            button.setButtonText("上へ");
            button.onClick(() => {
              if (childIndex === 0) {
                return;
              }
              const next = [...layout];
              const children = moveItem(group.children, childIndex, childIndex - 1);
              next[groupIndex] = { ...group, children };
              persistLayout(next);
            });
          });
          childSetting.addButton((button) => {
            button.setButtonText("下へ");
            button.onClick(() => {
              if (childIndex >= group.children.length - 1) {
                return;
              }
              const next = [...layout];
              const children = moveItem(group.children, childIndex, childIndex + 1);
              next[groupIndex] = { ...group, children };
              persistLayout(next);
            });
          });
          childSetting.addButton((button) => {
            button.setButtonText("削除");
            button.onClick(() => {
              const next = [...layout];
              const children = group.children.filter((_, idx) => idx !== childIndex);
              next[groupIndex] = { ...group, children };
              persistLayout(next);
            });
          });

          if (navChildHasItems(child)) {
            const itemList = childBlock.createEl("div", {
              cls: "lifeplanner-nav-settings-items",
            });
            child.items.forEach((target, itemIndex) => {
              const itemRow = itemList.createEl("div", {
                cls: "lifeplanner-nav-settings-item",
              });
              itemRow.createEl("div", {
                text: "3階層目",
                cls: "lifeplanner-nav-settings-label",
              });
              const itemSetting = new Setting(itemRow)
                .setName(getNavTargetLabel(target, templateLabels))
                .setDesc(getTargetTypeLabel(target));
              if (target.type === "view") {
                const viewType = target.viewType;
                itemSetting.addToggle((toggle) => {
                  toggle.setValue(!hidden.has(viewType));
                  toggle.onChange(async (value) => {
                    const nextHidden = new Set(this.plugin.settings.hiddenTabs ?? []);
                    if (value) {
                      nextHidden.delete(viewType);
                    } else {
                      nextHidden.add(viewType);
                    }
                    this.plugin.settings.hiddenTabs = Array.from(nextHidden);
                    await this.plugin.saveSettings();
                  });
                });
              }
              itemSetting.addButton((button) => {
                button.setButtonText("上へ");
                button.onClick(() => {
                  if (itemIndex === 0) {
                    return;
                  }
                  const next = [...layout];
                  const children = [...group.children];
                  const items = moveItem(child.items, itemIndex, itemIndex - 1);
                  children[childIndex] = { ...child, items };
                  next[groupIndex] = { ...group, children };
                  persistLayout(next);
                });
              });
              itemSetting.addButton((button) => {
                button.setButtonText("下へ");
                button.onClick(() => {
                  if (itemIndex >= child.items.length - 1) {
                    return;
                  }
                  const next = [...layout];
                  const children = [...group.children];
                  const items = moveItem(child.items, itemIndex, itemIndex + 1);
                  children[childIndex] = { ...child, items };
                  next[groupIndex] = { ...group, children };
                  persistLayout(next);
                });
              });
              itemSetting.addButton((button) => {
                button.setButtonText("削除");
                button.onClick(() => {
                  const next = [...layout];
                  const children = [...group.children];
                  const items = child.items.filter((_, idx) => idx !== itemIndex);
                  if (items.length === 0) {
                    const fallback = target.type === "exercise" ? getExercisesFallbackTarget() : target;
                    children[childIndex] = { label: child.label, target: fallback };
                  } else {
                    children[childIndex] = { ...child, items };
                  }
                  next[groupIndex] = { ...group, children };
                  persistLayout(next);
                });
              });
            });

            const addItemSetting = new Setting(itemList).setName("3階層目追加");
            const options = buildTargetOptions(existingKeys);
            if (Object.keys(options).length === 0) {
              addItemSetting.setDesc("追加できるタブがありません");
            } else {
              addItemSetting.addDropdown((dropdown) => {
                dropdown.addOption("", "追加するタブを選択");
                Object.entries(options).forEach(([key, label]) => {
                  dropdown.addOption(key, label);
                });
                dropdown.onChange((value) => {
                  if (!value) {
                    return;
                  }
                  const target = navTargetFromKey(value);
                  if (!target) {
                    return;
                  }
                  const next = [...layout];
                  const children = [...group.children];
                  const items = [...child.items, target];
                  children[childIndex] = { ...child, items };
                  next[groupIndex] = { ...group, children };
                  persistLayout(next);
                });
              });
            }
          } else {
            const targetSetting = new Setting(childBlock)
              .setName("2階層目の内容")
              .setDesc("ここに表示するタブを選びます。");
            const currentKey = navTargetKey(child.target);
            const options = buildTargetOptions(existingKeys, currentKey);
            targetSetting.addDropdown((dropdown) => {
              dropdown.addOptions(options);
              dropdown.setValue(currentKey);
              dropdown.onChange((value) => {
                const target = navTargetFromKey(value);
                if (!target) {
                  return;
                }
                const prevLabel = child.label;
                const prevTargetLabel = getNavTargetLabel(child.target, templateLabels);
                const nextTargetLabel = getNavTargetLabel(target, templateLabels);
                const nextLabel = prevLabel === prevTargetLabel ? nextTargetLabel : prevLabel;
                const next = [...layout];
                const children = [...group.children];
                children[childIndex] = { ...child, label: nextLabel, target };
                next[groupIndex] = { ...group, children };
                persistLayout(next);
              });
            });
            if (child.target.type === "view") {
              const viewType = child.target.viewType;
              targetSetting.addToggle((toggle) => {
                toggle.setValue(!hidden.has(viewType));
                toggle.onChange(async (value) => {
                  const nextHidden = new Set(this.plugin.settings.hiddenTabs ?? []);
                  if (value) {
                    nextHidden.delete(viewType);
                  } else {
                    nextHidden.add(viewType);
                  }
                  this.plugin.settings.hiddenTabs = Array.from(nextHidden);
                  await this.plugin.saveSettings();
                });
              });
            }
          }
        });

        const addChildSetting = new Setting(groupBlock).setName("2階層目（単独）追加");
        const childOptions = buildTargetOptions(existingKeys);
        if (Object.keys(childOptions).length === 0) {
          addChildSetting.setDesc("追加できるタブがありません");
        } else {
          addChildSetting.addDropdown((dropdown) => {
            dropdown.addOption("", "追加するタブを選択");
            Object.entries(childOptions).forEach(([key, label]) => {
              dropdown.addOption(key, label);
            });
            dropdown.onChange((value) => {
              if (!value) {
                return;
              }
              const target = navTargetFromKey(value);
              if (!target) {
                return;
              }
              const next = [...layout];
              const children = [...group.children];
              children.push({ label: getNavTargetLabel(target, templateLabels), target });
              next[groupIndex] = { ...group, children };
              persistLayout(next);
            });
          });
        }

        const addChildGroupSetting = new Setting(groupBlock).setName(
          "2階層目（3階層目あり）追加"
        );
        addChildGroupSetting.addButton((button) => {
          button.setButtonText("追加");
          button.onClick(() => {
            const existing = new Set(group.children.map((child) => child.label));
            const label = buildIndexedLabel("2階層目", existing, 1);
            const next = [...layout];
            const children = [...group.children, { label, items: [] }];
            next[groupIndex] = { ...group, children };
            persistLayout(next);
          });
        });
      });

      const addGroupSetting = new Setting(navWrap).setName("1階層目追加");
      addGroupSetting.addButton((button) => {
        button.setButtonText("追加");
        button.onClick(() => {
          const existing = new Set(layout.map((group) => group.label));
          const label = ensureUniqueLabel("新規1階層目", existing);
          const next = [...layout, { label, children: [] }];
          persistLayout(next);
        });
      });
    };

    this.renderTemplateSettings(templateSection, {
      headingTag: "h4",
      onTemplatesUpdated: renderNav,
    });
    renderNav();
  }
}

const TEMPLATE_FORMAT_OPTIONS: Array<{ value: TemplateFormat; label: string; hint: string }> = [
  {
    value: "free",
    label: TEMPLATE_FORMAT_LABELS.free,
    hint: "ミッションのように自由に記入する形式",
  },
  {
    value: "pairs",
    label: TEMPLATE_FORMAT_LABELS.pairs,
    hint: "項目と内容をペアで追加する形式",
  },
  {
    value: "select",
    label: TEMPLATE_FORMAT_LABELS.select,
    hint: "選択肢と内容をペアで追加する形式",
  },
  {
    value: "list",
    label: TEMPLATE_FORMAT_LABELS.list,
    hint: "箇条書きで内容を追加する形式",
  },
  {
    value: "qa",
    label: TEMPLATE_FORMAT_LABELS.qa,
    hint: "質問と解答をセットで書く形式",
  },
];

const TEMPLATE_ID_PREFIX = "tpl";

const parseSelectOptions = (raw: string): string[] =>
  raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const buildTemplateId = (existingIds: Set<string>): string => {
  let id = "";
  while (!id || existingIds.has(id)) {
    const stamp = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    id = `${TEMPLATE_ID_PREFIX}-${stamp}-${rand}`;
  }
  return id;
};

class TemplateAddModal extends Modal {
  private existingLabels: Set<string>;
  private existingIds: Set<string>;
  private onSubmit: (entry: CustomTemplateDefinition) => void | Promise<void>;

  constructor(
    app: App,
    existingLabels: Set<string>,
    existingIds: Set<string>,
    onSubmit: (entry: CustomTemplateDefinition) => void | Promise<void>
  ) {
    super(app);
    this.existingLabels = new Set(existingLabels);
    this.existingIds = new Set(existingIds);
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const content = this.contentEl;
    content.empty();
    content.createEl("h3", { text: "テンプレートを追加" });

    const form = content.createEl("div", { cls: "lifeplanner-form" });

    const titleField = form.createEl("div", { cls: "lifeplanner-form-field" });
    titleField.createEl("label", { text: "タイトル" });
    const titleInput = titleField.createEl("input", { type: "text" });

    const formatField = form.createEl("div", { cls: "lifeplanner-form-field" });
    formatField.createEl("label", { text: "形式" });
    const formatSelect = formatField.createEl("select");
    TEMPLATE_FORMAT_OPTIONS.forEach((option) => {
      formatSelect.createEl("option", { text: option.label, value: option.value });
    });
    formatSelect.value = TEMPLATE_FORMAT_OPTIONS[0]?.value ?? "free";
    const hint = formatField.createEl("div", { cls: "lifeplanner-form-hint" });

    const optionsField = form.createEl("div", { cls: "lifeplanner-form-field" });
    optionsField.createEl("label", { text: "選択肢" });
    const optionsInput = optionsField.createEl("textarea");
    optionsInput.rows = 2;
    optionsInput.placeholder = "例: A, B, C";

    const updateFormat = (): void => {
      const selected = TEMPLATE_FORMAT_OPTIONS.find(
        (option) => option.value === formatSelect.value
      );
      hint.setText(selected?.hint ?? "");
      optionsField.classList.toggle("lifeplanner-hidden", formatSelect.value !== "select");
    };
    updateFormat();
    formatSelect.addEventListener("change", updateFormat);

    const error = content.createEl("div", { cls: "lifeplanner-form-error" });
    const actions = content.createEl("div", { cls: "lifeplanner-modal-actions" });
    const cancelButton = actions.createEl("button", { text: "キャンセル" });
    cancelButton.setAttr("type", "button");
    const submitButton = actions.createEl("button", { text: "追加" });
    submitButton.setAttr("type", "button");

    const submit = async (): Promise<void> => {
      error.setText("");
      const label = titleInput.value.trim();
      if (!label) {
        error.setText("タイトルを入力してください");
        return;
      }
      if (this.existingLabels.has(label.toLowerCase())) {
        error.setText("同じタイトルが既にあります");
        return;
      }
      const format = formatSelect.value as TemplateFormat;
      let selectOptions: string[] | undefined;
      if (format === "select") {
        selectOptions = parseSelectOptions(optionsInput.value);
        if (selectOptions.length === 0) {
          error.setText("選択肢を入力してください");
          return;
        }
      }
      const id = buildTemplateId(this.existingIds);
      submitButton.disabled = true;
      cancelButton.disabled = true;
      await this.onSubmit({ id, label, format, selectOptions });
      this.close();
    };

    submitButton.addEventListener("click", () => {
      void submit();
    });
    cancelButton.addEventListener("click", () => {
      this.close();
    });
    titleInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void submit();
      }
    });
    titleInput.focus();
  }
}

class TemplateEditModal extends Modal {
  private entry: CustomTemplateDefinition;
  private onSubmit: (entry: CustomTemplateDefinition) => void | Promise<void>;

  constructor(
    app: App,
    entry: CustomTemplateDefinition,
    onSubmit: (entry: CustomTemplateDefinition) => void | Promise<void>
  ) {
    super(app);
    this.entry = { ...entry };
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const content = this.contentEl;
    content.empty();
    content.createEl("h3", { text: `テンプレート編集: ${this.entry.label}` });

    const form = content.createEl("div", { cls: "lifeplanner-form" });
    const titleField = form.createEl("div", { cls: "lifeplanner-form-field" });
    titleField.createEl("label", { text: "タイトル" });
    const titleInput = titleField.createEl("input", { type: "text" });
    titleInput.value = this.entry.label;

    const formatField = form.createEl("div", { cls: "lifeplanner-form-field" });
    formatField.createEl("label", { text: "形式" });
    formatField.createEl("div", {
      cls: "lifeplanner-form-hint",
      text: TEMPLATE_FORMAT_LABELS[this.entry.format],
    });

    const optionsField = form.createEl("div", { cls: "lifeplanner-form-field" });
    optionsField.createEl("label", { text: "選択肢" });
    const optionsInput = optionsField.createEl("textarea");
    optionsInput.rows = 2;
    optionsInput.placeholder = "例: A, B, C";
    optionsInput.value = (this.entry.selectOptions ?? []).join(", ");
    optionsField.classList.toggle("lifeplanner-hidden", this.entry.format !== "select");

    const error = content.createEl("div", { cls: "lifeplanner-form-error" });
    const actions = content.createEl("div", { cls: "lifeplanner-modal-actions" });
    const cancelButton = actions.createEl("button", { text: "キャンセル" });
    cancelButton.setAttr("type", "button");
    const saveButton = actions.createEl("button", { text: "保存" });
    saveButton.setAttr("type", "button");

    const save = async (): Promise<void> => {
      error.setText("");
      const label = titleInput.value.trim();
      if (!label) {
        error.setText("タイトルを入力してください");
        return;
      }
      let selectOptions = this.entry.selectOptions;
      if (this.entry.format === "select") {
        selectOptions = parseSelectOptions(optionsInput.value);
        if (selectOptions.length === 0) {
          error.setText("選択肢を入力してください");
          return;
        }
      }
      saveButton.disabled = true;
      cancelButton.disabled = true;
      await this.onSubmit({ ...this.entry, label, selectOptions });
      this.close();
    };

    saveButton.addEventListener("click", () => {
      void save();
    });
    cancelButton.addEventListener("click", () => {
      this.close();
    });
    titleInput.focus();
  }
}

class TemplateDeleteModal extends Modal {
  private entry: CustomTemplateDefinition;
  private onSubmit: (deleteFile: boolean) => void | Promise<void>;

  constructor(
    app: App,
    entry: CustomTemplateDefinition,
    onSubmit: (deleteFile: boolean) => void | Promise<void>
  ) {
    super(app);
    this.entry = entry;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const content = this.contentEl;
    content.empty();
    content.createEl("h3", { text: `テンプレートを削除: ${this.entry.label}` });
    content.createEl("p", {
      cls: "lifeplanner-settings-hint",
      text: "テンプレートの設定を削除します。ファイルも削除しますか？",
    });

    const actions = content.createEl("div", { cls: "lifeplanner-modal-actions" });
    const cancelButton = actions.createEl("button", { text: "キャンセル" });
    cancelButton.setAttr("type", "button");
    const keepButton = actions.createEl("button", { text: "テンプレートのみ削除" });
    keepButton.setAttr("type", "button");
    const deleteButton = actions.createEl("button", { text: "テンプレートとファイルを削除" });
    deleteButton.setAttr("type", "button");

    cancelButton.addEventListener("click", () => {
      this.close();
    });
    keepButton.addEventListener("click", () => {
      void this.onSubmit(false);
      this.close();
    });
    deleteButton.addEventListener("click", () => {
      void this.onSubmit(true);
      this.close();
    });
  }
}
