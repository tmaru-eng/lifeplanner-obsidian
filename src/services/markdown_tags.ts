export function normalizeTags(rawTags: string[] | undefined): string[] {
  if (!rawTags || rawTags.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const raw of rawTags) {
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }
    const cleaned = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
    if (!cleaned) {
      continue;
    }
    const key = cleaned.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(cleaned);
  }
  return normalized;
}

export function prependTagFrontmatter(lines: string[], rawTags: string[] | undefined): string[] {
  const tags = normalizeTags(rawTags);
  if (tags.length === 0) {
    return lines;
  }
  const frontmatter: string[] = ["---", "tags:"];
  tags.forEach((tag) => {
    frontmatter.push(`  - ${tag}`);
  });
  frontmatter.push("---", "");
  return [...frontmatter, ...lines];
}
