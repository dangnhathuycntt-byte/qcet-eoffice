/**
 * Instrumentation của ứng dụng web: ghi lỗi khi vẽ trang thành một dòng JSON (event `app.request.error`), cùng định
 * dạng với logger của api (`timestamp`, `level`, `event`, `service`, `requestId`, `errorCode`, `metadata`) để log hai
 * dịch vụ đọc chung được. Web không có worker hay logger server riêng; dữ liệu đi qua `sanitizeLogContext` trước khi ghi.
 */
import { sanitizeLogContext } from '@qcet/shared/telemetry/sanitize';

export async function onRequestError(
  err: { digest?: string } & Error,
  request: {
    path: string;
    method: string;
    headers: Record<string, string | string[] | undefined>;
  },
  context: {
    routerKind: 'Pages Router' | 'App Router';
    routePath: string;
    routeType: 'render' | 'route' | 'action' | 'middleware';
  }
): Promise<void> {
  try {
    const requestId = request.headers['x-request-id'];
    const service = process.env.SERVICE_NAME?.trim();
    const entry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      event: 'app.request.error',
      ...(service ? { service } : {}),
      ...(typeof requestId === 'string' ? { requestId } : {}),
      errorCode: err.digest || 'REQUEST_ERROR',
      metadata: sanitizeLogContext({
        path: request.path,
        method: request.method,
        routerKind: context.routerKind,
        routePath: context.routePath,
        routeType: context.routeType,
        digest: err.digest,
        error: err,
      }),
    };
    // console.error chạy được cả ở runtime nodejs (ra stderr) lẫn edge (lỗi của middleware)
    console.error(JSON.stringify(entry));
  } catch {
    // Không bao giờ ném lỗi từ hook ghi lỗi
  }
}
