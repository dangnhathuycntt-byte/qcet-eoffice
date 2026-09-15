/**
 * Shortcut input guards (Plan v2 §8 / REQ-10 / REQ-11)
 * Safely determines if keyboard events should be ignored.
 */

export function isInteractiveInput(element: HTMLElement | null): boolean {
  if (!element) return false;

  const tagName = element.tagName.toLowerCase();
  if (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    element.isContentEditable ||
    element.getAttribute("role") === "textbox" ||
    element.getAttribute("contenteditable") === "true"
  ) {
    return true;
  }

  return false;
}

export function shouldIgnoreShortcut(event: KeyboardEvent): boolean {
  // If browser is actively composing with IME (e.g. Vietnamese Telex/VNI)
  if (event.isComposing || event.keyCode === 229) {
    return true;
  }

  const target = event.target as HTMLElement | null;
  if (!target) return false;

  return isInteractiveInput(target);
}

/**
 * Strict guard for Space key peek preview (REQ-10)
 * Space must NEVER be intercepted when the focused target is any interactive control.
 */
export function shouldIgnoreSpaceKey(event: KeyboardEvent): boolean {
  if (shouldIgnoreShortcut(event)) return true;

  const target = event.target as HTMLElement | null;
  if (!target) return false;

  const tagName = target.tagName.toLowerCase();
  const role = target.getAttribute("role");

  if (
    tagName === "button" ||
    tagName === "a" ||
    tagName === "select" ||
    role === "button" ||
    role === "checkbox" ||
    role === "radio" ||
    role === "menuitem" ||
    role === "tab" ||
    role === "switch"
  ) {
    return true;
  }

  return false;
}
