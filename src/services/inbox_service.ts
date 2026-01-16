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
    const items = parseInboxItems(content);
    const activeItems = items.filter((item) => item.destination === "none");
    if (activeItems.length !== items.length) {
      await this.saveItems(activeItems);
    }
    return activeItems;
  }

  async addItem(content: string, createdAt: number = Date.now()): Promise<InboxItem> {
    const items = await this.listItems();
    const item: InboxItem = {
      id: `inbox-${Date.now()}`,
      content,
      createdAt,
      destination: "none",
      status: "new",
    };
    items.push(item);
    await this.saveItems(items);
    return item;
  }

  async markTriaged(itemId: string, destination: InboxDestination): Promise<void> {
    const items = await this.listItems();
    const index = items.findIndex((item) => item.id === itemId);
    if (index === -1) {
      return;
    }
    items[index] = {
      ...items[index],
      destination,
      status: destination === "none" ? "new" : "triaged",
      createdAt: items[index].createdAt ?? Date.now(),
    };
    await this.saveItems(items);
  }

  async updateItem(itemId: string, content: string): Promise<void> {
    const items = await this.listItems();
    const index = items.findIndex((item) => item.id === itemId);
    if (index === -1) {
      return;
    }
    items[index] = {
      ...items[index],
      content,
      createdAt: items[index].createdAt ?? Date.now(),
    };
    await this.saveItems(items);
  }

  async deleteItem(itemId: string): Promise<void> {
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
    const match = line.match(/^- \[.\] (.+)$/);
    if (!match) {
      continue;
    }
    const parsed = extractMetadata(match[1]);
    const destination = (parsed.dest as InboxDestination) || "none";
    const createdAt = parseTimestamp(parsed.ts);
    items.push({
      id: `inbox-${items.length}`,
      content: parsed.content,
      createdAt,
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
      const tokens: string[] = [];
      if (typeof item.createdAt === "number") {
        tokens.push(`ts:${item.createdAt}`);
      }
      if (item.destination !== "none") {
        tokens.push(`dest:${item.destination}`);
      }
      const suffix = tokens.length > 0 ? ` ${tokens.map((token) => `[${token}]`).join(" ")}` : "";
      lines.push(`- [ ] ${item.content}${suffix}`);
    }
  }
  lines.push("");
  return prependTagFrontmatter(lines, defaultTags).join("\n");
}

function extractMetadata(raw: string): { content: string; ts?: string; dest?: string } {
  let content = raw.trim();
  const meta: Record<string, string> = {};
  const metaPattern = /\s\[(ts|dest):([^\]]+)\]\s*$/;
  while (true) {
    const match = content.match(metaPattern);
    if (!match) {
      break;
    }
    meta[match[1]] = match[2];
    content = content.slice(0, match.index).trim();
  }
  return { content, ts: meta.ts, dest: meta.dest };
}

function parseTimestamp(raw?: string): number | undefined {
  if (!raw) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}
