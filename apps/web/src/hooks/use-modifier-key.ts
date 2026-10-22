"use client";

import * as React from "react";
import { getPlatformModifierKey } from "@/lib/shortcuts/platform";

const subscribe = () => () => {};
const getServerSnapshot = () => "Ctrl" as const;

/** Phím bổ trợ của máy đang dùng ("⌘" trên Mac, "Ctrl" nơi khác); server và lượt hydrate dùng "Ctrl" để HTML khớp. */
export function useModifierKey(): "⌘" | "Ctrl" {
  return React.useSyncExternalStore(subscribe, getPlatformModifierKey, getServerSnapshot);
}
