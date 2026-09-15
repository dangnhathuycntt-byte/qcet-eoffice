import { shouldIgnoreShortcut } from "./guards";
import { globalShortcutRegistry } from "./registry";

/**
 * Task Workspace Keyboard Sequences (Plan v1 §Context.9 / Plan v2 §8)
 * Handles:
 * - Single key 'c' to open Create Task modal
 * - Sequential 'n' followed by 'p' within 500ms
 * - Holding 'n' then pressing 'p'
 */

export interface TaskSequenceOptions {
  onCreateTask: () => void;
  enabled?: boolean;
}

export function registerTaskShortcuts(onCreateTask: () => void): () => void {
  return globalShortcutRegistry.register({
    id: "create-task-c",
    description: "Tạo nhiệm vụ mới (c)",
    key: "c",
    action: () => onCreateTask(),
  });
}

export function createTaskSequenceListener(options: TaskSequenceOptions) {
  let lastNTime = 0;
  const activeKeys = new Set<string>();

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!options.enabled) return;
    if (shouldIgnoreShortcut(event)) return;

    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const key = event.key.toLowerCase();
    activeKeys.add(key);
    const now = Date.now();

    // 1. Single key 'c' for Create Task
    if (key === "c") {
      event.preventDefault();
      options.onCreateTask();
      return;
    }

    // 2. Sequential 'n' followed by 'p' within 500ms
    if (key === "n") {
      lastNTime = now;
      return;
    }

    if (key === "p") {
      const isSequentialNP = now - lastNTime < 500;
      const isChordNP = activeKeys.has("n");

      if (isSequentialNP || isChordNP) {
        event.preventDefault();
        lastNTime = 0;
        options.onCreateTask();
        return;
      }
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    activeKeys.delete(key);
  };

  return { handleKeyDown, handleKeyUp };
}
