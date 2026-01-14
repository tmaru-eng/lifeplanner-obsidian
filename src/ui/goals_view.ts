import { ItemView, Modal, WorkspaceLeaf } from "obsidian";
import { Goal, GoalLevel } from "../models/goal";
import { MarkdownRepository } from "../services/markdown_repository";
import { GoalsService } from "../services/goals_service";
import type LifePlannerPlugin from "../main";
import { renderNavigation } from "./navigation";
import { GOALS_VIEW_TYPE } from "./view_types";
export { GOALS_VIEW_TYPE };

const LEVELS: GoalLevel[] = [
  "人生",
  "長期",
  "中期",
  "年間",
  "四半期",
  "月間",
  "週間",
];

export class GoalsView extends ItemView {
  private plugin: LifePlannerPlugin;
  private goalsService: GoalsService;
  private listEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private parentSelect: HTMLSelectElement | null = null;
  private descriptionInput: HTMLTextAreaElement | null = null;
  private goals: Goal[] = [];
  private formEl: HTMLElement | null = null;
  private formWrapEl: HTMLElement | null = null;
  private handleOutsideClick: ((event: MouseEvent) => void) | null = null;
  private handleMenuClose: ((event: MouseEvent) => void) | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: LifePlannerPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.goalsService = new GoalsService(
      new MarkdownRepository(this.plugin.app),
      this.plugin.settings.storageDir
    );
  }

  getViewType(): string {
    return GOALS_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "目標";
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();

    const view = container.createEl("div", { cls: "lifeplanner-view" });
    view.createEl("h2", { text: "目標" });
    renderNavigation(view, (viewType) => {
      void this.plugin.openViewInLeaf(viewType, this.leaf);
    });

    const formWrap = view.createEl("div", { cls: "lifeplanner-goals-form-wrap" });
    this.formWrapEl = formWrap;
    const formToggle = formWrap.createEl("button", {
      cls: "lifeplanner-goals-form-toggle",
      text: "追加",
    });
    formToggle.setAttr("type", "button");
    formToggle.setAttr("aria-label", "追加フォーム");
    const form = formWrap.createEl("div", {
      cls: "lifeplanner-goals-form lifeplanner-form is-collapsed",
    });
    this.formEl = form;
    const levelField = form.createEl("div", {
      cls: "lifeplanner-form-field lifeplanner-form-row",
    });
    levelField.createEl("label", { text: "カテゴリ" });
    const levelSelect = levelField.createEl("select");
    for (const level of LEVELS) {
      levelSelect.createEl("option", { text: level, value: level });
    }
    const parentField = form.createEl("div", {
      cls: "lifeplanner-form-field lifeplanner-form-row",
    });
    parentField.createEl("label", { text: "親目標" });
    const parentSelect = parentField.createEl("select");
    parentSelect.createEl("option", { text: "親目標なし", value: "" });
    this.parentSelect = parentSelect;
    const titleField = form.createEl("div", {
      cls: "lifeplanner-form-field lifeplanner-form-row",
    });
    titleField.createEl("label", { text: "目標タイトル" });
    const titleInput = titleField.createEl("input", { type: "text" });
    titleInput.placeholder = "目標を入力";
    const descriptionField = form.createEl("div", {
      cls: "lifeplanner-form-field lifeplanner-form-row",
    });
    descriptionField.createEl("label", { text: "説明文" });
    const descriptionInput = descriptionField.createEl("textarea");
    descriptionInput.rows = 1;
    descriptionInput.placeholder = "目標の説明";
    this.descriptionInput = descriptionInput;
    const dueField = form.createEl("div", {
      cls: "lifeplanner-form-field lifeplanner-form-row",
    });
    dueField.createEl("label", { text: "期限" });
    const dueInput = dueField.createEl("input", { type: "date" });
    const actionField = form.createEl("div", {
      cls: "lifeplanner-form-field lifeplanner-form-row",
    });
    actionField.createEl("label", { text: " " });
    const addButton = actionField.createEl("button", { text: "追加" });

    this.statusEl = view.createEl("div", { cls: "lifeplanner-goals-status" });
    this.listEl = view.createEl("div", { cls: "lifeplanner-goals-list" });

    addButton.addEventListener("click", () => {
      const parentValue = parentSelect.value ? parentSelect.value : undefined;
      void this.handleAddGoal(
        levelSelect.value as GoalLevel,
        titleInput.value.trim(),
        descriptionInput.value.trim(),
        parentValue,
        dueInput.value ? dueInput.value : undefined
      );
      titleInput.value = "";
      descriptionInput.value = "";
      dueInput.value = "";
    });
    formToggle.addEventListener("click", (event) => {
      event.preventDefault();
      form.classList.toggle("is-collapsed");
    });
    form.addEventListener("focusout", (event) => {
      const related = event.relatedTarget as Node | null;
      if (related && formWrap.contains(related)) {
        return;
      }
      form.classList.add("is-collapsed");
    });
    this.handleOutsideClick = (event: MouseEvent) => {
      if (!this.formWrapEl || !this.formEl) {
        return;
      }
      const target = event.target as Node | null;
      if (target && this.formWrapEl.contains(target)) {
        return;
      }
      this.formEl.classList.add("is-collapsed");
    };
    document.addEventListener("mousedown", this.handleOutsideClick, true);
    this.handleMenuClose = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && (formWrap.contains(target) || this.listEl?.contains(target))) {
        return;
      }
      this.listEl?.querySelectorAll(".lifeplanner-goal-menu-list.is-open").forEach((menu) => {
        menu.classList.remove("is-open");
      });
    };
    document.addEventListener("mousedown", this.handleMenuClose, true);

    await this.renderGoals();
    await this.populateParents();
  }

  async onClose(): Promise<void> {
    this.listEl = null;
    this.statusEl = null;
    this.parentSelect = null;
    this.descriptionInput = null;
    this.goals = [];
    this.formEl = null;
    this.formWrapEl = null;
    if (this.handleOutsideClick) {
      document.removeEventListener("mousedown", this.handleOutsideClick, true);
      this.handleOutsideClick = null;
    }
    if (this.handleMenuClose) {
      document.removeEventListener("mousedown", this.handleMenuClose, true);
      this.handleMenuClose = null;
    }
  }

  private async handleAddGoal(
    level: GoalLevel,
    title: string,
    description: string,
    parentGoalId?: string,
    dueDate?: string
  ): Promise<void> {
    if (!title) {
      this.setStatus("目標を入力してください");
      return;
    }
    await this.goalsService.addGoal(level, title, description, parentGoalId, dueDate);
    this.setStatus("追加しました");
    await this.renderGoals();
    await this.populateParents();
  }

  private async renderGoals(): Promise<void> {
    if (!this.listEl) {
      return;
    }
    this.listEl.empty();
    const goals = await this.goalsService.listGoals();
    this.goals = goals;
    if (goals.length === 0) {
      this.listEl.createEl("div", { text: "(未登録)" });
      return;
    }
    const rootDrop = this.listEl.createEl("div", { cls: "lifeplanner-goal-root-drop" });
    const rootLabel = rootDrop.createEl("div", { cls: "lifeplanner-goal-root-label" });
    rootLabel.setText("ルートへ移動（ここにドロップ）");
    const isInsideCard = (target: EventTarget | null): boolean =>
      target instanceof Element && Boolean(target.closest(".lifeplanner-goal-card"));
    rootDrop.addEventListener("dragover", (event) => {
      if (isInsideCard(event.target)) {
        return;
      }
      event.preventDefault();
      rootDrop.addClass("is-drop");
    });
    rootDrop.addEventListener("dragleave", () => {
      rootDrop.removeClass("is-drop");
    });
    rootDrop.addEventListener("drop", (event) => {
      if (isInsideCard(event.target)) {
        return;
      }
      event.preventDefault();
      rootDrop.removeClass("is-drop");
      const sourceId =
        event.dataTransfer?.getData("lifeplanner-goal-id") ||
        event.dataTransfer?.getData("lifeplanner-goal") ||
        event.dataTransfer?.getData("text/plain");
      if (!sourceId) {
        return;
      }
      void this.handleMoveToRoot(sourceId);
    });
    const tree = buildGoalTree(goals);
    const rootContainer = rootDrop.createEl("div", { cls: "lifeplanner-goal-root-list" });
    renderGoalTree(rootContainer, tree, 0, (node) => {
      void this.handleEdit(node);
    }, (node) => {
      void this.handleDelete(node);
    }, (node) => {
      void this.handleAddChild(node);
    }, (sourceId, targetNode, position) => {
      void this.handleMove(sourceId, targetNode, position);
    }, (node, expanded) => {
      void this.handleToggleExpanded(node, expanded);
    });
  }

  private async populateParents(): Promise<void> {
    if (!this.parentSelect) {
      return;
    }
    this.parentSelect.empty();
    this.parentSelect.createEl("option", { text: "親目標なし", value: "" });
    const goals = await this.goalsService.listGoals();
    const byId = new Map(goals.map((goal) => [goal.id, goal]));
    for (const goal of goals) {
      const parent = goal.parentGoalId ? byId.get(goal.parentGoalId) : undefined;
      const optionLabel = parent ? `${goal.title} (親: ${parent.title})` : goal.title;
      this.parentSelect.createEl("option", { text: optionLabel, value: goal.id });
    }
  }

  private async handleEdit(node: GoalNode): Promise<void> {
    const parentLevel = node.parentLevel as GoalLevel | undefined;
    const allowedLevels = parentLevel ? levelsBelow(parentLevel) : LEVELS;
    const goals = await this.goalsService.listGoals();
    const byId = new Map(goals.map((goal) => [goal.id, goal]));
    const parentTitle = node.parentGoalId ? byId.get(node.parentGoalId)?.title ?? "" : "";
    const modal = new GoalEditModal(this.app, {
      title: node.title,
      description: node.description ?? "",
      parentGoalId: parentTitle,
      level: (node.level as GoalLevel) ?? "週間",
      dueDate: node.dueDate ?? "",
      lockLevel: parentLevel ? allowedLevels.length === 1 : false,
      lockParent: Boolean(node.parentGoalId),
      allowedLevels,
      onSubmit: async (values) => {
        const parentId =
          goals.find((goal) => goal.id === values.parentGoalId)?.id ??
          goals.find((goal) => goal.title === values.parentGoalId)?.id;
        await this.goalsService.updateGoal(node.id, {
          title: values.title,
          description: values.description,
          parentGoalId: parentId,
          level: values.level,
          dueDate: values.dueDate || undefined,
        });
        this.setStatus("更新しました");
        await this.renderGoals();
        await this.populateParents();
      },
    });
    modal.open();
  }

  private async handleDelete(node: GoalNode): Promise<void> {
    const ok = window.confirm(`"${node.title}" を削除しますか？`);
    if (!ok) {
      return;
    }
    await this.goalsService.deleteGoal(node.id);
    this.setStatus("削除しました");
    await this.renderGoals();
    await this.populateParents();
  }

  private async handleAddChild(node: GoalNode): Promise<void> {
    const parentLevel = (node.level as GoalLevel) ?? "週間";
    const allowedLevels = levelsBelow(parentLevel);
    const childLevel = allowedLevels[0] ?? parentLevel;
    const modal = new GoalEditModal(this.app, {
      title: "",
      description: "",
      dueDate: "",
      parentGoalId: node.title,
      level: childLevel,
      lockLevel: false,
      lockParent: true,
      allowedLevels,
      onSubmit: async (values) => {
        await this.goalsService.addGoal(
          values.level,
          values.title,
          values.description,
          node.id,
          values.dueDate || undefined
        );
        this.setStatus("子目標を追加しました");
        await this.renderGoals();
        await this.populateParents();
      },
    });
    modal.open();
  }

  private async handleMove(
    sourceId: string,
    targetNode: GoalNode,
    position: "before" | "after"
  ): Promise<void> {
    if (sourceId === targetNode.id) {
      return;
    }
    const source = this.goals.find((goal) => goal.id === sourceId);
    const target = this.goals.find((goal) => goal.id === targetNode.id);
    if (!source || !target) {
      return;
    }
    const goalsById = new Map(this.goals.map((goal) => [goal.id, goal]));
    const isDescendant = (childId: string, ancestorId: string): boolean => {
      let current = goalsById.get(childId);
      const visited = new Set<string>();
      while (current?.parentGoalId) {
        if (current.parentGoalId === ancestorId) {
          return true;
        }
        if (visited.has(current.parentGoalId)) {
          break;
        }
        visited.add(current.parentGoalId);
        current = goalsById.get(current.parentGoalId);
      }
      return false;
    };
    if (isDescendant(target.id, source.id)) {
      this.setStatus("子孫には移動できません");
      return;
    }
    const sourceLevelIndex = LEVELS.indexOf(source.level);
    const targetLevelIndex = target.level ? LEVELS.indexOf(target.level) : -1;
    let newParentId = target.parentGoalId;
    if (targetLevelIndex >= 0 && sourceLevelIndex >= 0) {
      if (targetLevelIndex < sourceLevelIndex) {
        newParentId = target.id;
      } else {
        newParentId = target.parentGoalId;
      }
    }
    const parentGoal = newParentId
      ? this.goals.find((goal) => goal.id === newParentId)
      : undefined;
    if (newParentId === source.id) {
      this.setStatus("自身の配下には移動できません");
      return;
    }
    if (parentGoal) {
      const parentLevelIndex = LEVELS.indexOf(parentGoal.level);
      if (parentLevelIndex >= sourceLevelIndex) {
        this.setStatus("親目標の階層が上である必要があります");
        return;
      }
    }

    const oldParentId = source.parentGoalId;
    const sameLevel = source.level === target.level;
    const isSameGroup =
      sameLevel && (target.parentGoalId ?? "") === (newParentId ?? "");

    const buildGroupFrom = (goals: Goal[], parentId?: string): Goal[] =>
      goals.filter(
        (goal) =>
          goal.level === source.level && (goal.parentGoalId ?? "") === (parentId ?? "")
      );

    const updatedGoals = this.goals.map((goal) =>
      goal.id === source.id ? { ...goal, parentGoalId: newParentId } : goal
    );

    const reorderGroup = (parentId?: string, insertTargetId?: string): void => {
      const group = buildGroupFrom(updatedGoals, parentId)
        .sort((a, b) => {
          const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
          const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
          return aOrder - bOrder || a.title.localeCompare(b.title);
        });
      const existingIndex = group.findIndex((goal) => goal.id === source.id);
      let working = [...group];
      if (existingIndex >= 0) {
        const [moved] = working.splice(existingIndex, 1);
        let insertIndex = working.length;
        if (insertTargetId) {
          const targetIndex = working.findIndex((goal) => goal.id === insertTargetId);
          if (targetIndex >= 0) {
            insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
          }
        }
        if (insertIndex < 0) {
          insertIndex = 0;
        }
        if (insertIndex > working.length) {
          insertIndex = working.length;
        }
        working.splice(insertIndex, 0, moved);
      }
      const orders = new Map<string, number>();
      working.forEach((goal, index) => {
        orders.set(goal.id, index + 1);
      });
      for (let i = 0; i < updatedGoals.length; i += 1) {
        const goal = updatedGoals[i];
        if (
          goal.level === source.level &&
          (goal.parentGoalId ?? "") === (parentId ?? "") &&
          orders.has(goal.id)
        ) {
          updatedGoals[i] = { ...goal, order: orders.get(goal.id) };
        }
      }
    };

    if (newParentId !== oldParentId) {
      reorderGroup(oldParentId);
    }
    if (newParentId === target.id) {
      reorderGroup(newParentId);
    } else if (isSameGroup) {
      reorderGroup(newParentId, target.id);
    } else {
      reorderGroup(newParentId);
    }

    await this.goalsService.saveGoals(updatedGoals);
    this.setStatus("順序を更新しました");
    await this.renderGoals();
    await this.populateParents();
  }

  private async handleMoveToRoot(sourceId: string): Promise<void> {
    const source = this.goals.find((goal) => goal.id === sourceId);
    if (!source) {
      return;
    }
    const updatedGoals = this.goals.map((goal) =>
      goal.id === source.id ? { ...goal, parentGoalId: undefined } : goal
    );
    const rootGroup = updatedGoals
      .filter((goal) => goal.level === source.level && !goal.parentGoalId)
      .sort((a, b) => {
        const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder || a.title.localeCompare(b.title);
      });
    const sourceIndex = rootGroup.findIndex((goal) => goal.id === source.id);
    if (sourceIndex >= 0) {
      const [moved] = rootGroup.splice(sourceIndex, 1);
      rootGroup.push(moved);
    }
    const orders = new Map<string, number>();
    rootGroup.forEach((goal, index) => {
      orders.set(goal.id, index + 1);
    });
    const reordered = updatedGoals.map((goal) =>
      orders.has(goal.id) ? { ...goal, order: orders.get(goal.id) } : goal
    );
    await this.goalsService.saveGoals(reordered);
    this.setStatus("ルートに移動しました");
    await this.renderGoals();
    await this.populateParents();
  }

  private setStatus(message: string): void {
    if (!this.statusEl) {
      return;
    }
    this.statusEl.setText(message);
    window.setTimeout(() => {
      this.statusEl?.setText("");
    }, 2000);
  }

  private async handleToggleExpanded(node: GoalNode, expanded: boolean): Promise<void> {
    await this.goalsService.updateGoal(node.id, { expanded });
  }
}

type GoalNode = {
  id: string;
  title: string;
  description?: string;
  level?: string;
  parentGoalId?: string;
  parentTitle?: string;
  parentLevel?: string;
  order?: number;
  dueDate?: string;
  expanded?: boolean;
  children: GoalNode[];
};

function buildGoalTree(
  goals: {
    id: string;
    title: string;
    description?: string;
    level?: string;
    parentGoalId?: string;
    order?: number;
    dueDate?: string;
    expanded?: boolean;
  }[]
): GoalNode[] {
  const map = new Map<string, GoalNode>();
  for (const goal of goals) {
    map.set(goal.id, {
      id: goal.id,
      title: goal.title,
      description: goal.description,
      level: goal.level,
      parentGoalId: goal.parentGoalId,
      order: goal.order,
      dueDate: goal.dueDate,
      expanded: goal.expanded,
      children: [],
    });
  }
  const roots: GoalNode[] = [];
  for (const goal of goals) {
    const node = map.get(goal.id);
    if (!node) {
      continue;
    }
    if (goal.parentGoalId) {
      const parent = map.get(goal.parentGoalId);
      if (parent) {
        node.parentLevel = parent.level;
        node.parentTitle = parent.title;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }
  const sortNodes = (nodes: GoalNode[]): void => {
    nodes.sort((a, b) => {
      const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder || a.title.localeCompare(b.title);
    });
    for (const node of nodes) {
      sortNodes(node.children);
    }
  };
  sortNodes(roots);
  return roots;
}

function renderGoalTree(
  container: HTMLElement,
  nodes: GoalNode[],
  depth: number,
  onEdit: (node: GoalNode) => void,
  onDelete: (node: GoalNode) => void,
  onAddChild: (node: GoalNode) => void,
  onMove: (sourceId: string, targetNode: GoalNode, position: "before" | "after") => void,
  onToggle: (node: GoalNode, expanded: boolean) => void
): void {
  for (const node of nodes) {
    const card = container.createEl("details", { cls: "lifeplanner-goal-card" });
    card.open = Boolean(node.expanded);
    if (depth > 0) {
      card.style.marginLeft = `${depth * 16}px`;
    }
    const summary = card.createEl("summary", { cls: "lifeplanner-goal-summary" });
    summary.setAttr("aria-label", node.title);
    const dragHandle = summary.createEl("span", {
      cls: "lifeplanner-goal-drag-handle",
      text: "⋮⋮",
    });
    dragHandle.setAttr("draggable", "true");
    summary.createEl("span", {
      cls: "lifeplanner-goal-title",
      text: node.level ? `【${node.level}】${node.title}` : node.title,
    });
    const menuWrap = summary.createEl("div", { cls: "lifeplanner-goal-menu" });
    const menuButton = menuWrap.createEl("button", { text: "⋯" });
    menuButton.setAttr("type", "button");
    menuButton.setAttr("aria-label", "メニュー");
    const menuList = menuWrap.createEl("div", { cls: "lifeplanner-goal-menu-list" });
    const editButton = menuList.createEl("button", { text: "編集" });
    const deleteButton = menuList.createEl("button", { text: "削除" });
    const addChildButton = menuList.createEl("button", { text: "子を追加" });
    editButton.setAttr("type", "button");
    deleteButton.setAttr("type", "button");
    addChildButton.setAttr("type", "button");
    const meta = card.createEl("div", { cls: "lifeplanner-goal-meta" });
    if (node.parentTitle) {
      meta.createEl("div", { text: `親: ${node.parentTitle}` });
    }
    if (node.dueDate) {
      meta.createEl("div", { text: `期限: ${node.dueDate}` });
    }
    if (node.description) {
      card.createEl("div", { text: node.description, cls: "lifeplanner-goal-desc" });
    }
    menuButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      menuList.classList.toggle("is-open");
    });
    editButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      menuList.classList.remove("is-open");
      onEdit(node);
    });
    deleteButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      menuList.classList.remove("is-open");
      onDelete(node);
    });
    addChildButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      menuList.classList.remove("is-open");
      onAddChild(node);
    });
    card.addEventListener("toggle", () => {
      onToggle(node, card.open);
    });

    dragHandle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    dragHandle.addEventListener("dragstart", (event) => {
      event.dataTransfer?.setData("text/plain", node.id);
      event.dataTransfer?.setData("lifeplanner-goal", node.id);
      event.dataTransfer?.setData("lifeplanner-goal-id", node.id);
      event.dataTransfer?.setDragImage(card, 0, 0);
      card.classList.add("is-dragging");
    });
    dragHandle.addEventListener("dragend", () => {
      card.classList.remove("is-dragging");
    });
    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = card.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      const position = event.clientY > midpoint ? "after" : "before";
      card.classList.toggle("is-drop-before", position === "before");
      card.classList.toggle("is-drop-after", position === "after");
    });
    card.addEventListener("dragleave", () => {
      card.classList.remove("is-drop-before", "is-drop-after");
    });
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const sourceId =
        event.dataTransfer?.getData("lifeplanner-goal-id") ||
        event.dataTransfer?.getData("lifeplanner-goal") ||
        event.dataTransfer?.getData("text/plain");
      if (!sourceId) {
        card.classList.remove("is-drop-before", "is-drop-after");
        return;
      }
      const rect = card.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      const position = event.clientY > midpoint ? "after" : "before";
      card.classList.remove("is-drop-before", "is-drop-after");
      onMove(sourceId, node, position);
    });
    if (node.children.length > 0) {
      const childContainer = card.createEl("div", { cls: "lifeplanner-goal-children" });
      renderGoalTree(
        childContainer,
        node.children,
        depth + 1,
        onEdit,
        onDelete,
        onAddChild,
        onMove,
        onToggle
      );
    }
  }
}

function nextLevel(current: GoalLevel): GoalLevel {
  const index = LEVELS.indexOf(current);
  if (index < 0 || index + 1 >= LEVELS.length) {
    return current;
  }
  return LEVELS[index + 1];
}

function levelsBelow(current: GoalLevel): GoalLevel[] {
  const index = LEVELS.indexOf(current);
  if (index < 0 || index + 1 >= LEVELS.length) {
    return [current];
  }
  return LEVELS.slice(index + 1);
}

type GoalEditValues = {
  title: string;
  description: string;
  parentGoalId: string;
  level: GoalLevel;
  dueDate: string;
};

type GoalEditModalOptions = GoalEditValues & {
  lockLevel: boolean;
  lockParent: boolean;
  allowedLevels: GoalLevel[];
  onSubmit: (values: GoalEditValues) => void | Promise<void>;
};

class GoalEditModal extends Modal {
  private options: GoalEditModalOptions;

  constructor(app: import("obsidian").App, options: GoalEditModalOptions) {
    super(app);
    this.options = options;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h3", { text: "目標の編集" });

    const form = contentEl.createEl("div", { cls: "lifeplanner-form" });
    const levelField = form.createEl("div", { cls: "lifeplanner-form-field" });
    levelField.createEl("label", { text: "カテゴリ" });
    const levelSelect = levelField.createEl("select");
    for (const level of this.options.allowedLevels) {
      levelSelect.createEl("option", { text: level, value: level });
    }
    levelSelect.value = this.options.level;
    levelSelect.disabled = this.options.lockLevel;

    const parentField = form.createEl("div", { cls: "lifeplanner-form-field" });
    parentField.createEl("label", { text: "親目標" });
    const parentInput = parentField.createEl("input", { type: "text" });
    parentInput.value = this.options.parentGoalId;
    parentInput.readOnly = this.options.lockParent;

    const titleField = form.createEl("div", { cls: "lifeplanner-form-field" });
    titleField.createEl("label", { text: "目標タイトル" });
    const titleInput = titleField.createEl("input", { type: "text" });
    titleInput.value = this.options.title;

    const descField = form.createEl("div", { cls: "lifeplanner-form-field" });
    descField.createEl("label", { text: "説明文" });
    const descInput = descField.createEl("textarea");
    descInput.rows = 4;
    descInput.value = this.options.description;

    const dueField = form.createEl("div", { cls: "lifeplanner-form-field" });
    dueField.createEl("label", { text: "期限" });
    const dueInput = dueField.createEl("input", { type: "date" });
    dueInput.value = this.options.dueDate;

    const actions = contentEl.createEl("div", { cls: "lifeplanner-goal-actions" });
    const saveButton = actions.createEl("button", { text: "保存" });
    const cancelButton = actions.createEl("button", { text: "キャンセル" });

    saveButton.addEventListener("click", () => {
      const title = titleInput.value.trim();
      if (!title) {
        return;
      }
      void this.options.onSubmit({
        title,
        description: descInput.value.trim(),
        parentGoalId: parentInput.value.trim(),
        level: levelSelect.value as GoalLevel,
        dueDate: dueInput.value.trim(),
      });
      this.close();
    });

    cancelButton.addEventListener("click", () => {
      this.close();
    });
  }
}
