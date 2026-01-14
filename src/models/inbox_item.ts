export type InboxDestination = "goal" | "task" | "weekly" | "none";
export type InboxStatus = "new" | "triaged";

export interface InboxItem {
  id: string;
  content: string;
  tags?: string[];
  destination: InboxDestination;
  status: InboxStatus;
}
