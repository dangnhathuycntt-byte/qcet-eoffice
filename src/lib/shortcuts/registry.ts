import { shouldIgnoreShortcut } from "./guards";

export type ShortcutAction = (event: KeyboardEvent) => void;

export interface ShortcutDefinition {
  id: string;
  description: string;
  key: string; // e.g. "c", "s", "p"
  modifiers?: {
    meta?: boolean;
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
  };
  action: ShortcutAction;
  scope?: string;
  enabled?: boolean | (() => boolean);
}

export class ShortcutRegistry {
  private shortcuts: Map<string, ShortcutDefinition> = new Map();
  private activeScope: string = "global";

  public register(shortcut: ShortcutDefinition): () => void {
    this.shortcuts.set(shortcut.id, shortcut);
    return () => this.unregister(shortcut.id);
  }

  public unregister(id: string): void {
    this.shortcuts.delete(id);
  }

  public setScope(scope: string): void {
    this.activeScope = scope;
  }

  public handleKeyDown(event: KeyboardEvent): boolean {
    if (shouldIgnoreShortcut(event)) {
      return false;
    }

    const key = event.key.toLowerCase();

    for (const def of this.shortcuts.values()) {
      const isEnabled =
        typeof def.enabled === "function"
          ? def.enabled()
          : def.enabled !== false;

      if (!isEnabled) continue;

      if (def.scope && def.scope !== "global" && def.scope !== this.activeScope) {
        continue;
      }

      if (def.key.toLowerCase() !== key) {
        continue;
      }

      // Check modifiers
      const metaRequired = Boolean(def.modifiers?.meta);
      const ctrlRequired = Boolean(def.modifiers?.ctrl);
      const altRequired = Boolean(def.modifiers?.alt);
      const shiftRequired = Boolean(def.modifiers?.shift);

      // Treat meta and ctrl equivalently on appropriate platform if both allow
      const metaMatch = metaRequired ? event.metaKey : !event.metaKey;
      const ctrlMatch = ctrlRequired ? event.ctrlKey : !event.ctrlKey;
      const altMatch = altRequired ? event.altKey : !event.altKey;
      const shiftMatch = shiftRequired ? event.shiftKey : !event.shiftKey;

      if (metaMatch && ctrlMatch && altMatch && shiftMatch) {
        event.preventDefault();
        def.action(event);
        return true;
      }
    }

    return false;
  }
}

export const globalShortcutRegistry = new ShortcutRegistry();
