"use client";

import * as React from "react";
import { resolveAgentModel, type AgentModelCatalog, type AgentModelOption } from "@/domain/agent/agent-models";

/** Danh sách model đọc ở server (layout) cho ô soạn của Trợ lý (trang và khung chat nổi) và Agent tạo nhiệm vụ. */
const AgentModelsContext = React.createContext<AgentModelCatalog | null>(null);

export function AgentModelsProvider({ catalog, children }: { catalog: AgentModelCatalog | null; children: React.ReactNode }) {
  return <AgentModelsContext.Provider value={catalog}>{children}</AgentModelsContext.Provider>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Model đã chọn: nhớ theo trình duyệt, chung cho Trợ lý và Agent tạo nhiệm vụ, áp dụng từ lượt gửi kế tiếp. Tab khác
 * đổi thì tab này theo (chỉ ảnh hưởng lượt sau, không hủy lượt đang chạy). Bộ nhớ bị chặn thì chỉ nhớ trong phiên.
 * ------------------------------------------------------------------------------------------------------------- */

const MODEL_STORAGE_KEY = "qcet.agent.model";
const modelListeners = new Set<() => void>();
let modelInSession: string | null = null;

function readStoredModel(): string | null {
  try {
    return window.localStorage.getItem(MODEL_STORAGE_KEY) ?? modelInSession;
  } catch {
    return modelInSession;
  }
}

function writeStoredModel(id: string) {
  modelInSession = id;
  try {
    window.localStorage.setItem(MODEL_STORAGE_KEY, id);
  } catch {
    // Bộ nhớ bị chặn: vẫn nhớ trong phiên
  }
  modelListeners.forEach((listener) => listener());
}

function subscribeModel(listener: () => void) {
  modelListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    modelListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export interface AgentModelState {
  /** Các model được phép; ít hơn hai thì không hiện bộ chọn. */
  models: AgentModelOption[];
  /** Model sẽ dùng cho lượt sau; `null` khi chưa có danh sách (Trợ lý tắt). */
  model: string | null;
  setModel: (id: string) => void;
}

export function useAgentModel(): AgentModelState {
  const catalog = React.useContext(AgentModelsContext);
  const stored = React.useSyncExternalStore(subscribeModel, readStoredModel, () => null);
  return { models: catalog?.models ?? [], model: resolveAgentModel(catalog, stored), setModel: writeStoredModel };
}
