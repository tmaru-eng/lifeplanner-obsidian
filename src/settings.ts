import { App, PluginSettingTab, Setting } from "obsidian";
import type LifePlannerPlugin from "./main";
import { NAV_GROUPS } from "./ui/navigation";
import type { LifePlannerViewType } from "./ui/view_types";
import {
  DASHBOARD_VIEW_TYPE,
  INBOX_VIEW_TYPE,
  WEEKLY_PLAN_VIEW_TYPE,
} from "./ui/view_types";

export type WeekStart = "monday" | "sunday";

export interface LifePlannerSettings {
  weekStart: WeekStart;
  storageDir: string;
  kanbanColumns: string[];
  actionPlanMinLevel: string;
  defaultTags: string[];
  hiddenTabs: LifePlannerViewType[];
  dashboardSections: LifePlannerViewType[];
  showDashboardCalendar: boolean;
}

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
  hiddenTabs: [],
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

    containerEl.createEl("h3", { text: "タブ表示" });
    NAV_GROUPS.forEach((group) => {
      containerEl.createEl("h4", { text: group.label });
      group.items.forEach((item) => {
        new Setting(containerEl)
          .setName(item.label)
          .setDesc("表示/非表示")
          .addToggle((toggle) => {
            toggle.setValue(!this.plugin.settings.hiddenTabs.includes(item.viewType));
            toggle.onChange(async (value) => {
              const hidden = new Set(this.plugin.settings.hiddenTabs);
              if (value) {
                hidden.delete(item.viewType);
              } else {
                hidden.add(item.viewType);
              }
              this.plugin.settings.hiddenTabs = Array.from(hidden);
              await this.plugin.saveSettings();
            });
          });
      });
    });
  }
}
