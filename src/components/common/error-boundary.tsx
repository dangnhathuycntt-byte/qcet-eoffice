"use client";

/**
 * Sectional Error Boundaries for QCET E-Office.
 *
 * Implements modular error boundaries to isolate component rendering failures:
 * - AppShellErrorBoundary: Wraps the main application shell
 * - WorkspaceErrorBoundary: Wraps the tasks/workbench view
 * - TaskDetailErrorBoundary: Wraps task detail modal / side-sheet
 * - DocumentViewerErrorBoundary: Wraps PDF / document viewer
 * - DashboardErrorBoundary: Wraps analytics & metric widgets
 * - CalendarErrorBoundary: Wraps academic calendar & agenda
 *
 * Invariants:
 * - Prevents a single component failure from crashing the entire app.
 * - Adheres to Light-Only Standard (OKLCH tokens, no dark: variants, no emojis).
 * - Restrained iconography: Lucide icons with strokeWidth={1.5}.
 * - Accessible: role="alert", accessible button labels, keyboard focus rings.
 * - Dispatches sanitized diagnostic reports via client telemetry.
 */

import * as React from "react";
import {
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  FileWarning,
  LayoutDashboard,
  CalendarX,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/telemetry/client";
import { sanitizeString } from "@/telemetry/sanitize";

export interface ErrorBoundaryFallbackProps {
  error: Error | null;
  resetErrorBoundary: () => void;
  section?: string;
}

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?:
    | React.ReactNode
    | ((props: ErrorBoundaryFallbackProps) => React.ReactNode);
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onReset?: () => void;
  resetKeys?: unknown[];
  section?: string;
  title?: string;
  description?: string;
  showReload?: boolean;
  compact?: boolean;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Sectional Error Fallback UI component adhering strictly to QCET Light Design System.
 */
export function SectionErrorFallback({
  error,
  resetErrorBoundary,
  section = "section",
  title,
  description,
  showReload = false,
  compact = false,
}: {
  error: Error | null;
  resetErrorBoundary: () => void;
  section?: string;
  title?: string;
  description?: string;
  showReload?: boolean;
  compact?: boolean;
}) {
  const [showDetails, setShowDetails] = React.useState(false);

  const defaultTitle = "Đã xảy ra sự cố hiển thị";
  const defaultDescription =
    "Thành phần giao diện gặp lỗi tạm thời. Dữ liệu nghiệp vụ của bạn vẫn an toàn.";

  const displayTitle = title || defaultTitle;
  const displayDescription = description || defaultDescription;

  const handleReloadPage = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  const getSectionIcon = () => {
    switch (section) {
      case "document-viewer":
        return <FileWarning className="size-5 text-amber-700" strokeWidth={1.5} />;
      case "dashboard":
        return <LayoutDashboard className="size-5 text-amber-700" strokeWidth={1.5} />;
      case "calendar":
        return <CalendarX className="size-5 text-amber-700" strokeWidth={1.5} />;
      case "workspace":
        return <Layers className="size-5 text-amber-700" strokeWidth={1.5} />;
      default:
        return <AlertTriangle className="size-5 text-amber-700" strokeWidth={1.5} />;
    }
  };

  if (compact) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="flex flex-col items-center justify-center p-4 text-center rounded-lg border border-amber-200 bg-amber-50/60 text-foreground w-full min-h-[140px] space-y-2.5 transition-all"
      >
        <div className="flex items-center gap-2">
          {getSectionIcon()}
          <span className="text-xs font-semibold text-foreground">
            {displayTitle}
          </span>
        </div>
        <p className="text-xs text-muted-foreground max-w-xs line-clamp-2">
          {displayDescription}
        </p>
        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={resetErrorBoundary}
            className="border-amber-300 bg-card hover:bg-amber-100/60 text-foreground"
          >
            <RotateCcw className="size-3.5 text-muted-foreground mr-1" strokeWidth={1.5} />
            Thử lại
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col items-center justify-center p-6 sm:p-8 text-center rounded-xl border border-border bg-card shadow-xs text-foreground w-full my-4"
    >
      <div className="size-11 rounded-full bg-amber-100 flex items-center justify-center mb-3.5 ring-4 ring-amber-50">
        {getSectionIcon()}
      </div>

      <h3 className="text-sm font-semibold text-foreground mb-1">
        {displayTitle}
      </h3>

      <p className="text-xs text-muted-foreground max-w-md leading-relaxed mb-4">
        {displayDescription}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={resetErrorBoundary}
          className="shadow-xs font-medium"
        >
          <RotateCcw className="size-3.5 mr-1.5" strokeWidth={1.5} />
          Thử lại
        </Button>

        {showReload && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReloadPage}
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="size-3.5 mr-1.5" strokeWidth={1.5} />
            Tải lại trang
          </Button>
        )}

        {error?.message && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails((prev) => !prev)}
            className="text-xs text-muted-foreground hover:text-foreground"
            aria-expanded={showDetails}
          >
            {showDetails ? "Ẩn kỹ thuật" : "Chi tiết lỗi"}
          </Button>
        )}
      </div>

      {showDetails && error && (
        <div className="mt-4 w-full max-w-lg p-3 bg-muted/50 rounded-lg border border-border/80 text-left overflow-x-auto text-xs font-mono text-muted-foreground">
          <p className="font-semibold text-foreground mb-1">
            {sanitizeString(error.name || "Error")}: {sanitizeString(error.message)}
          </p>
          {error.stack && (
            <pre className="text-[11px] leading-snug whitespace-pre-wrap break-all opacity-80 max-h-36 overflow-y-auto">
              {sanitizeString(error.stack)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Base Sectional Error Boundary.
 * Compatible with React 19 and SSR hydration.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // 1. Report to client telemetry
    reportClientError(error, {
      section: this.props.section || "unknown",
      componentStack: errorInfo.componentStack || undefined,
    });

    // 2. Invoke optional custom onError handler
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset boundary if resetKeys changed
    if (this.state.hasError && this.props.resetKeys && prevProps.resetKeys) {
      const keysChanged =
        this.props.resetKeys.length !== prevProps.resetKeys.length ||
        this.props.resetKeys.some((k, i) => k !== prevProps.resetKeys?.[i]);

      if (keysChanged) {
        this.resetErrorBoundary();
      }
    }
  }

  resetErrorBoundary = (): void => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (typeof this.props.fallback === "function") {
        return this.props.fallback({
          error: this.state.error,
          resetErrorBoundary: this.resetErrorBoundary,
          section: this.props.section,
        });
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <SectionErrorFallback
          error={this.state.error}
          resetErrorBoundary={this.resetErrorBoundary}
          section={this.props.section}
          title={this.props.title}
          description={this.props.description}
          showReload={this.props.showReload}
          compact={this.props.compact}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * AppShellErrorBoundary: Isolates root app shell and global layout failures.
 */
export function AppShellErrorBoundary({
  children,
  onReset,
  onError,
}: {
  children: React.ReactNode;
  onReset?: () => void;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}) {
  return (
    <ErrorBoundary
      section="app-shell"
      title="Đã xảy ra sự cố giao diện hệ thống"
      description="Giao diện chính gặp sự cố không mong muốn. Dữ liệu công việc của bạn trên máy chủ vẫn được bảo toàn an toàn."
      showReload={true}
      onReset={onReset}
      onError={onError}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * WorkspaceErrorBoundary: Isolates tasks workspace and workbench views.
 */
export function WorkspaceErrorBoundary({
  children,
  resetKeys,
  onReset,
  onError,
}: {
  children: React.ReactNode;
  resetKeys?: unknown[];
  onReset?: () => void;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}) {
  return (
    <ErrorBoundary
      section="workspace"
      title="Không thể hiển thị không gian làm việc"
      description="Khu vực bàn làm việc gặp sự cố khi tải dữ liệu. Bạn có thể khôi phục lại khu vực này mà không ảnh hưởng tới các chức năng khác."
      resetKeys={resetKeys}
      onReset={onReset}
      onError={onError}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * TaskDetailErrorBoundary: Isolates task detail side-sheet, drawer, or modal rendering errors.
 */
export function TaskDetailErrorBoundary({
  children,
  taskId,
  onReset,
  onError,
}: {
  children: React.ReactNode;
  taskId?: string;
  onReset?: () => void;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}) {
  return (
    <ErrorBoundary
      section="task-detail"
      title="Lỗi tải chi tiết nhiệm vụ"
      description="Không thể hiển thị thông tin nhiệm vụ được chọn. Vui lòng thử lại hoặc chọn một nhiệm vụ khác."
      resetKeys={taskId ? [taskId] : undefined}
      onReset={onReset}
      onError={onError}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * DocumentViewerErrorBoundary: Isolates PDF viewer, file streamer, or attachment previews.
 */
export function DocumentViewerErrorBoundary({
  children,
  documentId,
  onReset,
  onError,
}: {
  children: React.ReactNode;
  documentId?: string;
  onReset?: () => void;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}) {
  return (
    <ErrorBoundary
      section="document-viewer"
      title="Không thể hiển thị tệp tài liệu"
      description="Đã xảy ra lỗi khi hiển thị tài liệu đính kèm hoặc bản xem trước. Vui lòng thử lại hoặc tải tệp về thiết bị."
      resetKeys={documentId ? [documentId] : undefined}
      onReset={onReset}
      onError={onError}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * DashboardErrorBoundary: Isolates widget, KPI tile, and analytics chart failures.
 */
export function DashboardErrorBoundary({
  children,
  widgetName,
  onReset,
  onError,
}: {
  children: React.ReactNode;
  widgetName?: string;
  onReset?: () => void;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}) {
  return (
    <ErrorBoundary
      section="dashboard"
      title={widgetName ? `Lỗi hiển thị ${widgetName}` : "Lỗi tải khối chỉ số thống kê"}
      description="Biểu đồ hoặc khối tổng hợp số liệu gặp lỗi tạm thời. Các khối khác vẫn hoạt động bình thường."
      compact={true}
      onReset={onReset}
      onError={onError}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * CalendarErrorBoundary: Isolates academic calendar, monthly grid, and agenda schedule failures.
 */
export function CalendarErrorBoundary({
  children,
  periodKey,
  onReset,
  onError,
}: {
  children: React.ReactNode;
  periodKey?: string;
  onReset?: () => void;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}) {
  return (
    <ErrorBoundary
      section="calendar"
      title="Lỗi hiển thị lịch công tác"
      description="Không thể kết xuất dữ liệu lịch tuần hoặc lịch tháng. Dữ liệu kế hoạch vẫn được lưu trữ đầy đủ."
      resetKeys={periodKey ? [periodKey] : undefined}
      onReset={onReset}
      onError={onError}
    >
      {children}
    </ErrorBoundary>
  );
}
