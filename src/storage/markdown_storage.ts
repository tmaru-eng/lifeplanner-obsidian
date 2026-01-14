import { App, TFile, TFolder } from "obsidian";

export class MarkdownStorage {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  async read(path: string): Promise<string> {
    if (!isSafePath(path)) {
      throw new Error(`Unsafe path: ${path}`);
    }
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file || !(file instanceof TFile)) {
      return "";
    }
    return this.app.vault.read(file);
  }

  async write(path: string, content: string): Promise<void> {
    if (!isSafePath(path)) {
      throw new Error(`Unsafe path: ${path}`);
    }
    const normalized = content.replace(/\r\n?/g, "\n");
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file && file instanceof TFile) {
      await this.app.vault.modify(file, normalized);
      return;
    }
    await this.ensureFolder(path);
    await this.app.vault.create(path, normalized);
  }

  private async ensureFolder(path: string): Promise<void> {
    const parts = path.split("/");
    if (parts.length <= 1) {
      return;
    }
    const folders = parts.slice(0, -1);
    let current = "";
    for (const folder of folders) {
      current = current ? `${current}/${folder}` : folder;
      const existing = this.app.vault.getAbstractFileByPath(current);
      if (existing && existing instanceof TFolder) {
        continue;
      }
      if (!existing) {
        await this.app.vault.createFolder(current);
      }
    }
  }
}

function isSafePath(path: string): boolean {
  if (!path) {
    return false;
  }
  if (path.startsWith("/") || path.startsWith("\\")) {
    return false;
  }
  if (path.includes("..")) {
    return false;
  }
  return true;
}
