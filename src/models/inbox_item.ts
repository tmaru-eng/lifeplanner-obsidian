export type InboxDestination = "goal" | "task" | "weekly" | "issue" | "none";
export type InboxStatus = "new" | "triaged";

export interface InboxItem {
  id: string;
  content: string;
  createdAt?: number;
  tags?: string[];
  destination: InboxDestination;
  status: InboxStatus;
}
