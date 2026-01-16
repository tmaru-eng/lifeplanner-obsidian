import { App } from "obsidian";
import { MarkdownStorage } from "../storage/markdown_storage";

export class MarkdownRepository {
  private storage: MarkdownStorage;

  constructor(app: App) {
    this.storage = new MarkdownStorage(app);
  }

  async read(path: string): Promise<string> {
    return this.storage.read(path);
  }

  async write(path: string, content: string): Promise<void> {
    await this.storage.write(path, content);
  }
}
