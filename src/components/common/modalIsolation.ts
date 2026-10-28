/** Hide every branch outside a modal, including when it lives inside a game panel. */
export function isolateModalBackground(modalRoot: HTMLElement | null): () => void {
  if (!modalRoot?.isConnected) return () => {};
  const previous: Array<{ element: Element; inert: string | null; hidden: string | null }> = [];
  let branch: Element = modalRoot;
  while (branch !== document.body && branch.parentElement) {
    const parent = branch.parentElement;
    for (const element of Array.from(parent.children)) {
      if (element !== branch) previous.push({ element, inert: element.getAttribute("inert"), hidden: element.getAttribute("aria-hidden") });
    }
    branch = parent;
  }
  const overflow = document.body.style.overflow;
  for (const { element } of previous) {
    element.setAttribute("inert", "");
    element.setAttribute("aria-hidden", "true");
  }
  document.body.style.overflow = "hidden";
  return () => {
    for (const { element, inert, hidden } of previous) {
      if (inert === null) element.removeAttribute("inert"); else element.setAttribute("inert", inert);
      if (hidden === null) element.removeAttribute("aria-hidden"); else element.setAttribute("aria-hidden", hidden);
    }
    document.body.style.overflow = overflow;
  };
}
