export function enableTapToBlur(container: HTMLElement): void {
  container.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }
    if (target.closest("input, textarea, select, button, a, .lifeplanner-no-blur")) {
      return;
    }
    const active = document.activeElement as HTMLElement | null;
    if (active && container.contains(active)) {
      active.blur();
    }
  });
}

type RowMenuItem = {
  label: string;
  onSelect: () => void;
};

export function registerRowMenuClose(scope: HTMLElement): () => void {
  const handler = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && target.closest(".lifeplanner-row-menu")) {
      return;
    }
    scope.querySelectorAll(".lifeplanner-row-menu-list.is-open").forEach((menu) => {
      menu.classList.remove("is-open");
    });
  };
  document.addEventListener("mousedown", handler, true);
  return () => {
    document.removeEventListener("mousedown", handler, true);
  };
}

export function attachDeleteMenu(
  container: HTMLElement,
  scope: HTMLElement,
  onDelete: () => void
): void {
  attachRowMenu(container, scope, [{ label: "削除", onSelect: onDelete }]);
}

export function attachRowMenu(
  container: HTMLElement,
  scope: HTMLElement,
  items: RowMenuItem[]
): void {
  const menu = container.createEl("div", { cls: "lifeplanner-row-menu" });
  const menuButton = menu.createEl("button", {
    text: "⋯",
    cls: "lifeplanner-row-menu-button",
  });
  menuButton.setAttr("type", "button");
  menuButton.setAttr("aria-label", "メニュー");
  const menuList = menu.createEl("div", { cls: "lifeplanner-row-menu-list" });
  items.forEach((item) => {
    const button = menuList.createEl("button", { text: item.label });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      menuList.classList.remove("is-open");
      item.onSelect();
    });
  });
  menuButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    scope.querySelectorAll(".lifeplanner-row-menu-list.is-open").forEach((openMenu) => {
      if (openMenu !== menuList) {
        openMenu.classList.remove("is-open");
      }
    });
    menuList.classList.toggle("is-open");
  });
}
