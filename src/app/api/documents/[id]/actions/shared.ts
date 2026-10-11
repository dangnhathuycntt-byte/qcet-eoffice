import type { ZodType } from "zod";
import type { AuthenticatedUser } from "@/server/api/request-context";
import { idActionRoute, type IdActionCall, type IdActionRouteOptions } from "@/server/api/action-route";

export interface DocumentActionCall extends Omit<IdActionCall, "id"> {
  documentId: string;
}

/** Route chuyển trạng thái văn bản: xem `idActionRoute`; `run` nhận `documentId` thay cho `id`. */
export function documentActionRoute<T>(
  schema: ZodType<T>,
  run: (user: AuthenticatedUser, body: T, call: DocumentActionCall) => Promise<unknown>,
  options?: IdActionRouteOptions
) {
  return idActionRoute(schema, (user, body, { id, ...rest }) => run(user, body, { documentId: id, ...rest }), options);
}
