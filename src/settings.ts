import { App, PluginSettingTab, Setting } from "obsidian";
import type LifePlannerPlugin from "./main";

export type WeekStart = "monday" | "sunday";

export interface LifePlannerSettings {
  weekStart: WeekStart;
  storageDir: string;
  kanbanColumns: string[];
  actionPlanMinLevel: string;
  defaultTags: string[];
}

export const DEFAULT_SETTINGS: LifePlannerSettings = {
  weekStart: "monday",
  storageDir: "LifePlanner",
  kanbanColumns: ["Backlog", "Todo", "Doing", "Done"],
  actionPlanMinLevel: "月間",
  defaultTags: ["lifeplanner"],
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

    new Setting(containerEl)
      .setName("Week start")
      .setDesc("Weekly filenames use the start date of the week.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("monday", "Monday")
          .addOption("sunday", "Sunday")
          .setValue(this.plugin.settings.weekStart)
          .onChange(async (value) => {
            this.plugin.settings.weekStart = value as WeekStart;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Storage folder")
      .setDesc("Folder path in your vault for LifePlanner files.")
      .addText((input) => {
        input.setPlaceholder("LifePlanner");
        input.setValue(this.plugin.settings.storageDir);
        input.onChange(async (value) => {
          this.plugin.settings.storageDir = value.trim() || "LifePlanner";
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Kanban columns")
      .setDesc("Comma-separated column names for the Issues board.")
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
      .setName("Default tags")
      .setDesc("Comma-separated tags applied to LifePlanner files. Leave blank for none.")
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
      .setName("Action plan minimum level")
      .setDesc("Show goals at or below this level in Action Plan candidates.")
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
  }
}
