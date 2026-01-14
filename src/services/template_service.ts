import { App } from "obsidian";
import { MarkdownStorage } from "../storage/markdown_storage";
import { LifePlannerSettings } from "../settings";
import { TEMPLATE_CATALOG, TemplateEntry } from "./template_catalog";

export class TemplateService {
  private app: App;
  private storage: MarkdownStorage;
  private settings: LifePlannerSettings;

  constructor(app: App, settings: LifePlannerSettings) {
    this.app = app;
    this.storage = new MarkdownStorage(app);
    this.settings = settings;
  }

  listTemplates(): TemplateEntry[] {
    return TEMPLATE_CATALOG;
  }

  async createFromTemplate(entry: TemplateEntry): Promise<string> {
    const templatePath = await this.resolveTemplatePath(entry.filename);
    const content = await this.safeRead(templatePath);
    const folder = `LifePlanner/${entry.folder}`;
    await this.ensureFolder(folder);
    const baseName = `${entry.label} - ${this.buildSuffix(entry)}`;
    const targetPath = await this.uniquePath(`${folder}/${baseName}.md`);
    await this.storage.write(targetPath, content);
    return targetPath;
  }

  private buildSuffix(entry: TemplateEntry): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    const pad = (value: number) => String(value).padStart(2, "0");

    switch (entry.filenameKind) {
      case "daily":
      case "dated":
        return `${year}-${pad(month)}-${pad(day)}`;
      case "monthly":
        return `${year}-${pad(month)}`;
      case "annual":
        return `${year}`;
      case "quarterly": {
        const quarter = Math.floor((month - 1) / 3) + 1;
        return `${year}-Q${quarter}`;
      }
      case "five-year":
        return `${year}-${year + 4}`;
      case "weekly": {
        const start = this.weekStartDate(now);
        return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
      }
      default:
        return `${year}-${pad(month)}-${pad(day)}`;
    }
  }

  private weekStartDate(date: Date): Date {
    const day = date.getDay();
    const start = new Date(date);
    const offset = this.settings.weekStart === "sunday" ? day : (day + 6) % 7;
    start.setDate(date.getDate() - offset);
    return start;
  }

  private async resolveTemplatePath(filename: string): Promise<string> {
    const vaultPath = this.app.vault.adapter.getBasePath();
    const desktopPath = `${vaultPath}/.obsidian.desktop/plugins/lifeplanner/templates/${filename}`;
    const standardPath = `${vaultPath}/.obsidian/plugins/lifeplanner/templates/${filename}`;
    if (await this.app.vault.adapter.exists(desktopPath)) {
      return desktopPath;
    }
    if (await this.app.vault.adapter.exists(standardPath)) {
      return standardPath;
    }
    throw new Error(`Template not found: ${filename}`);
  }

  private async ensureFolder(path: string): Promise<void> {
    const exists = await this.app.vault.adapter.exists(path);
    if (!exists) {
      await this.app.vault.createFolder(path);
    }
  }

  private async uniquePath(path: string): Promise<string> {
    if (!(await this.app.vault.adapter.exists(path))) {
      return path;
    }
    const parts = path.split(".md");
    let index = 2;
    while (await this.app.vault.adapter.exists(`${parts[0]} (${index}).md`)) {
      index += 1;
    }
    return `${parts[0]} (${index}).md`;
  }

  private async safeRead(path: string): Promise<string> {
    if (!(await this.app.vault.adapter.exists(path))) {
      throw new Error(`Template file missing at ${path}`);
    }
    return this.app.vault.adapter.read(path);
  }
}
