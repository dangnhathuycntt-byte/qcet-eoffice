"use client";

import * as React from "react";
import type { AssistantSkillDTO } from "@qcet/contracts/assistant";
import { listSkillsRequest } from "@/components/assistant/assistant-client";

/**
 * Kỹ năng của người dùng (ADR-012), dùng chung cho menu "/" của ô soạn (trang Trợ lý và khung nổi) và Cài đặt Trợ lý:
 * tải một lần mỗi trang, sửa ở đâu thì nơi khác thấy ngay. Tải lỗi thì coi như chưa có kỹ năng và thử lại lần mở sau.
 */
let skills: AssistantSkillDTO[] | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: AssistantSkillDTO[]) {
  skills = [...next].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function load(): Promise<void> {
  loading ??= listSkillsRequest()
    .then((result) => publish(result.skills))
    .catch(() => undefined)
    .finally(() => {
      loading = null;
    });
  return loading;
}

export const assistantSkillStore = {
  upsert(skill: AssistantSkillDTO) {
    publish([...(skills ?? []).filter((item) => item.id !== skill.id), skill]);
  },
  remove(id: string) {
    publish((skills ?? []).filter((item) => item.id !== id));
  },
};

/** Danh sách kỹ năng; `null` khi chưa tải xong. Chỉ tải khi `enabled` (ô soạn có tiêu điểm, hộp cài đặt mở). */
export function useAssistantSkills(enabled = true): AssistantSkillDTO[] | null {
  const list = React.useSyncExternalStore(
    subscribe,
    () => skills,
    () => null,
  );
  React.useEffect(() => {
    if (enabled && skills === null) void load();
  }, [enabled]);
  return list;
}

/** Bỏ dấu và viết thường để lọc kỹ năng theo chữ gõ sau "/". */
export function foldSkillText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}
