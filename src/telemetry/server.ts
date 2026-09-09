/**
 * Server-side Structured Logger for QCET E-Office.
 *
 * Enforces privacy-first telemetry on the server:
 * - All contexts, error objects, and metadata are sanitized via sanitizeLogContext() before output.
 * - Credentials, tokens, passwords, database strings, auth secrets, authorization headers,
 *   cookies, and sensitive PII are strictly stripped.
 * - Adheres to Backend API Invariants rule 6 (Information Leak Prevention).
 */

import { sanitizeLogContext, type SanitizeOptions } from "./sanitize";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: unknown;
  environment: string;
}

export interface LoggerOptions {
  /** Minimum log level to emit. Default: 'debug' in development/test, 'info' in production */
  minLevel?: LogLevel;
  /** Custom sanitize options */
  sanitizeOptions?: SanitizeOptions;
  /** Custom log writer callback, e.g. for forwarding to external log aggregator or testing */
  writer?: (entry: LogEntry) => void;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class ServerLogger {
  private minLevel: LogLevel;
  private sanitizeOptions: SanitizeOptions;
  private writer?: (entry: LogEntry) => void;

  constructor(options: LoggerOptions = {}) {
    const isProd = process.env.NODE_ENV === "production";
    this.minLevel = options.minLevel ?? (isProd ? "info" : "debug");
    this.sanitizeOptions = options.sanitizeOptions ?? {};
    this.writer = options.writer;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  private emit(level: LogLevel, message: string, context?: unknown): LogEntry {
    const sanitizedContext =
      context !== undefined
        ? sanitizeLogContext(context, this.sanitizeOptions)
        : undefined;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: sanitizedContext,
      environment: process.env.NODE_ENV || "development",
    };

    if (this.writer) {
      try {
        this.writer(entry);
      } catch {
        // Writer errors must never crash server operations
      }
      return entry;
    }

    // Default console output
    const formatted = JSON.stringify(entry);
    switch (level) {
      case "debug":
        console.debug(formatted);
        break;
      case "info":
        console.info(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "error":
        console.error(formatted);
        break;
    }

    return entry;
  }

  public debug(message: string, context?: unknown): LogEntry | undefined {
    if (!this.shouldLog("debug")) return undefined;
    return this.emit("debug", message, context);
  }

  public info(message: string, context?: unknown): LogEntry | undefined {
    if (!this.shouldLog("info")) return undefined;
    return this.emit("info", message, context);
  }

  public warn(message: string, context?: unknown): LogEntry | undefined {
    if (!this.shouldLog("warn")) return undefined;
    return this.emit("warn", message, context);
  }

  public error(
    message: string,
    errorOrContext?: unknown,
    additionalContext?: unknown
  ): LogEntry | undefined {
    if (!this.shouldLog("error")) return undefined;

    let mergedContext: unknown = errorOrContext;
    if (additionalContext !== undefined) {
      mergedContext = {
        error: errorOrContext,
        metadata: additionalContext,
      };
    }

    return this.emit("error", message, mergedContext);
  }
}

/**
 * Singleton canonical server logger instance for QCET E-Office.
 */
export const serverLogger = new ServerLogger();
