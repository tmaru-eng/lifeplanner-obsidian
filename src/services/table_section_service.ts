import { MarkdownRepository } from "./markdown_repository";
import { prependTagFrontmatter } from "./markdown_tags";
import { resolveLifePlannerPath, LifePlannerType } from "../storage/path_resolver";

export type TableColumnType = "text" | "select" | "checkbox";

export type TableColumn = {
  label: string;
  type: TableColumnType;
  options?: string[];
  width?: string;
  multiline?: boolean;
};

export class TableSectionService {
  private repository: MarkdownRepository;
  private type: LifePlannerType;
  private title: string;
  private columns: TableColumn[];
  private baseDir: string;
  private defaultTags: string[];

  constructor(
    repository: MarkdownRepository,
    type: LifePlannerType,
    title: string,
    columns: TableColumn[],
    baseDir: string,
    defaultTags: string[]
  ) {
    this.repository = repository;
    this.type = type;
    this.title = title;
    this.columns = columns;
    this.baseDir = baseDir;
    this.defaultTags = defaultTags;
  }

  async loadRows(): Promise<string[][]> {
    const content = await this.repository.read(resolveLifePlannerPath(this.type, this.baseDir));
    if (!content) {
      const seed = this.serializeRows([]);
      await this.repository.write(resolveLifePlannerPath(this.type, this.baseDir), seed);
      return [];
    }
    return parseTable(content);
  }

  async saveRows(rows: string[][]): Promise<void> {
    const content = this.serializeRows(rows);
    await this.repository.write(resolveLifePlannerPath(this.type, this.baseDir), content);
  }

  private serializeRows(rows: string[][]): string {
    const lines: string[] = [];
    lines.push(`# ${this.title}`);
    lines.push("");
    const headers = this.columns.map((col) => col.label);
    lines.push(`| ${headers.join(" | ")} |`);
    lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
    if (rows.length === 0) {
      lines.push(`| ${headers.map(() => "").join(" | ")} |`);
    } else {
      rows.forEach((row) => {
        const cells = headers.map((_, index) => row[index] ?? "");
        lines.push(`| ${cells.join(" | ")} |`);
      });
    }
    lines.push("");
    return prependTagFrontmatter(lines, this.defaultTags).join("\n");
  }
}

function parseTable(content: string): string[][] {
  const lines = content.split("\n");
  const tableLines = lines.filter((line) => line.trim().startsWith("|"));
  if (tableLines.length < 2) {
    return [];
  }
  const dataLines = tableLines.slice(2);
  const rows: string[][] = [];
  for (const line of dataLines) {
    const cells = line
      .split("|")
      .map((cell) => cell.trim())
      .filter((_, index, arr) => index !== 0 && index !== arr.length - 1);
    if (cells.length === 0) {
      continue;
    }
    rows.push(cells);
  }
  return rows;
}
