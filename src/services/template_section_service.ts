import { MarkdownRepository } from "./markdown_repository";
import { normalizeTags } from "./markdown_tags";
import { resolveTemplateSectionPath } from "../storage/path_resolver";

export class TemplateSectionService {
  private repository: MarkdownRepository;
  private templateId: string;
  private title: string;
  private baseDir: string;
  private defaultTags: string[];
  private selectOptions: string[];

  constructor(
    repository: MarkdownRepository,
    templateId: string,
    title: string,
    baseDir: string,
    defaultTags: string[],
    options: { selectOptions?: string[] } = {}
  ) {
    this.repository = repository;
    this.templateId = templateId;
    this.title = title;
    this.baseDir = baseDir;
    this.defaultTags = defaultTags;
    this.selectOptions = (options.selectOptions ?? [])
      .map((option) => option.trim())
      .filter((option) => option.length > 0);
  }

  async load(): Promise<string> {
    const path = resolveTemplateSectionPath(this.templateId, this.baseDir);
    const content = await this.repository.read(path);
    if (!content) {
      await this.repository.write(path, this.serialize(""));
      return "";
    }
    return this.parse(content);
  }

  async save(body: string): Promise<void> {
    await this.repository.write(
      resolveTemplateSectionPath(this.templateId, this.baseDir),
      this.serialize(body)
    );
  }

  private serialize(body: string): string {
    const lines: string[] = [];
    lines.push(...this.buildFrontmatter());
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

  private buildFrontmatter(): string[] {
    const tags = normalizeTags(this.defaultTags);
    const hasTags = tags.length > 0;
    const hasOptions = this.selectOptions.length > 0;
    if (!hasTags && !hasOptions) {
      return [];
    }
    const frontmatter: string[] = ["---"];
    if (hasTags) {
      frontmatter.push("tags:");
      tags.forEach((tag) => {
        frontmatter.push(`  - ${tag}`);
      });
    }
    if (hasOptions) {
      frontmatter.push("selectOptions:");
      this.selectOptions.forEach((option) => {
        frontmatter.push(`  - ${JSON.stringify(option)}`);
      });
    }
    frontmatter.push("---", "");
    return frontmatter;
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
