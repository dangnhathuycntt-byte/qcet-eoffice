/**
 * URL search params helpers for task workspace deep linking and state sync.
 */
import {
  parseTaskUrlParams,
  buildTaskUrlQuery,
  syncTaskUrlParams,
  type TaskUrlParams,
} from "@/hooks/use-task-filters";

export { parseTaskUrlParams, syncTaskUrlParams, type TaskUrlParams };

export const buildTaskUrlParams = (
  currentUrlState: Partial<TaskUrlParams>,
  existingQuery?: string | URLSearchParams
): string => {
  return buildTaskUrlQuery(currentUrlState, existingQuery);
};

export { buildTaskUrlQuery };
