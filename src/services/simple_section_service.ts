import { MarkdownRepository } from "./markdown_repository";
import { resolveLifePlannerPath, LifePlannerType } from "../storage/path_resolver";

export class SimpleSectionService {
  private repository: MarkdownRepository;
  private type: LifePlannerType;
  private title: string;
  private baseDir: string;

  constructor(repository: MarkdownRepository, type: LifePlannerType, title: string, baseDir: string) {
    this.repository = repository;
    this.type = type;
    this.title = title;
    this.baseDir = baseDir;
  }

  async load(): Promise<string> {
    const content = await this.repository.read(resolveLifePlannerPath(this.type, this.baseDir));
    if (!content) {
      await this.repository.write(resolveLifePlannerPath(this.type, this.baseDir), this.serialize(""));
      return "";
    }
    return this.parse(content);
  }

  async save(body: string): Promise<void> {
    await this.repository.write(resolveLifePlannerPath(this.type, this.baseDir), this.serialize(body));
  }

  private serialize(body: string): string {
    const lines: string[] = [];
    lines.push(`# ${this.title}`);
    lines.push("");
    if (body.trim().length > 0) {
      lines.push(body.trim());
    } else {
      lines.push("- ");
    }
    lines.push("");
    return lines.join("\n");
  }

  private parse(content: string): string {
    const lines = content.split("\n");
    const body: string[] = [];
    let started = false;
    for (const line of lines) {
      if (line.startsWith("#")) {
        if (!started) {
          started = true;
          continue;
        }
      }
      if (!started) {
        continue;
      }
      body.push(line);
    }
    return body.join("\n").trim();
  }
}
