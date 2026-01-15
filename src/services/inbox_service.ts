import { InboxItem, InboxDestination } from "../models/inbox_item";
import { MarkdownRepository } from "./markdown_repository";
import { prependTagFrontmatter } from "./markdown_tags";
import { resolveLifePlannerPath } from "../storage/path_resolver";

export class InboxService {
  private repository: MarkdownRepository;
  private baseDir: string;
  private defaultTags: string[];

  constructor(repository: MarkdownRepository, baseDir: string, defaultTags: string[]) {
    this.repository = repository;
    this.baseDir = baseDir;
    this.defaultTags = defaultTags;
  }

  async listItems(): Promise<InboxItem[]> {
    const content = await this.repository.read(resolveLifePlannerPath("Inbox", this.baseDir));
    if (!content) {
      return [];
    }
    return parseInboxItems(content);
  }

  async addItem(content: string): Promise<InboxItem> {
    const items = await this.listItems();
    const item: InboxItem = {
      id: `inbox-${Date.now()}`,
      content,
      destination: "none",
      status: "new",
    };
    items.push(item);
    await this.saveItems(items);
    return item;
  }

  async markTriaged(itemId: string, destination: InboxDestination): Promise<void> {
    const items = await this.listItems();
    const remaining = items.filter((item) => item.id !== itemId);
    await this.saveItems(remaining);
  }

  async saveItems(items: InboxItem[]): Promise<void> {
    const content = serializeInboxItems(items, this.defaultTags);
    await this.repository.write(resolveLifePlannerPath("Inbox", this.baseDir), content);
  }
}

function parseInboxItems(content: string): InboxItem[] {
  const items: InboxItem[] = [];
  const lines = content.split("\n");
  for (const line of lines) {
    const match = line.match(/^- \[.\] (.+?)(?: \[dest:(.+)\])?$/);
    if (!match) {
      continue;
    }
    const destination = (match[2] as InboxDestination) || "none";
    items.push({
      id: `inbox-${items.length}`,
      content: match[1].trim(),
      destination,
      status: destination === "none" ? "new" : "triaged",
    });
  }
  return items;
}

function serializeInboxItems(items: InboxItem[], defaultTags: string[] = []): string {
  const lines: string[] = [];
  lines.push("# Inbox");
  lines.push("");
  if (items.length === 0) {
    lines.push("- [ ] ");
  } else {
    for (const item of items) {
      const dest = item.destination === "none" ? "" : ` [dest:${item.destination}]`;
      lines.push(`- [ ] ${item.content}${dest}`);
    }
  }
  lines.push("");
  return prependTagFrontmatter(lines, defaultTags).join("\n");
}
