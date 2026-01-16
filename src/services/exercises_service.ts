import { MarkdownRepository } from "./markdown_repository";
import { prependTagFrontmatter } from "./markdown_tags";
import { resolveLifePlannerPath } from "../storage/path_resolver";

export class ExercisesService {
  private repository: MarkdownRepository;
  private baseDir: string;
  private defaultTags: string[];

  constructor(repository: MarkdownRepository, baseDir: string, defaultTags: string[]) {
    this.repository = repository;
    this.baseDir = baseDir;
    this.defaultTags = defaultTags;
  }

  async loadSections(
    sectionDefs: { title: string; defaultBody: string; questions?: string[] }[]
  ): Promise<Record<string, string>> {
    const resolved = resolveLifePlannerPath("Exercises", this.baseDir);
    const content = await this.repository.read(resolved);
    if (!content) {
      const seed = serializeSections(sectionDefs, {}, this.defaultTags);
      await this.repository.write(resolved, seed);
      return buildSectionMap(sectionDefs, {});
    }
    const parsed = parseSections(content);
    const normalized = normalizeSections(sectionDefs, parsed);
    return buildSectionMap(sectionDefs, normalized);
  }

  async saveSections(
    sectionDefs: { title: string; defaultBody: string; questions?: string[] }[],
    sections: Record<string, string>
  ): Promise<void> {
    const content = serializeSections(sectionDefs, sections, this.defaultTags);
    await this.repository.write(resolveLifePlannerPath("Exercises", this.baseDir), content);
  }
}

function parseSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = content.split("\n");
  let currentTitle = "";
  let body: string[] = [];
  const flush = () => {
    if (!currentTitle) {
      return;
    }
    sections[currentTitle] = body.join("\n").trim();
  };
  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      flush();
      currentTitle = headingMatch[1].trim();
      body = [];
      continue;
    }
    if (!currentTitle) {
      continue;
    }
    body.push(line);
  }
  flush();
  return sections;
}

function serializeSections(
  sectionDefs: { title: string; defaultBody: string; questions?: string[] }[],
  sections: Record<string, string>,
  defaultTags: string[] = []
): string {
  const lines: string[] = [];
  lines.push("# Exercises");
  lines.push("");
  for (const section of sectionDefs) {
    const body = sections[section.title] ?? section.defaultBody;
    lines.push(`## ${section.title}`);
    lines.push("");
    if (body && body.trim().length > 0) {
      lines.push(body.trim());
    } else {
      lines.push("- ");
    }
    lines.push("");
  }
  return prependTagFrontmatter(lines, defaultTags).join("\n");
}

function buildSectionMap(
  sectionDefs: { title: string; defaultBody: string; questions?: string[] }[],
  parsed: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const section of sectionDefs) {
    result[section.title] = parsed[section.title] ?? section.defaultBody;
  }
  return result;
}

function normalizeSections(
  sectionDefs: { title: string; defaultBody: string; questions?: string[] }[],
  parsed: Record<string, string>
): Record<string, string> {
  const normalized: Record<string, string> = { ...parsed };
  for (const section of sectionDefs) {
    if (!section.questions || section.questions.length === 0) {
      continue;
    }
    const raw = normalized[section.title];
    if (!raw) {
      continue;
    }
    const lines = raw.split("\n").map((line) => line.trim());
    const filtered = lines.filter((line) => !section.questions?.includes(line));
    normalized[section.title] = filtered.join("\n").trim();
  }
  return normalized;
}
