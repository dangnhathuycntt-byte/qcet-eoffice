/**
 * Danh sách model được chọn ở ô soạn của Trợ lý và Agent tạo nhiệm vụ (cùng gateway `TASK_AGENT_*`): `TASK_AGENT_MODELS`
 * (mã cách nhau bằng dấu phẩy) cộng model mặc định `TASK_AGENT_MODEL`, luôn đứng đầu. Máy chủ chỉ nhận model trong danh
 * sách này; giao diện dùng cùng danh sách để vẽ bộ chọn. Không đặt `TASK_AGENT_MODELS` thì chỉ có model mặc định và bộ
 * chọn không hiện.
 */

export interface AgentModelOption {
  id: string;
  label: string;
}

export interface AgentModelCatalog {
  models: AgentModelOption[];
  defaultModel: string;
}

/** Mã model của gateway: chữ, số và `._-[]`, tối đa 64 ký tự. Mã sai dạng bị bỏ qua. */
const MODEL_ID_PATTERN = /^[A-Za-z0-9._\-[\]]{1,64}$/;

/** Tên hiển thị của các model đã thử qua gateway; mã khác hiện nguyên mã. */
const KNOWN_LABELS: Record<string, string> = {
  "sonnet-4.6": "Claude Sonnet 4.6",
  "claude-sonnet-4-6": "Claude Sonnet 4.6",
  "opus-4.6": "Claude Opus 4.6",
  "claude-opus-4-6-thinking": "Claude Opus 4.6",
  "gemini-3.8-flash": "Gemini 3.8 Flash",
  "gemini-3.8-flash-high": "Gemini 3.8 Flash (High)",
};

export function agentModelLabel(id: string): string {
  return KNOWN_LABELS[id] ?? id;
}

/** Danh sách theo thứ tự: model mặc định trước, rồi các mã trong `rawList` (bỏ trùng, bỏ mã sai dạng). */
export function parseAgentModels(rawList: string | undefined, defaultModel: string | undefined): AgentModelCatalog | null {
  const fallback = defaultModel?.trim();
  if (!fallback || !MODEL_ID_PATTERN.test(fallback)) return null;
  const ids = [fallback];
  for (const part of (rawList ?? "").split(",")) {
    const id = part.trim();
    if (id && MODEL_ID_PATTERN.test(id) && !ids.includes(id)) ids.push(id);
  }
  // Hai mã cùng tên hiển thị (biệt danh và mã đầy đủ của cùng model) thì mã sau ghi kèm mã để phân biệt trong bộ chọn
  const labels = new Set<string>();
  const models = ids.map((id) => {
    const known = agentModelLabel(id);
    const label = labels.has(known) ? `${known} (${id})` : known;
    labels.add(known);
    return { id, label };
  });
  return { models, defaultModel: fallback };
}

/** Model trình duyệt gửi lên có được phép không (so đúng mã, phân biệt hoa thường). */
export function isAllowedAgentModel(catalog: AgentModelCatalog | null, id: string): boolean {
  return Boolean(catalog?.models.some((model) => model.id === id));
}

/** Model đã nhớ ở trình duyệt còn trong danh sách thì dùng, không thì về model mặc định. */
export function resolveAgentModel(catalog: AgentModelCatalog | null, stored: string | null): string | null {
  if (!catalog) return null;
  return stored && isAllowedAgentModel(catalog, stored) ? stored : catalog.defaultModel;
}
